import json
from typing import Any, Dict, List

SYSTEM_PROMPT = """You are a clinical decision-support assistant inside a research prototype.
Use ONLY the patient JSON and guideline excerpts provided.
Return a single JSON object matching the schema. No markdown, no extra text.
Rules:
- Suggest therapy CLASSES to discuss with a clinician, never doses or brand instructions.
- Do not invent patient data. If something needed is missing, list it in missing_information.
- Do not state numeric predictions about this patient. Only describe typical population-level effects and label them as such.
- Reference guideline_ids for every therapy option.
- Respect hypoglycaemia_history and kidney_flag in your reasoning.
- Phrase everything as options for a clinician to review.
Also produce patient_summary: 4-6 plain-language sentences for the patient, no jargon, no numbers about their future glucose, no doses."""

SCHEMA_INSTRUCTIONS = """
Expected JSON Schema:
{
  "therapy_options": [
    {
      "drug_class": "one of: metformin, sglt2_inhibitor, glp1_receptor_agonist, dpp4_inhibitor, thiazolidinedione, sulfonylurea, basal_insulin",
      "rationale": "clinical explanation linked to patient characteristics",
      "patient_factors_used": ["e.g. elevated HbA1c", "elevated BMI"],
      "expected_effect_literature": "population literature effect, e.g. Typical reduction in HbA1c of 1.0% to 1.5%",
      "cautions": ["safety cautions or contraindications"],
      "monitoring": ["parameters to monitor, e.g. eGFR, liver enzymes"],
      "guideline_ids": ["matching IDs from provided guideline excerpts"]
    }
  ],
  "lifestyle_interventions": [
    {
      "title": "intervention title",
      "detail": "practical lifestyle instruction without dosing",
      "linked_twin_finding": "optional twin memory insight or null"
    }
  ],
  "red_flags": ["critical safety warnings or alert conditions"],
  "questions_for_clinician": ["specific discussion questions for the next clinical appointment"],
  "missing_information": ["relevant clinical assessments not yet available in profile"],
  "patient_summary": "4-6 plain-language sentences for the patient, no jargon, no numbers about their future glucose, no doses"
}
"""


def build_user_message(patient_data: Dict[str, Any], retrieved_snippets: List[Dict[str, str]]) -> str:
    """
    Build user message from patient JSON and retrieved guideline excerpts.
    """
    # Clean patient representation
    patient_json = {
        "demographics": {
            "age": patient_data.get("age"),
            "sex": patient_data.get("sex"),
            "bmi": patient_data.get("bmi"),
        },
        "clinical_labs": {
            "hba1c_pct": patient_data.get("hba1c_pct"),
            "fasting_glucose_mgdl": patient_data.get("fasting_glucose_mgdl"),
        },
        "risk_flags": {
            "hypoglycemia_history": (
                "true" if patient_data.get("hypoglycemia_history") is True
                else ("false" if patient_data.get("hypoglycemia_history") is False else "unknown")
            ),
            "kidney_flag": bool(patient_data.get("kidney_flag", False)),
        },
        "current_medication_classes": patient_data.get("current_meds", []),
        "twin_summary": patient_data.get("twin_summary", {}),
    }

    snippets_text = "\n\n".join(
        f"--- Guideline ID: {s['id']} ---\nTopic: {s['topic']}\nExcerpt:\n{s['text']}"
        for s in retrieved_snippets
    )

    user_message = f"""### PATIENT DATA:
{json.dumps(patient_json, indent=2)}

### RETRIEVED GUIDELINE EXCERPTS:
{snippets_text}

### OUTPUT FORMAT:
{SCHEMA_INSTRUCTIONS}

Return ONLY the raw JSON object. Do not include markdown code block syntax (such as ```json).
"""
    return user_message
