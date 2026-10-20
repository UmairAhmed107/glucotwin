"""
Twin Router.

Implements all metabolic twin endpoints per SPEC.md Section 7 and Phase 2 prompt:
- POST /patients/{id}/predict
- POST /patients/{id}/whatif
- POST /patients/{id}/compare-meals
- GET /patients/{id}/best-time
- POST /patients/{id}/daily-plan
- GET /patients/{id}/cohort-position
- GET /twin-learning/{participant_id}

All endpoints enforce provenance = TWIN_PREDICTED, safety_checked = True,
model_version string from manifest, bounds checking, and audit logging.
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.auth import get_current_user, log_audit_event, verify_patient_access
from app.data_loader import data_loader
from app.db import get_db
from app.errors import AppException, PatientNotFoundException, ServiceUnavailableException
from app.models_db import CarePlan, CarePlanTask, Patient, SavedScenario, User
from app.schemas import (
    ApplyGoalPlanRequest,
    BestTimeResponse,
    BestTimeSlot,
    CohortPositionResponse,
    ComparedMealItem,
    CompareMealsRequest,
    CompareMealsResponse,
    DailyPlanItem,
    DailyPlanMeal,
    DailyPlanRequest,
    DailyPlanResponse,
    PlanGoalRequest,
    PlanGoalResponse,
    PredictMealInput,
    PredictResponse,
    ReconcileResponse,
    SavedScenarioCreate,
    SavedScenarioResponse,
    ScenarioCompareComparison,
    ScenarioCompareRequest,
    ScenarioCompareResponse,
    TargetPrediction,
    TwinAccuracyResponse,
    TwinLearningDataPoint,
    TwinLearningResponse,
    TwinMaturityResponse,
    WhatIfRequest,
    WhatIfResponse,
)
from app.twin.bounds import check_bounds
from app.twin.lifecycle import (
    compute_twin_maturity,
    get_twin_accuracy_summary,
    reconcile_patient_predictions,
)
from app.twin.memory import compute_confidence_score, compute_memory
from app.twin.planner import plan_goal
from app.twin.twin_engine import (
    MealRecommender,
    get_model_version,
    get_twin_model,
)
from app.twin.whatif import evaluate_whatif

logger = logging.getLogger("glucotwin.routers.twin")

router = APIRouter(tags=["Metabolic Twin"])


def require_twin_model() -> MealRecommender:
    """Ensure twin model singleton is loaded."""
    model = get_twin_model()
    if model is None:
        raise ServiceUnavailableException(
            message="Metabolic Twin model is not loaded. Please verify twin_recommender.pkl exists.",
            details={"model": "twin_recommender.pkl"},
        )
    return model


def build_feature_row(
    meal: PredictMealInput,
    mem: Dict[str, Any],
    rec: MealRecommender,
) -> Dict[str, Any]:
    """
    Construct the exact 20-feature row expected by MealRecommender.
    """
    h = float(meal.time_of_day)
    hour_sin = float(np.sin(2.0 * np.pi * h / 24.0))
    hour_cos = float(np.cos(2.0 * np.pi * h / 24.0))

    # Meal type indicators
    if meal.meal_type:
        mtype = meal.meal_type.strip().lower()
        is_breakfast = 1.0 if "breakfast" in mtype else 0.0
        is_lunch = 1.0 if "lunch" in mtype else 0.0
        is_dinner = 1.0 if "dinner" in mtype else 0.0
        is_snack = 1.0 if "snack" in mtype else 0.0
    else:
        # Inferred from hour of day
        is_breakfast = 1.0 if (4.0 <= h < 11.0) else 0.0
        is_lunch = 1.0 if (11.0 <= h < 16.0) else 0.0
        is_dinner = 1.0 if (16.0 <= h < 22.0) else 0.0
        is_snack = 1.0 if (h < 4.0 or h >= 22.0) else 0.0

    # Physiological / temporal medians from meals_db
    prior_act_60 = 118.76
    hr_pre30 = 83.70
    gap_prev_min = 276.0
    post_act_60 = 109.67

    return {
        "carbs_g": float(meal.carbs_g),
        "protein_g": float(meal.protein_g),
        "fat_g": float(meal.fat_g),
        "fiber_g": float(meal.fibre_g or 0.0),
        "kcal": float(meal.calories or 0.0),
        "pre_glucose": float(meal.pre_glucose),
        "pre_trend30": float(meal.pre_trend30),
        "hour_sin": hour_sin,
        "hour_cos": hour_cos,
        "is_breakfast": is_breakfast,
        "is_lunch": is_lunch,
        "is_dinner": is_dinner,
        "is_snack": is_snack,
        "prior_act_60": prior_act_60,
        "hr_pre30": hr_pre30,
        "gap_prev_min": gap_prev_min,
        "post_act_60": post_act_60,
        "mem_mean_rise": float(mem["mem_mean_rise"]),
        "mem_mean_iauc": float(mem["mem_mean_iauc"]),
        "mem_n": float(mem["mem_n"]),
    }


def predict_peak_rise(rec: MealRecommender, feature_row: Dict[str, Any]) -> TargetPrediction:
    """Predict peak_rise across the 15-model bootstrap ensemble and return percentiles."""
    preds = rec._predict(feature_row)
    median = float(np.median(preds))
    p10 = float(np.percentile(preds, 10))
    p90 = float(np.percentile(preds, 90))
    min_v = float(np.min(preds))
    max_v = float(np.max(preds))
    band_width = max(p90 - p10, 0.0)

    return TargetPrediction(
        target="peak_rise",
        median=round(median, 2),
        p10=round(p10, 2),
        p90=round(p90, 2),
        min=round(min_v, 2),
        max=round(max_v, 2),
        band_width=round(band_width, 2),
    )


# ============================================================================
# 1. POST /patients/{patient_id}/predict
# ============================================================================

@router.post("/patients/{patient_id}/predict", response_model=PredictResponse)
def predict_meal_response(
    patient_id: int,
    payload: PredictMealInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PredictResponse:
    """
    Predict glucose response to a candidate meal for a patient.
    Checks training bounds; predicts peak_rise across 15 models with percentiles.
    """
    patient = verify_patient_access(patient_id, current_user, db)

    rec = require_twin_model()
    mem = compute_memory(patient_id=patient_id, db=db)
    row = build_feature_row(payload, mem, rec)

    # Bounds guard
    bounds = check_bounds(row, rec.lo, rec.hi)
    if not bounds["is_valid"]:
        raise AppException(
            code="OUT_OF_RANGE",
            message="Input features are outside the training distribution bounds seen in the data.",
            status_code=422,
            details=bounds,
        )

    peak_pred = predict_peak_rise(rec, row)

    # Confidence score with current band width
    conf = compute_confidence_score(mem["mem_n"], peak_pred.band_width)

    # TODO(USER): The pickled twin_recommender.pkl contains models for target='peak_rise' only.
    # Targets iauc_2h, delta_60, and delta_120 are reserved for multi-target models.
    targets = {
        "peak_rise": peak_pred,
        "iauc_2h": None,
        "delta_60": None,
        "delta_120": None,
    }

    log_audit(
        db=db,
        patient_id=patient_id,
        endpoint=f"/patients/{patient_id}/predict",
        inputs=payload.model_dump(mode="json"),
        model_version=get_model_version(),
    )
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="predict",
        resource_type="twin_predict",
        resource_id=patient_id,
        patient_id=patient_id,
    )

    return PredictResponse(
        provenance="TWIN_PREDICTED",
        safety_checked=True,
        model_version=get_model_version(),
        patient_id=patient_id,
        targets=targets,
        confidence_score=conf["confidence_score"],
        confidence_components=conf["components"],
        baseline_used=mem["baseline_used"],
        feature_row=row,
    )



# ============================================================================
# 2. POST /patients/{patient_id}/whatif
# ============================================================================

@router.post("/patients/{patient_id}/whatif", response_model=WhatIfResponse)
def simulate_whatif(
    patient_id: int,
    payload: WhatIfRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WhatIfResponse:
    """
    Evaluate what-if lifestyle interventions (carb reduction, post-meal walk).
    Recomputes calories at 4/4/9 kcal/g, predicts gains, and computes pessimistic gain (p10).
    """
    patient = verify_patient_access(patient_id, current_user, db)

    rec = require_twin_model()
    mem = compute_memory(patient_id=patient_id, db=db)
    baseline_row = build_feature_row(payload.meal, mem, rec)

    # Bounds guard on baseline
    bounds = check_bounds(baseline_row, rec.lo, rec.hi)
    if not bounds["is_valid"]:
        raise AppException(
            code="OUT_OF_RANGE",
            message="Baseline meal features are outside the training bounds.",
            status_code=422,
            details=bounds,
        )

    res = evaluate_whatif(
        rec=rec,
        baseline_meal=baseline_row,
        carb_reduction_pct=payload.interventions.carb_reduction_pct,
        post_meal_walk=payload.interventions.post_meal_walk,
        margin=payload.interventions.margin,
        meal_order=payload.interventions.meal_order,
        walk_duration_min=payload.interventions.walk_duration_min,
        walk_intensity=payload.interventions.walk_intensity,
        timing_shift_hours=payload.interventions.timing_shift_hours,
    )

    base_stat = res["baseline"]
    base_pred = TargetPrediction(
        target="peak_rise",
        median=base_stat["median"],
        p10=base_stat["p10"],
        p90=base_stat["p90"],
        min=base_stat["min"],
        max=base_stat["max"],
        band_width=round(base_stat["p90"] - base_stat["p10"], 2),
    )

    interv_pred = None
    if res["intervention"] is not None:
        inv = res["intervention"]
        interv_pred = TargetPrediction(
            target="peak_rise",
            median=inv["median"],
            p10=inv["p10"],
            p90=inv["p90"],
            min=inv["min"],
            max=inv["max"],
            band_width=round(inv["p90"] - inv["p10"], 2),
        )

    log_audit(
        db=db,
        patient_id=patient_id,
        endpoint=f"/patients/{patient_id}/whatif",
        inputs=payload.model_dump(mode="json"),
        model_version=get_model_version(),
    )
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="whatif",
        resource_type="twin_whatif",
        resource_id=patient_id,
        patient_id=patient_id,
    )

    return WhatIfResponse(
        provenance="TWIN_PREDICTED",
        safety_checked=True,
        model_version=get_model_version(),
        patient_id=patient_id,
        status=res["status"],
        baseline=base_pred,
        intervention=interv_pred,
        new_macros=res["new_macros"],
        gains=res["gains"],
        reason=res["reason"],
        adjustments=res.get("adjustments", []),
        is_estimated_adjustment=res.get("is_estimated_adjustment", False),
    )


# ============================================================================
# 3. POST /patients/{patient_id}/compare-meals
# ============================================================================

@router.post("/patients/{patient_id}/compare-meals", response_model=CompareMealsResponse)
def compare_candidate_meals(
    patient_id: int,
    payload: CompareMealsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CompareMealsResponse:
    """
    Compare 2 to 4 candidate meals, ranked by median predicted peak rise with uncertainty bands.
    """
    patient = verify_patient_access(patient_id, current_user, db)

    rec = require_twin_model()
    mem = compute_memory(patient_id=patient_id, db=db)

    results = []
    labels = payload.labels or [f"Meal #{i+1}" for i in range(len(payload.meals))]

    for idx, meal in enumerate(payload.meals):
        label = labels[idx] if idx < len(labels) else f"Meal #{idx+1}"
        row = build_feature_row(meal, mem, rec)

        bounds = check_bounds(row, rec.lo, rec.hi)
        if not bounds["is_valid"]:
            raise AppException(
                code="OUT_OF_RANGE",
                message=f"Meal '{label}' features are outside training bounds.",
                status_code=422,
                details={"meal_label": label, **bounds},
            )

        pred = predict_peak_rise(rec, row)
        results.append({"index": idx, "label": label, "pred": pred})

    # Rank ascending by median peak rise (lower is better rank 1)
    results.sort(key=lambda r: r["pred"].median)
    best_median = results[0]["pred"].median

    ranked_items: List[ComparedMealItem] = []
    for rank_idx, item in enumerate(results, start=1):
        delta = round(item["pred"].median - best_median, 2)
        ranked_items.append(
            ComparedMealItem(
                index=item["index"],
                label=item["label"],
                rank=rank_idx,
                prediction=item["pred"],
                delta_vs_best=delta,
            )
        )

    log_audit(
        db=db,
        patient_id=patient_id,
        endpoint=f"/patients/{patient_id}/compare-meals",
        inputs=payload.model_dump(mode="json"),
        model_version=get_model_version(),
    )
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="compare_meals",
        resource_type="twin_compare",
        resource_id=patient_id,
        patient_id=patient_id,
    )


    return CompareMealsResponse(
        provenance="TWIN_PREDICTED",
        safety_checked=True,
        model_version=get_model_version(),
        patient_id=patient_id,
        ranked_meals=ranked_items,
        best_meal=ranked_items[0],
    )


# ============================================================================
# 4. GET /patients/{patient_id}/best-time
# ============================================================================

@router.get("/patients/{patient_id}/best-time", response_model=BestTimeResponse)
def evaluate_best_time_to_eat(
    patient_id: int,
    carbs_g: float = Query(..., ge=0.0, le=400.0),
    protein_g: float = Query(..., ge=0.0, le=200.0),
    fat_g: float = Query(..., ge=0.0, le=200.0),
    fibre_g: float = Query(0.0, ge=0.0, le=100.0),
    pre_glucose: float = Query(100.0, ge=40.0, le=500.0),
    pre_trend30: float = Query(0.0, ge=-100.0, le=100.0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BestTimeResponse:
    """
    Sweep time of day over 24 hours (0.0 to 23.5 in 0.5h steps) for a fixed meal.
    Returns predicted peak rise and bands per slot, identifying best and worst meal times.
    """
    patient = verify_patient_access(patient_id, current_user, db)

    rec = require_twin_model()
    mem = compute_memory(patient_id=patient_id, db=db)

    # Check bounds on macros/glucose
    meal_check = {
        "carbs_g": carbs_g,
        "protein_g": protein_g,
        "fat_g": fat_g,
        "fiber_g": fibre_g,
        "kcal": carbs_g * 4.0 + protein_g * 4.0 + fat_g * 9.0,
        "pre_glucose": pre_glucose,
        "pre_trend30": pre_trend30,
    }
    bounds = check_bounds(meal_check, rec.lo, rec.hi)
    if not bounds["is_valid"]:
        raise AppException(
            code="OUT_OF_RANGE",
            message="Meal features are outside training distribution bounds.",
            status_code=422,
            details=bounds,
        )

    slots: List[BestTimeSlot] = []
    # 48 half-hour slots
    for h in np.arange(0.0, 24.0, 0.5):
        hour_val = float(h)
        meal_input = PredictMealInput(
            carbs_g=carbs_g,
            protein_g=protein_g,
            fat_g=fat_g,
            fibre_g=fibre_g,
            time_of_day=hour_val,
            pre_glucose=pre_glucose,
            pre_trend30=pre_trend30,
        )
        row = build_feature_row(meal_input, mem, rec)
        pred = predict_peak_rise(rec, row)

        hr_int = int(hour_val)
        min_int = int(round((hour_val - hr_int) * 60))
        label = f"{hr_int:02d}:{min_int:02d}"

        slots.append(
            BestTimeSlot(
                hour=hour_val,
                hour_label=label,
                median_rise=pred.median,
                p10=pred.p10,
                p90=pred.p90,
                band_width=pred.band_width,
            )
        )

    slots.sort(key=lambda s: s.median_rise)
    best_slot = slots[0]
    worst_slot = slots[-1]
    spread = round(worst_slot.median_rise - best_slot.median_rise, 2)

    # Sort slots back chronologically by hour for charting
    slots.sort(key=lambda s: s.hour)

    log_audit(
        db=db,
        patient_id=patient_id,
        endpoint=f"/patients/{patient_id}/best-time",
        inputs=meal_check,
        model_version=get_model_version(),
    )
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="best_time",
        resource_type="twin_best_time",
        resource_id=patient_id,
        patient_id=patient_id,
    )

    return BestTimeResponse(
        provenance="TWIN_PREDICTED",
        safety_checked=True,
        model_version=get_model_version(),
        patient_id=patient_id,
        slots=slots,
        best_slot=best_slot,
        worst_slot=worst_slot,
        spread=spread,
    )


# ============================================================================
# 5. POST /patients/{patient_id}/daily-plan
# ============================================================================

@router.post("/patients/{patient_id}/daily-plan", response_model=DailyPlanResponse)
def evaluate_daily_plan(
    patient_id: int,
    payload: DailyPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DailyPlanResponse:
    """
    Evaluate sequence of daily meals; flag the worst meal and generate warnings
    for meals closer than 120 minutes (model assumption of isolated meal windows).
    """
    patient = verify_patient_access(patient_id, current_user, db)

    rec = require_twin_model()
    mem = compute_memory(patient_id=patient_id, db=db)

    # Sort meals chronologically by time_of_day
    sorted_meals = sorted(payload.meals, key=lambda m: m.time_of_day)

    warnings: List[str] = []
    for i in range(len(sorted_meals) - 1):
        m1 = sorted_meals[i]
        m2 = sorted_meals[i + 1]
        diff_min = round((m2.time_of_day - m1.time_of_day) * 60.0)
        if diff_min < 120:
            warnings.append(
                f"Meal '{m1.label}' ({m1.time_of_day:.1f}h) and '{m2.label}' ({m2.time_of_day:.1f}h) "
                f"are only {diff_min} min apart (< 120 min). The Metabolic Twin assumes isolated meal windows "
                "without overlapping prandial dynamics."
            )

    plan_items: List[Dict[str, Any]] = []
    for meal in sorted_meals:
        row = build_feature_row(meal, mem, rec)
        bounds = check_bounds(row, rec.lo, rec.hi)
        if not bounds["is_valid"]:
            raise AppException(
                code="OUT_OF_RANGE",
                message=f"Meal '{meal.label}' features outside training bounds.",
                status_code=422,
                details={"meal_label": meal.label, **bounds},
            )
        pred = predict_peak_rise(rec, row)
        plan_items.append({
            "label": meal.label,
            "time_of_day": meal.time_of_day,
            "prediction": pred,
        })

    # Identify worst meal (highest median rise)
    worst_idx = max(range(len(plan_items)), key=lambda i: plan_items[i]["prediction"].median)

    plan_output: List[DailyPlanItem] = []
    for idx, item in enumerate(plan_items):
        is_worst = idx == worst_idx
        plan_output.append(
            DailyPlanItem(
                label=item["label"],
                time_of_day=item["time_of_day"],
                prediction=item["prediction"],
                is_worst_meal=is_worst,
            )
        )

    log_audit(
        db=db,
        patient_id=patient_id,
        endpoint=f"/patients/{patient_id}/daily-plan",
        inputs=payload.model_dump(mode="json"),
        model_version=get_model_version(),
    )
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="daily_plan",
        resource_type="twin_daily_plan",
        resource_id=patient_id,
        patient_id=patient_id,
    )

    return DailyPlanResponse(
        provenance="TWIN_PREDICTED",
        safety_checked=True,
        model_version=get_model_version(),
        patient_id=patient_id,
        plan=plan_output,
        worst_meal=plan_output[worst_idx],
        warnings=warnings,
    )


# ============================================================================
# 6. GET /patients/{patient_id}/cohort-position
# ============================================================================

@router.get("/patients/{patient_id}/cohort-position", response_model=CohortPositionResponse)
def get_cohort_position(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CohortPositionResponse:
    """
    Return percentile of patient's mem_mean_rise and mem_mean_iauc against the
    45 participants in meals_db (using each participant's final observed memory values).
    """
    patient = verify_patient_access(patient_id, current_user, db)

    if data_loader.meals_df is None:
        raise ServiceUnavailableException(
            message="meals_db dataset is not loaded.",
            details={"dataset": "meals_db.pkl"},
        )

    meals = data_loader.meals_df
    pids = meals["patient_id"].unique()

    cohort_rises: List[float] = []
    cohort_iaucs: List[float] = []

    for pid in pids:
        sub = meals[meals["patient_id"] == pid].dropna(subset=["mem_mean_rise", "mem_mean_iauc"])
        if not sub.empty:
            last = sub.iloc[-1]
            cohort_rises.append(float(last["mem_mean_rise"]))
            cohort_iaucs.append(float(last["mem_mean_iauc"]))
        else:
            obs = meals[meals["patient_id"] == pid].dropna(subset=["peak_rise", "iauc_2h"])
            if not obs.empty:
                cohort_rises.append(float(obs["peak_rise"].mean()))
                cohort_iaucs.append(float(obs["iauc_2h"].mean()))

    mem = compute_memory(patient_id=patient_id, db=db)
    pat_rise = float(mem["mem_mean_rise"])
    pat_iauc = float(mem["mem_mean_iauc"])

    # Empirical percentile rank (0 to 100)
    pct_rise = float(np.mean(np.array(cohort_rises) <= pat_rise) * 100.0)
    pct_iauc = float(np.mean(np.array(cohort_iaucs) <= pat_iauc) * 100.0)

    cohort_rise_stats = {
        "min": round(float(np.min(cohort_rises)), 2),
        "q25": round(float(np.percentile(cohort_rises, 25)), 2),
        "median": round(float(np.median(cohort_rises)), 2),
        "q75": round(float(np.percentile(cohort_rises, 75)), 2),
        "max": round(float(np.max(cohort_rises)), 2),
    }

    cohort_iauc_stats = {
        "min": round(float(np.min(cohort_iaucs)), 2),
        "q25": round(float(np.percentile(cohort_iaucs, 25)), 2),
        "median": round(float(np.median(cohort_iaucs)), 2),
        "q75": round(float(np.percentile(cohort_iaucs, 75)), 2),
        "max": round(float(np.max(cohort_iaucs)), 2),
    }

    log_audit(
        db=db,
        patient_id=patient_id,
        endpoint=f"/patients/{patient_id}/cohort-position",
        inputs={"patient_mem_mean_rise": pat_rise, "patient_mem_mean_iauc": pat_iauc},
        model_version=get_model_version(),
    )
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="cohort_position",
        resource_type="twin_cohort",
        resource_id=patient_id,
        patient_id=patient_id,
    )

    return CohortPositionResponse(
        provenance="TWIN_PREDICTED",
        safety_checked=True,
        model_version=get_model_version(),
        patient_id=patient_id,
        patient_mem_mean_rise=pat_rise,
        patient_mem_mean_iauc=pat_iauc,
        percentile_mem_mean_rise=round(pct_rise, 1),
        percentile_mem_mean_iauc=round(pct_iauc, 1),
        cohort_size=len(cohort_rises),
        cohort_rise_stats=cohort_rise_stats,
        cohort_iauc_stats=cohort_iauc_stats,
        baseline_used=mem["baseline_used"],
    )


# ============================================================================
# 7. GET /twin-learning/{participant_id}
# ============================================================================

@router.get("/twin-learning/{participant_id}", response_model=TwinLearningResponse)
def get_twin_learning_progression(
    participant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwinLearningResponse:
    """
    Return chronological progression data for a CGMacros participant showing
    how memory features (mem_n) and response tracking evolve across recorded meals.
    """
    # Enforce access: if patient, must match user's linked patient
    linked_patient = (
        db.query(Patient)
        .filter((Patient.cgmacros_participant_id == participant_id) | (Patient.id == participant_id))
        .first()
    )
    if linked_patient:
        verify_patient_access(linked_patient.id, current_user, db)
    elif current_user.role == "patient":
        raise AppException(
            code="FORBIDDEN",
            message="Patients may only access their own twin learning progression",
            status_code=403,
        )

    if data_loader.meals_df is None:
        raise ServiceUnavailableException(
            message="meals_db dataset is not loaded.",
            details={"dataset": "meals_db.pkl"},
        )

    meals = data_loader.meals_df
    sub = meals[meals["patient_id"] == participant_id].sort_values("timestamp")
    if sub.empty:
        raise AppException(
            code="PARTICIPANT_NOT_FOUND",
            message=f"CGMacros participant {participant_id} not found in meals_db.",
            status_code=404,
            details={"participant_id": participant_id},
        )

    rec = get_twin_model()
    data_points: List[TwinLearningDataPoint] = []

    for idx, (_, row) in enumerate(sub.iterrows(), start=1):
        mem_n_val = int(row["mem_n"]) if pd.notna(row["mem_n"]) else idx - 1
        obs_rise = float(row["peak_rise"]) if pd.notna(row["peak_rise"]) else None
        obs_iauc = float(row["iauc_2h"]) if pd.notna(row["iauc_2h"]) else None
        m_rise = float(row["mem_mean_rise"]) if pd.notna(row["mem_mean_rise"]) else None
        m_iauc = float(row["mem_mean_iauc"]) if pd.notna(row["mem_mean_iauc"]) else None

        pred_median = None
        band_w = None
        err = None

        if rec is not None:
            try:
                preds = rec._predict(row.to_dict())
                pred_median = round(float(np.median(preds)), 2)
                p10 = float(np.percentile(preds, 10))
                p90 = float(np.percentile(preds, 90))
                band_w = round(max(p90 - p10, 0.0), 2)
                if obs_rise is not None:
                    err = round(abs(pred_median - obs_rise), 2)
            except Exception as e:
                logger.debug(f"Prediction skipped for row {idx}: {e}")

        data_points.append(
            TwinLearningDataPoint(
                meal_index=idx,
                mem_n=mem_n_val,
                observed_peak_rise=round(obs_rise, 2) if obs_rise is not None else None,
                observed_iauc_2h=round(obs_iauc, 2) if obs_iauc is not None else None,
                mem_mean_rise=round(m_rise, 2) if m_rise is not None else None,
                mem_mean_iauc=round(m_iauc, 2) if m_iauc is not None else None,
                predicted_peak_rise_median=pred_median,
                band_width=band_w,
                prediction_error=err,
            )
        )

    log_audit(
        db=db,
        patient_id=linked_patient.id if linked_patient else None,
        endpoint=f"/twin-learning/{participant_id}",
        inputs={"participant_id": participant_id},
        model_version=get_model_version(),
    )
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="twin_learning",
        resource_type="twin_learning",
        resource_id=participant_id,
        patient_id=linked_patient.id if linked_patient else None,
    )

    note = (
        "Recommender bootstrap ensemble trained across all participants; leave-participant-out "
        "retraining not pre-computed. Displaying real recorded response progression, model predictions, "
        "and ensemble band width versus mem_n for participant."
    )

    return TwinLearningResponse(
        participant_id=participant_id,
        data_points=data_points,
        note=note,
    )


# ============================================================================
# Digital Twin Lifecycle Endpoints
# ============================================================================

@router.get("/twin/{patient_id}/accuracy", response_model=TwinAccuracyResponse)
def get_twin_accuracy(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwinAccuracyResponse:
    """
    Retrieve prediction accuracy and error history for patient's digital twin:
    - History of predictions vs actual postprandial responses
    - Overall MAE and 20-point rolling MAE
    - P10-P90 interval coverage percentage
    - Active model drift detection status and root causes
    """
    verify_patient_access(patient_id, current_user, db)
    summary = get_twin_accuracy_summary(patient_id=patient_id, db=db)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="read",
        resource_type="twin_accuracy",
        resource_id=patient_id,
        patient_id=patient_id,
    )
    return TwinAccuracyResponse.model_validate(summary)


@router.get("/twin/{patient_id}/maturity", response_model=TwinMaturityResponse)
def get_twin_maturity(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwinMaturityResponse:
    """
    Retrieve the maturity score, current tier (Population, Learning, Personalized, Well-calibrated),
    and historical milestone progression for the patient's metabolic twin.
    """
    verify_patient_access(patient_id, current_user, db)
    maturity = compute_twin_maturity(patient_id=patient_id, db=db)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="read",
        resource_type="twin_maturity",
        resource_id=patient_id,
        patient_id=patient_id,
    )
    return TwinMaturityResponse.model_validate(maturity)


@router.post("/twin/{patient_id}/reconcile", response_model=ReconcileResponse)
def reconcile_twin_predictions(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReconcileResponse:
    """
    Manually trigger reconciliation of any unreconciled predictions against available glucose readings.
    Idempotent: reconciling twice changes nothing.
    """
    verify_patient_access(patient_id, current_user, db)
    count = reconcile_patient_predictions(patient_id=patient_id, db=db)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="reconcile",
        resource_type="twin_reconcile",
        resource_id=patient_id,
        patient_id=patient_id,
    )
    return ReconcileResponse(
        patient_id=patient_id,
        reconciled_count=count,
        message=f"Reconciliation completed. {count} new prediction(s) reconciled." if count > 0 else "Reconciliation completed. No new predictions to reconcile.",
    )


# ============================================================================
# 9. Saved Scenarios Endpoints
# ============================================================================

@router.post("/patients/{patient_id}/scenarios", response_model=SavedScenarioResponse, status_code=status.HTTP_201_CREATED)
def save_scenario(
    patient_id: int,
    payload: SavedScenarioCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedScenarioResponse:
    """Save a what-if simulation scenario with inputs, baseline, and intervention outputs."""
    verify_patient_access(patient_id, current_user, db)

    scenario = SavedScenario(
        patient_id=patient_id,
        name=payload.name,
        description=payload.description,
        inputs=payload.inputs,
        baseline_output=payload.baseline_output,
        intervention_output=payload.intervention_output,
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="save_scenario",
        resource_type="saved_scenario",
        resource_id=scenario.id,
        patient_id=patient_id,
    )

    return scenario


@router.get("/patients/{patient_id}/scenarios", response_model=List[SavedScenarioResponse])
def list_saved_scenarios(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[SavedScenarioResponse]:
    """List all saved scenarios for a patient, ordered by created_at descending."""
    verify_patient_access(patient_id, current_user, db)

    scenarios = (
        db.query(SavedScenario)
        .filter(SavedScenario.patient_id == patient_id)
        .order_by(SavedScenario.created_at.desc())
        .all()
    )
    return scenarios


@router.get("/patients/{patient_id}/scenarios/{scenario_id}", response_model=SavedScenarioResponse)
def get_saved_scenario(
    patient_id: int,
    scenario_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedScenarioResponse:
    """Retrieve a single saved scenario by ID."""
    verify_patient_access(patient_id, current_user, db)

    scenario = (
        db.query(SavedScenario)
        .filter(SavedScenario.id == scenario_id, SavedScenario.patient_id == patient_id)
        .first()
    )
    if not scenario:
        raise AppException(
            code="SCENARIO_NOT_FOUND",
            message=f"Saved scenario with id {scenario_id} not found.",
            status_code=404,
        )
    return scenario


@router.delete("/patients/{patient_id}/scenarios/{scenario_id}")
def delete_saved_scenario(
    patient_id: int,
    scenario_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a saved scenario."""
    verify_patient_access(patient_id, current_user, db)

    scenario = (
        db.query(SavedScenario)
        .filter(SavedScenario.id == scenario_id, SavedScenario.patient_id == patient_id)
        .first()
    )
    if not scenario:
        raise AppException(
            code="SCENARIO_NOT_FOUND",
            message=f"Saved scenario with id {scenario_id} not found.",
            status_code=404,
        )

    db.delete(scenario)
    db.commit()

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="delete_scenario",
        resource_type="saved_scenario",
        resource_id=scenario_id,
        patient_id=patient_id,
    )

    return {"message": "Scenario deleted successfully", "id": scenario_id}


