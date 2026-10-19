import hashlib
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.clinical.fallback import get_fallback_plan
from app.clinical.prompts import SYSTEM_PROMPT, build_user_message
from app.config import settings
from app.models_db import LLMCache
from app.schemas import ClinicalPlanSchema

logger = logging.getLogger(__name__)


def get_canned_fixture(
    patient_data: Dict[str, Any], retrieved_snippets: List[Dict[str, str]]
) -> Dict[str, Any]:
    """
    Produce a realistic, schema-valid canned clinical decision support fixture.
    Stamped with demo_fixture=True.
    """
    available_snippet_ids = [s["id"] for s in retrieved_snippets]

    # Select appropriate guideline IDs matching retrieved snippets
    met_id = ["G-MET-01"] if "G-MET-01" in available_snippet_ids else (available_snippet_ids[:1] if available_snippet_ids else ["G-MET-01"])
    sglt2_id = ["G-SGLT2-01"] if "G-SGLT2-01" in available_snippet_ids else (available_snippet_ids[:1] if available_snippet_ids else ["G-SGLT2-01"])
    glp1_id = ["G-GLP1-01"] if "G-GLP1-01" in available_snippet_ids else (available_snippet_ids[:1] if available_snippet_ids else ["G-GLP1-01"])
    dpp4_id = ["G-DPP4-01"] if "G-DPP4-01" in available_snippet_ids else (available_snippet_ids[:1] if available_snippet_ids else ["G-DPP4-01"])

    options = [
        {
            "drug_class": "metformin",
            "rationale": "Recommended as first-line pharmacotherapy for glycemic management given proven efficacy, durable safety profile, and absence of intrinsic hypoglycemia risk.",
            "patient_factors_used": ["Type 2 diabetes diagnosis", "Need for foundational glycemic optimization"],
            "expected_effect_literature": "Typical population-level reduction in HbA1c of 1.0% to 1.5%",
            "cautions": ["Assess baseline renal filtration; titrate with substantial meals to reduce GI disturbance"],
            "monitoring": ["Estimated glomerular filtration rate (eGFR)", "Serum creatinine annually"],
            "guideline_ids": met_id,
        },
        {
            "drug_class": "sglt2_inhibitor",
            "rationale": "Provides glycemic control by promoting urinary glucose excretion while conferring significant cardiorenal and nephroprotective benefits.",
            "patient_factors_used": ["Renal risk consideration", "Need for insulin-independent glycemic reduction"],
            "expected_effect_literature": "Typical population-level reduction in HbA1c of 0.5% to 0.9% alongside cardiorenal risk reduction",
            "cautions": ["Maintain adequate hydration; monitor for mycotic infections"],
            "monitoring": ["eGFR", "Blood pressure", "Volume status"],
            "guideline_ids": sglt2_id,
        },
        {
            "drug_class": "glp1_receptor_agonist",
            "rationale": "Enhances glucose-dependent insulin secretion, decelerates gastric emptying, and promotes substantial weight reduction in overweight or obese patients.",
            "patient_factors_used": ["Elevated BMI", "Postprandial glycemic excursions"],
            "expected_effect_literature": "Typical population-level reduction in HbA1c of 1.0% to 1.8% and body weight reduction of 3 to 7 kg",
            "cautions": ["Gradual titration to mitigate nausea; history of pancreatitis requires caution"],
            "monitoring": ["Gastrointestinal tolerance", "Body weight progression"],
            "guideline_ids": glp1_id,
        },
        {
            "drug_class": "dpp4_inhibitor",
            "rationale": "Offers intermediate glycemic control with exceptional tolerability, weight neutrality, and minimal risk of hypoglycemia.",
            "patient_factors_used": ["Prioritization of hypoglycemia avoidance"],
            "expected_effect_literature": "Typical population-level reduction in HbA1c of 0.5% to 0.8%",
            "cautions": ["Renal dose adjustment necessary for most agents in this class"],
            "monitoring": ["Renal function biomarkers"],
            "guideline_ids": dpp4_id,
        },
    ]

    lifestyle = [
        {
            "title": "Post-Meal 15-Minute Light Physical Activity",
            "detail": "Undertake a gentle 10 to 15 minute walk following larger meals to facilitate GLUT-4 mediated non-insulin glucose uptake.",
            "linked_twin_finding": "Attenuates acute postprandial glycemic rises",
        },
        {
            "title": "Carbohydrate Quality and Dietary Fiber Integration",
            "detail": "Prioritize high-fiber legumes, vegetables, and intact whole grains while moderating portion sizes and timing.",
            "linked_twin_finding": "Smooths postprandial glucose curve and extends satiety",
        },
    ]

    return {
        "therapy_options": options,
        "lifestyle_interventions": lifestyle,
        "red_flags": [
            "Baseline kidney assessment (eGFR) and comprehensive clinical review required before selecting pharmacotherapy."
        ],
        "questions_for_clinician": [
            "What individualized glycemic and HbA1c target is most appropriate for this patient's profile?",
            "Are there symptoms or history of undocumented hypoglycemic events during daily routines?",
            "What is the patient's recent renal function panel (eGFR and albuminuria)?",
        ],
        "missing_information": [
            "Current comprehensive renal panel (eGFR, serum creatinine).",
            "Recent urine albumin-to-creatinine ratio (uACR).",
        ],
        "patient_summary": "Your clinical overview indicates opportunities to improve glucose stability through combined lifestyle and therapy adjustments. Gentle 10 to 15 minute walks following meals can support natural glucose uptake. Incorporating more fiber-rich whole foods helps smooth your digestion. Please discuss any potential medication options with your clinician to tailor your care safely.",
        "fallback": False,
        "demo_fixture": True,
    }


