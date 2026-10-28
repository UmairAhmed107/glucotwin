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


from app.clinical.recommendation_bank import generate_personalized_canned_fixture


def get_canned_fixture(
    patient_data: Dict[str, Any], retrieved_snippets: List[Dict[str, str]]
) -> Dict[str, Any]:
    """
    Produce a rich, diverse, patient-specific clinical decision support fixture
    selected deterministically from a comprehensive bank of 100+ clinical items.
    Stamped with demo_fixture=True.
    """
    return generate_personalized_canned_fixture(patient_data, retrieved_snippets)



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

    # 1. Check cache first (only for live non-demo LLM responses)
    cached = get_cached_response(db, hash_key)
    if cached is not None:
        is_demo = cached.get("demo_fixture", False)
        if not is_demo:
            logger.info(f"LLM cache hit for hash {hash_key[:8]}")
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