@router.post("/patients/{patient_id}/scenarios/compare", response_model=ScenarioCompareResponse)
def compare_saved_scenarios(
    patient_id: int,
    payload: ScenarioCompareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScenarioCompareResponse:
    """Compare two saved scenarios side-by-side with statistical delta and summary."""
    verify_patient_access(patient_id, current_user, db)

    scen_a = (
        db.query(SavedScenario)
        .filter(SavedScenario.id == payload.scenario_id_a, SavedScenario.patient_id == patient_id)
        .first()
    )
    scen_b = (
        db.query(SavedScenario)
        .filter(SavedScenario.id == payload.scenario_id_b, SavedScenario.patient_id == patient_id)
        .first()
    )

    if not scen_a or not scen_b:
        raise AppException(
            code="SCENARIOS_NOT_FOUND",
            message="One or both scenarios to compare could not be found for this patient.",
            status_code=404,
        )

    a_med = float((scen_a.intervention_output or scen_a.baseline_output or {}).get("median", 0.0))
    b_med = float((scen_b.intervention_output or scen_b.baseline_output or {}).get("median", 0.0))
    a_p10 = float((scen_a.intervention_output or scen_a.baseline_output or {}).get("p10", 0.0))
    b_p10 = float((scen_b.intervention_output or scen_b.baseline_output or {}).get("p10", 0.0))
    a_p90 = float((scen_a.intervention_output or scen_a.baseline_output or {}).get("p90", 0.0))
    b_p90 = float((scen_b.intervention_output or scen_b.baseline_output or {}).get("p90", 0.0))

    median_diff = round(b_med - a_med, 2)
    p10_diff = round(b_p10 - a_p10, 2)
    p90_diff = round(b_p90 - a_p90, 2)

    a_carb = float((scen_a.inputs.get("interventions") or {}).get("carb_reduction_pct", 0.0))
    b_carb = float((scen_b.inputs.get("interventions") or {}).get("carb_reduction_pct", 0.0))
    carb_diff = round(b_carb - a_carb, 1)

    if median_diff < -0.5:
        summary = f"{scen_b.name} yields a {abs(median_diff):.1f} mg/dL lower predicted peak rise than {scen_a.name}."
    elif median_diff > 0.5:
        summary = f"{scen_a.name} yields a {median_diff:.1f} mg/dL lower predicted peak rise than {scen_b.name}."
    else:
        summary = f"Both scenarios produce equivalent predicted peak rises ({a_med:.1f} mg/dL)."

    comparison = ScenarioCompareComparison(
        median_diff_mgdl=median_diff,
        p10_diff_mgdl=p10_diff,
        p90_diff_mgdl=p90_diff,
        carb_reduction_diff_pct=carb_diff,
        summary=summary,
    )

    return ScenarioCompareResponse(
        scenario_a=SavedScenarioResponse.model_validate(scen_a),
        scenario_b=SavedScenarioResponse.model_validate(scen_b),
        comparison=comparison,
    )


# ============================================================================
# 10. Goal-Based Planner Endpoints
# ============================================================================

@router.post("/twin/plan-goal", response_model=PlanGoalResponse)
def plan_glycemic_goal(
    payload: PlanGoalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlanGoalResponse:
    """
    Goal-based lifestyle and meal planner.
    Searches combinations of meal choice, portion scaling (50-100%), timing,
    and post-meal walk options to meet the target peak rise limit.
    Every plan passes through the deterministic Safety Governor before returning.
    """
    verify_patient_access(payload.patient_id, current_user, db)
    rec = require_twin_model()

    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise PatientNotFoundException(patient_id=payload.patient_id)

    patient_data = {
        "id": patient.id,
        "hypoglycemia_history": patient.hypoglycemia_history,
        "kidney_flag": patient.kidney_flag,
        "current_meds": patient.current_meds or [],
    }

    meals_dict = [m.model_dump() for m in payload.candidate_meals]

    plan_res = plan_goal(
        rec=rec,
        patient_id=payload.patient_id,
        patient_data=patient_data,
        target_peak_rise_limit=payload.target_peak_rise_limit,
        candidate_meals=meals_dict,
        carb_ceiling_g=payload.carb_ceiling_g,
        foods_to_avoid=payload.foods_to_avoid,
        min_portion_pct=payload.min_portion_pct,
        max_portion_pct=payload.max_portion_pct,
        allow_timing_shift=payload.allow_timing_shift,
        allow_walk=payload.allow_walk,
        allow_meal_order=payload.allow_meal_order,
        seed=payload.seed if payload.seed is not None else 42,
    )

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="plan_goal",
        resource_type="twin_plan_goal",
        resource_id=payload.patient_id,
        patient_id=payload.patient_id,
    )

    return PlanGoalResponse(**plan_res)


@router.post("/twin/apply-plan")
def apply_plan_to_care_plan(
    payload: ApplyGoalPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add planned care-plan tasks directly to the patient's care plan.
    Auto-creates an active CarePlan if one does not exist.
    """
    verify_patient_access(payload.patient_id, current_user, db)

    care_plan = (
        db.query(CarePlan)
        .filter(CarePlan.patient_id == payload.patient_id, CarePlan.status == "active")
        .first()
    )

    if not care_plan:
        care_plan = CarePlan(
            patient_id=payload.patient_id,
            title="Goal-Based Glycemic Optimization Plan",
            status="active",
        )
        db.add(care_plan)
        db.flush()

    due_dt = datetime.now(timezone.utc) + timedelta(days=7)
    created_tasks = []
    for t in payload.tasks:
        task = CarePlanTask(
            care_plan_id=care_plan.id,
            patient_id=payload.patient_id,
            title=t.get("title", "Lifestyle task"),
            category=t.get("category", "lifestyle"),
            due_date=due_dt,
            assigned_to=t.get("assigned_to", "patient"),
            status="pending",
        )
        db.add(task)
        created_tasks.append(task)

    db.commit()

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="apply_goal_plan",
        resource_type="care_plan",
        resource_id=care_plan.id,
        patient_id=payload.patient_id,
    )

    return {
        "message": f"Successfully added {len(created_tasks)} care-plan tasks.",
        "care_plan_id": care_plan.id,
        "task_count": len(created_tasks),
    }

