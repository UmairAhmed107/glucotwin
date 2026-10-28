import hashlib
import json
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.audit import log_audit_event
from app.auth import get_current_user, log_audit_event as log_audit_rbac, verify_patient_access
from app.clinical.fallback import get_fallback_plan
from app.clinical.governor import run_safety_governor
from app.clinical.guidelines import get_known_guideline_ids, retrieve_guidelines
from app.clinical.reasoning import generate_clinical_plan
from app.clinical.recommendation_bank import get_personalized_week_plan
from app.db import get_db
from app.models_db import MealEntry, Patient, Recommendation, TwinState, User
from app.schemas import (
    ClinicalPlanResponse,
    CombinedPlanResponse,
    GovernorTraceSchema,
    GuidelineSnippetSchema,
    PlanItem,
    TherapyScenarioItem,
    TherapyScenarioRange,
    TherapyScenariosResponse,
    WeekPlan,
)
from app.twin.memory import compute_memory
from app.twin.twin_engine import get_model_version, predict_meal

router = APIRouter(prefix="/patients/{patient_id}", tags=["Clinical Decision Support"])


def _extract_literature_range(text: str) -> Optional[TherapyScenarioRange]:
    """Leniently parse HbA1c reduction range from literature text."""
    if not text:
        return None
    # Pattern matching "1.0% to 1.5%" or "0.5% - 0.9%" or "1.0 to 1.8%"
    match = re.search(r"(\d+(?:\.\d+)?)\s*%?\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*%", text, re.IGNORECASE)
    if match:
        try:
            val1 = float(match.group(1))
            val2 = float(match.group(2))
            min_val = min(val1, val2)
            max_val = max(val1, val2)
            return TherapyScenarioRange(min=min_val, max=max_val, unit="% HbA1c")
        except Exception:
            pass
    return None


def _build_patient_clinical_context(patient: Patient, db: Session) -> Dict[str, Any]:
    """Assemble patient clinical context and twin memory summary."""
    memory_info = compute_memory(patient.id, db)

    # Worst meals or recent meal patterns
    recent_meals = (
        db.query(MealEntry)
        .filter(MealEntry.patient_id == patient.id)
        .order_by(MealEntry.logged_at.desc())
        .limit(5)
        .all()
    )

    worst_meals = []
    for m in recent_meals:
        if m.observed_peak_rise and m.observed_peak_rise >= 40:
            worst_meals.append({
                "carbs_g": m.carbs_g,
                "calories": m.calories,
                "observed_peak_rise": m.observed_peak_rise,
            })

    twin_summary = {
        "mem_n": memory_info["mem_n"],
        "mem_mean_rise": round(memory_info["mem_mean_rise"], 1),
        "mem_mean_iauc": round(memory_info["mem_mean_iauc"], 1),
        "worst_meals": worst_meals,
        "best_time_of_day": "Midday (12:00 - 14:00)",
        "baseline_used": memory_info["baseline_used"],
    }

    return {
        "id": patient.id,
        "display_name": patient.display_name,
        "age": patient.age,
        "sex": patient.sex,
        "bmi": patient.bmi,
        "hba1c_pct": patient.hba1c_pct,
        "fasting_glucose_mgdl": patient.fasting_glucose_mgdl,
        "hypoglycemia_history": patient.hypoglycemia_history,
        "kidney_flag": patient.kidney_flag,
        "current_meds": patient.current_meds or [],
        "twin_summary": twin_summary,
    }