def get_cached_response(db: Session, hash_key: str) -> Optional[Dict[str, Any]]:
    """Retrieve cached LLM response by SHA-256 hash."""
    try:
        row = db.query(LLMCache).filter(LLMCache.hash_key == hash_key).first()
        if row and isinstance(row.response_json, dict):
            return row.response_json
    except Exception as e:
        logger.warning(f"Failed to query llm_cache: {e}")
    return None


def store_cached_response(
    db: Session, hash_key: str, request_prompt: str, response_json: Dict[str, Any]
) -> None:
    """Store LLM response in llm_cache table."""
    try:
        cache_entry = LLMCache(
            hash_key=hash_key,
            request_prompt=request_prompt[:2000],
            response_json=response_json,
        )
        db.merge(cache_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"Failed to store into llm_cache: {e}")


def _call_gemini_api(system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    """
    Call Gemini API via google-generativeai with exponential backoff retry.
    """
    import google.generativeai as genai

    genai.configure(api_key=settings.gemini_api_key)

    try:
        gen_config = genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.2,
        )
    except Exception:
        gen_config = {"response_mime_type": "application/json", "temperature": 0.2}

    model = genai.GenerativeModel(
        model_name=settings.gemini_model,
        system_instruction=system_prompt,
        generation_config=gen_config,
    )

    last_exc = None
    for attempt in range(2):
        try:
            response = model.generate_content(user_prompt)
            raw_text = response.text.strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

            parsed = json.loads(raw_text)
            # Schema verification
            ClinicalPlanSchema(**parsed)
            return parsed
        except Exception as exc:
            last_exc = exc
            logger.warning(f"Gemini call attempt {attempt+1} failed: {exc}")
            if attempt == 0:
                time.sleep(1.0)  # Exponential backoff

    raise last_exc or RuntimeError("Gemini API calls failed after retry")


def generate_clinical_plan(
    patient_data: Dict[str, Any],
    retrieved_snippets: List[Dict[str, str]],
    db: Session,
) -> Tuple[Dict[str, Any], bool, bool, Optional[str]]:
    """
    Generate clinical plan using Gemini, cached SQLite response, or canned demo fixture.
    Returns: (raw_plan_dict, gemini_used, demo_fixture, model_name)
    """
    user_prompt = build_user_message(patient_data, retrieved_snippets)
    full_request = f"{SYSTEM_PROMPT}\n---\n{user_prompt}"
    hash_key = hashlib.sha256(full_request.encode("utf-8")).hexdigest()

    # 1. Check cache first
    cached = get_cached_response(db, hash_key)
    if cached is not None:
        logger.info(f"LLM cache hit for hash {hash_key[:8]}")
        is_demo = cached.get("demo_fixture", False)
        return cached, not is_demo, is_demo, settings.gemini_model

    # 2. Check if MOCK_GEMINI is True or API key missing
    if settings.mock_gemini or not settings.gemini_api_key.strip():
        logger.info("Using canned schema-valid fixture (MOCK_GEMINI=True or no API key)")
        fixture = get_canned_fixture(patient_data, retrieved_snippets)
        store_cached_response(db, hash_key, full_request, fixture)
        return fixture, False, True, "mock-gemini"

    # 3. Call live Gemini API with retry
    try:
        plan_dict = _call_gemini_api(SYSTEM_PROMPT, user_prompt)
        plan_dict["demo_fixture"] = False
        plan_dict["fallback"] = False
        store_cached_response(db, hash_key, full_request, plan_dict)
        return plan_dict, True, False, settings.gemini_model
    except Exception as exc:
        logger.error(f"Gemini API failed twice; falling back to demo fixture: {exc}")
        fixture = get_canned_fixture(patient_data, retrieved_snippets)
        return fixture, False, True, settings.gemini_model