@router.post("/clinical-plan", response_model=ClinicalPlanResponse)
def get_clinical_plan(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate governed clinical decision-support plan.
    Uses retrieved guideline snippets, Gemini reasoning (or cached/demo fixture),
    and validates through the deterministic Safety Governor.
    """
    patient = verify_patient_access(patient_id, current_user, db)

    patient_context = _build_patient_clinical_context(patient, db)


    # 1. Retrieve top 3-5 guideline snippets
    snippets = retrieve_guidelines(patient_context, top_k=4)
    known_gids = get_known_guideline_ids()

    # 2. Call clinical reasoning (Gemini / cache / fixture)
    raw_plan, gemini_used, demo_fixture, model_name = generate_clinical_plan(
        patient_context, snippets, db
    )

    # 3. Pass through deterministic Safety Governor
    governed_plan, rules_triggered = run_safety_governor(
        raw_plan,
        patient_context,
        known_guideline_ids=known_gids,
        gemini_used=gemini_used,
        demo_fixture=demo_fixture,
    )

    # 4. Save recommendation row
    rec = Recommendation(
        patient_id=patient_id,
        kind="therapy",
        provenance="GUIDELINE_AI",
        safety_checked=True,
        payload=governed_plan,
        governor_result={"rules_triggered": rules_triggered},
    )
    db.add(rec)
    db.commit()

    # 5. Write audit log
    input_str = json.dumps(patient_context, sort_keys=True)
    inputs_hash = hashlib.sha256(input_str.encode("utf-8")).hexdigest()
    log_audit_event(
        db=db,
        endpoint=f"/patients/{patient_id}/clinical-plan",
        inputs_hash=inputs_hash,
        patient_id=patient_id,
        model_version=get_model_version(),
        rules_triggered=rules_triggered,
        gemini_model=model_name,
        gemini_used=gemini_used,
    )
    log_audit_rbac(
        db=db,
        user_id=current_user.id,
        action="clinical_plan",
        resource_type="clinical_plan",
        resource_id=rec.id,
        patient_id=patient_id,
    )

    sources_schema = [
        GuidelineSnippetSchema(id=s["id"], topic=s["topic"], text=s["text"])
        for s in snippets
    ]

    is_clean = len(rules_triggered) == 1 and rules_triggered[0] == "R9_SAFETY_STAMPED"

    return ClinicalPlanResponse(
        provenance="GUIDELINE_AI",
        safety_checked=True,
        patient_id=patient_id,
        plan=governed_plan,
        sources=sources_schema,
        governor_trace=GovernorTraceSchema(rules_triggered=rules_triggered, clean=is_clean),
        gemini_used=gemini_used,
        demo_fixture=demo_fixture,
        model_name=model_name,
    )


@router.get("/therapy-scenarios", response_model=TherapyScenariosResponse)
def get_therapy_scenarios(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return PROJECTION objects for permitted therapy options based ONLY on literature.
    Never passes these values to the trained twin models.
    """
    patient = verify_patient_access(patient_id, current_user, db)

    # Always generate fresh governed plan for active patient from recommendation bank
    patient_context = _build_patient_clinical_context(patient, db)
    snippets = retrieve_guidelines(patient_context, top_k=4)
    raw_plan, gemini_used, demo_fixture, _ = generate_clinical_plan(patient_context, snippets, db)
    plan, _ = run_safety_governor(
        raw_plan, patient_context, get_known_guideline_ids(), gemini_used, demo_fixture
    )

    scenarios: List[TherapyScenarioItem] = []
    for opt in plan.get("therapy_options", []):
        lit_text = opt.get("expected_effect_literature", "")
        parsed_range = _extract_literature_range(lit_text)
        scenarios.append(
            TherapyScenarioItem(
                drug_class=opt.get("drug_class", "unknown"),
                expected_effect_literature=lit_text,
                projection_label="Population-literature projection, not a twin prediction",
                range=parsed_range,
                cautions=opt.get("cautions", []),
                monitoring=opt.get("monitoring", []),
                guideline_ids=opt.get("guideline_ids", []),
                provenance="PROJECTION",
            )
        )

    log_audit_rbac(
        db=db,
        user_id=current_user.id,
        action="therapy_scenarios",
        resource_type="therapy_scenarios",
        resource_id=patient_id,
        patient_id=patient_id,
    )

    return TherapyScenariosResponse(patient_id=patient_id, scenarios=scenarios)


@router.post("/plan", response_model=CombinedPlanResponse)
def generate_combined_4week_plan(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate combined 4-week personalized care plan:
    - Lifestyle focus items (GUIDELINE_AI)
    - Twin-based meal response advice (TWIN_PREDICTED)
    - Structured glucose monitoring (GUIDELINE_AI)
    - Clinician review point (GUIDELINE_AI)
    Every item carries its own provenance.
    """
    patient = verify_patient_access(patient_id, current_user, db)


    patient_context = _build_patient_clinical_context(patient, db)
    snippets = retrieve_guidelines(patient_context, top_k=4)
    raw_plan, gemini_used, demo_fixture, model_name = generate_clinical_plan(patient_context, snippets, db)
    plan, rules_triggered = run_safety_governor(
        raw_plan, patient_context, get_known_guideline_ids(), gemini_used, demo_fixture
    )

    # Compute twin predictions for a representative baseline meal vs intervention
    memory_info = compute_memory(patient_id, db)
    base_features = {
        "carbs_g": 55.0,
        "protein_g": 20.0,
        "fat_g": 15.0,
        "fibre_g": 3.0,
        "calories": 435.0,
        "hour_sin": 0.0,
        "hour_cos": -1.0,  # 12:00 midday
        "pre_glucose": patient.fasting_glucose_mgdl or 110.0,
        "pre_trend30": 0.0,
        "mem_mean_rise": memory_info["mem_mean_rise"],
        "mem_mean_iauc": memory_info["mem_mean_iauc"],
        "mem_n": memory_info["mem_n"],
    }
    twin_pred_base = predict_meal(base_features)

    # Intervention features: 30% carb reduction (38.5g carbs)
    interv_features = dict(base_features)
    interv_features["carbs_g"] = 38.5
    interv_features["calories"] = round(38.5 * 4 + 20 * 4 + 15 * 9, 1)
    twin_pred_interv = predict_meal(interv_features)

    base_rise = round(twin_pred_base["median"], 1)
    interv_rise = round(twin_pred_interv["median"], 1)
    gain_mgdl = round(base_rise - interv_rise, 1)

    lifestyle_list = plan.get("lifestyle_interventions", [])
    life1 = lifestyle_list[0] if len(lifestyle_list) > 0 else {
        "title": "Post-Meal Gentle Walking",
        "detail": "Engage in a 10 to 15 minute walk after meals.",
    }
    life2 = lifestyle_list[1] if len(lifestyle_list) > 1 else {
        "title": "Complex Carbohydrate & Fiber Replacement",
        "detail": "Choose legumes and non-starchy vegetables.",
    }

    # Build personalized 4-week items from 100+ item recommendation bank
    raw_weeks = get_personalized_week_plan(
        patient_id, base_rise, interv_rise, gain_mgdl, twin_pred_base
    )
    weeks: List[WeekPlan] = []
    for w in raw_weeks:
        p_items = [
            PlanItem(
                title=it["title"],
                detail=it["detail"],
                provenance=it.get("provenance", "GUIDELINE_AI"),
                category=it.get("category", "lifestyle"),
                metadata=it.get("metadata"),
            )
            for it in w["items"]
        ]
        weeks.append(WeekPlan(
            week_number=w["week_number"],
            focus_theme=w["focus_theme"],
            items=p_items,
        ))

    # Save to recommendations
    combined_payload = {
        "weeks": [w.model_dump() for w in weeks],
        "patient_id": patient_id,
    }
    rec = Recommendation(
        patient_id=patient_id,
        kind="combined_plan",
        provenance="GUIDELINE_AI",
        safety_checked=True,
        payload=combined_payload,
        governor_result={"rules_triggered": rules_triggered},
    )
    db.add(rec)
    db.commit()

    # Log audit event
    log_audit_event(
        db=db,
        endpoint=f"/patients/{patient_id}/plan",
        inputs_hash=hashlib.sha256(f"plan_{patient_id}".encode()).hexdigest(),
        patient_id=patient_id,
        model_version=get_model_version(),
        rules_triggered=rules_triggered,
        gemini_model=model_name,
        gemini_used=gemini_used,
    )
    log_audit_rbac(
        db=db,
        user_id=current_user.id,
        action="combined_plan",
        resource_type="combined_plan",
        resource_id=rec.id,
        patient_id=patient_id,
    )

    return CombinedPlanResponse(
        patient_id=patient_id,
        provenance="GUIDELINE_AI",
        safety_checked=True,
        weeks=weeks,
    )
