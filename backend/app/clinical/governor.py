import copy
import re
from typing import Any, Dict, List, Optional, Tuple

from app.clinical.fallback import get_fallback_plan


ALLOWED_DRUG_CLASSES = [
    "metformin",
    "sglt2_inhibitor",
    "glp1_receptor_agonist",
    "dpp4_inhibitor",
    "thiazolidinedione",
    "sulfonylurea",
    "basal_insulin",
]

# R3: Dosing language patterns
DOSING_PATTERNS = [
    re.compile(r"\b\d+(\.\d+)?\s?(mg|mcg|g|units?|iu|ml)\b", re.IGNORECASE),
    re.compile(r"\btwice daily\b", re.IGNORECASE),
    re.compile(r"\bonce daily\b", re.IGNORECASE),
    re.compile(r"\bstart (with|on)\b", re.IGNORECASE),
    re.compile(r"\bprescribe\b", re.IGNORECASE),
    re.compile(r"\btake \d\b", re.IGNORECASE),
]

# R8: Patient-specific numeric glucose predictions patterns
PREDICTION_PATTERNS = [
    re.compile(r"\byour (?:glucose|blood sugar)\b[^.!?]*\d+", re.IGNORECASE),
    re.compile(r"\bpatient'?s? (?:glucose|blood sugar)\b[^.!?]*\d+", re.IGNORECASE),
    re.compile(r"\b(?:will|should)\s+(?:reach|rise to|drop to|be)\s+\d+\s*(?:mg/dl|mmol/l)?", re.IGNORECASE),
]


def _has_dosing_language(text: str) -> bool:
    if not text:
        return False
    return any(p.search(text) for p in DOSING_PATTERNS)


def _strip_dosing_sentences(text: str) -> Tuple[str, bool]:
    """Strip any sentence containing dosing language."""
    if not text:
        return text, False
    sentences = re.split(r"(?<=[.!?])\s+", text)
    cleaned = []
    removed = False
    for s in sentences:
        if _has_dosing_language(s):
            removed = True
        else:
            cleaned.append(s)
    return " ".join(cleaned).strip(), removed


def _strip_predictive_sentences(text: str) -> Tuple[str, bool]:
    """Strip any sentence containing patient-specific numeric predictions."""
    if not text:
        return text, False
    sentences = re.split(r"(?<=[.!?])\s+", text)
    cleaned = []
    removed = False
    for s in sentences:
        if any(p.search(s) for p in PREDICTION_PATTERNS):
            removed = True
        else:
            cleaned.append(s)
    return " ".join(cleaned).strip(), removed


def rule_r1_schema_validity(plan_dict: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    R1: Validate plan schema structure. Fallback if invalid.
    """
    if not isinstance(plan_dict, dict):
        return get_fallback_plan(), ["R1_INVALID_SCHEMA"]

    required_keys = [
        "therapy_options",
        "lifestyle_interventions",
        "red_flags",
        "questions_for_clinician",
        "missing_information",
        "patient_summary",
    ]
    for k in required_keys:
        if k not in plan_dict:
            return get_fallback_plan(), ["R1_INVALID_SCHEMA"]

    if not isinstance(plan_dict["therapy_options"], list):
        return get_fallback_plan(), ["R1_INVALID_SCHEMA"]
    if not isinstance(plan_dict["lifestyle_interventions"], list):
        return get_fallback_plan(), ["R1_INVALID_SCHEMA"]
    if not isinstance(plan_dict.get("patient_summary"), str):
        return get_fallback_plan(), ["R1_INVALID_SCHEMA"]

    return copy.deepcopy(plan_dict), []


def rule_r2_allowed_drug_classes(plan_dict: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    R2: drug_class must be in the allowed list; remove others.
    """
    plan = copy.deepcopy(plan_dict)
    options = plan.get("therapy_options", [])
    valid_options = []
    removed = False

    for opt in options:
        drug_class = opt.get("drug_class", "").lower().strip()
        if drug_class in ALLOWED_DRUG_CLASSES:
            valid_options.append(opt)
        else:
            removed = True

    plan["therapy_options"] = valid_options
    rules = ["R2_DISALLOWED_DRUG_CLASS"] if removed else []
    return plan, rules


def rule_r3_no_dosing_language(plan_dict: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    R3: reject/remove any item whose text matches dosing language.
    Also strip dosing sentences from patient_summary.
    """
    plan = copy.deepcopy(plan_dict)
    rules: List[str] = []
    clean_options = []

    for opt in plan.get("therapy_options", []):
        all_text = " ".join([
            opt.get("rationale", ""),
            opt.get("expected_effect_literature", ""),
            " ".join(opt.get("cautions", [])),
            " ".join(opt.get("monitoring", [])),
        ])
        if _has_dosing_language(all_text):
            rules.append("R3_DOSING_LANGUAGE_DETECTED")
        else:
            clean_options.append(opt)
    plan["therapy_options"] = clean_options

    clean_lifestyle = []
    for life in plan.get("lifestyle_interventions", []):
        text = f"{life.get('title', '')} {life.get('detail', '')}"
        if _has_dosing_language(text):
            rules.append("R3_DOSING_LANGUAGE_DETECTED")
        else:
            clean_lifestyle.append(life)
    plan["lifestyle_interventions"] = clean_lifestyle

    # Apply to patient_summary
    summary = plan.get("patient_summary", "")
    new_summary, removed = _strip_dosing_sentences(summary)
    if removed:
        rules.append("R3_DOSING_LANGUAGE_DETECTED")
    plan["patient_summary"] = new_summary

    return plan, list(set(rules))


def rule_r4_hypoglycemia_history(
    plan_dict: Dict[str, Any], patient_data: Dict[str, Any]
) -> Tuple[Dict[str, Any], List[str]]:
    """
    R4: hypoglycemia_history == true: remove sulfonylurea and basal_insulin;
    cap carb-reduction advice at 30%; add red flag.
    """
    if patient_data.get("hypoglycemia_history") is not True:
        return plan_dict, []

    plan = copy.deepcopy(plan_dict)
    rules: List[str] = ["R4_HYPOGLYCEMIA_PROTECTION"]

    # Remove sulfonylurea and basal_insulin
    forbidden = {"sulfonylurea", "basal_insulin"}
    kept_options = [
        opt for opt in plan.get("therapy_options", [])
        if opt.get("drug_class", "").lower().strip() not in forbidden
    ]
    plan["therapy_options"] = kept_options

    # Cap carb reduction advice at 30% in lifestyle interventions
    for item in plan.get("lifestyle_interventions", []):
        detail = item.get("detail", "")
        # Find e.g. "reduce carbs by 40%" or "40% carb reduction"
        detail_capped = re.sub(
            r"(\b[3-9]\d|100)\s*%\s*(carbs|carbohydrates?|carb\s+reduction)",
            "30% \\2",
            detail,
            flags=re.IGNORECASE,
        )
        item["detail"] = detail_capped

    # Add red flag
    red_flag = "High risk of hypoglycemia: sulfonylurea and basal insulin options suppressed; carbohydrate restriction advice capped at 30%."
    if red_flag not in plan.get("red_flags", []):
        plan["red_flags"].append(red_flag)

    return plan, rules


def rule_r4b_hypoglycemia_unknown(
    plan_dict: Dict[str, Any], patient_data: Dict[str, Any]
) -> Tuple[Dict[str, Any], List[str]]:
    """
    R4b: hypoglycemia_history == "unknown" (None / null):
    Do not remove, but demote sulfonylurea/basal_insulin to the end,
    add a caution 'hypoglycaemia history unknown; confirm with the patient',
    and add a question for the clinician.
    """
    hypo_hist = patient_data.get("hypoglycemia_history")
    if hypo_hist is not None:
        return plan_dict, []

    plan = copy.deepcopy(plan_dict)
    options = plan.get("therapy_options", [])
    target_classes = {"sulfonylurea", "basal_insulin"}

    demoted = []
    normal = []
    caution_text = "hypoglycaemia history unknown; confirm with the patient"

    found = False
    for opt in options:
        drug_class = opt.get("drug_class", "").lower().strip()
        if drug_class in target_classes:
            found = True
            cautions = opt.get("cautions", [])
            if caution_text not in cautions:
                cautions.append(caution_text)
            opt["cautions"] = cautions
            demoted.append(opt)
        else:
            normal.append(opt)

    plan["therapy_options"] = normal + demoted

    # Add question for the clinician
    question = "Hypoglycaemia history is unknown: please confirm with the patient whether they have experienced prior episodes of low blood glucose."
    if question not in plan.get("questions_for_clinician", []):
        plan["questions_for_clinician"].append(question)

    return plan, ["R4B_HYPOGLYCEMIA_UNKNOWN_CAUTION"]



def rule_r5_kidney_flag(
    plan_dict: Dict[str, Any], patient_data: Dict[str, Any]
) -> Tuple[Dict[str, Any], List[str]]:
    """
    R5: kidney_flag == true:
    Demote metformin and sglt2_inhibitor and add caution
    'kidney function must be reviewed before considering'; do not delete.

    Design rationale (per SPEC section 9 and clinical practice):
    Metformin and SGLT2 inhibitors are demoted rather than removed, because mild-to-moderate
    renal impairment often permits adjusted dosing or confers significant cardiorenal and
    nephroprotective benefits (especially for SGLT2 inhibitors with albuminuria). However,
    mandatory clinician review of renal biomarkers (eGFR and serum creatinine) is strictly
    warranted before initiation or continuation.
    """
    if not patient_data.get("kidney_flag"):
        return plan_dict, []

    plan = copy.deepcopy(plan_dict)
    options = plan.get("therapy_options", [])
    renal_classes = {"metformin", "sglt2_inhibitor"}

    demoted = []
    normal = []
    caution_text = "kidney function must be reviewed before considering"
    found = False

    for opt in options:
        drug_class = opt.get("drug_class", "").lower().strip()
        if drug_class in renal_classes:
            found = True
            cautions = opt.get("cautions", [])
            if caution_text not in cautions:
                cautions.append(caution_text)
            opt["cautions"] = cautions
            demoted.append(opt)
        else:
            normal.append(opt)

    plan["therapy_options"] = normal + demoted
    rules = ["R5_RENAL_REVIEW_REQUIRED"] if found else []
    return plan, rules


def rule_r6_missing_critical_data(
    plan_dict: Dict[str, Any], patient_data: Dict[str, Any]
) -> Tuple[Dict[str, Any], List[str]]:
    """
    R6: missing HbA1c or age: return fallback plan.
    """
    if patient_data.get("hba1c_pct") is None or patient_data.get("age") is None:
        return get_fallback_plan(patient_data), ["R6_MISSING_CRITICAL_DATA"]
    return plan_dict, []


def rule_r7_guideline_ids(
    plan_dict: Dict[str, Any], known_guideline_ids: List[str]
) -> Tuple[Dict[str, Any], List[str]]:
    """
    R7: every guideline_id must exist in the loaded snippets; remove options with unknown ids.
    """
    plan = copy.deepcopy(plan_dict)
    options = plan.get("therapy_options", [])
    known_set = set(known_guideline_ids)

    valid_options = []
    removed = False

    for opt in options:
        gids = opt.get("guideline_ids", [])
        if not gids or not all(gid in known_set for gid in gids):
            removed = True
        else:
            valid_options.append(opt)

    plan["therapy_options"] = valid_options
    rules = ["R7_UNKNOWN_GUIDELINE_ID"] if removed else []
    return plan, rules


def rule_r8_strip_predictive_glucose(plan_dict: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    R8: strip any sentence containing patient-specific numeric glucose predictions
    (regex such as 'your (glucose|blood sugar)[^.]*\\d').
    Also apply to patient_summary.
    """
    plan = copy.deepcopy(plan_dict)
    rules: List[str] = []

    # Check therapy options
    for opt in plan.get("therapy_options", []):
        cleaned_rat, rem1 = _strip_predictive_sentences(opt.get("rationale", ""))
        cleaned_lit, rem2 = _strip_predictive_sentences(opt.get("expected_effect_literature", ""))
        if rem1 or rem2:
            rules.append("R8_STRIPPED_PREDICTIVE_TEXT")
        opt["rationale"] = cleaned_rat
        opt["expected_effect_literature"] = cleaned_lit

    # Check lifestyle interventions
    for item in plan.get("lifestyle_interventions", []):
        cleaned_det, rem = _strip_predictive_sentences(item.get("detail", ""))
        if rem:
            rules.append("R8_STRIPPED_PREDICTIVE_TEXT")
        item["detail"] = cleaned_det

    # Check patient summary
    summary = plan.get("patient_summary", "")
    new_summary, rem_sum = _strip_predictive_sentences(summary)
    if rem_sum:
        rules.append("R8_STRIPPED_PREDICTIVE_TEXT")
    plan["patient_summary"] = new_summary

    return plan, list(set(rules))


def rule_r9_stamp_output(
    plan_dict: Dict[str, Any],
    rules_triggered: List[str],
    gemini_used: bool = False,
    demo_fixture: bool = False,
) -> Tuple[Dict[str, Any], List[str]]:
    """
    R9: Stamp output: provenance=GUIDELINE_AI, safety_checked=true,
    rules_triggered=[...], gemini_used, demo_fixture.
    """
    plan = copy.deepcopy(plan_dict)
    all_rules = list(dict.fromkeys(rules_triggered + ["R9_SAFETY_STAMPED"]))
    plan["provenance"] = "GUIDELINE_AI"
    plan["safety_checked"] = True
    plan["rules_triggered"] = all_rules
    plan["gemini_used"] = gemini_used
    plan["demo_fixture"] = demo_fixture
    return plan, ["R9_SAFETY_STAMPED"]


def run_safety_governor(
    raw_plan: Dict[str, Any],
    patient_data: Dict[str, Any],
    known_guideline_ids: List[str],
    gemini_used: bool = False,
    demo_fixture: bool = False,
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Master Governor pipeline executing all safety rules sequentially.
    """
    triggered: List[str] = []

    # R6 check first
    plan, r_ids = rule_r6_missing_critical_data(raw_plan, patient_data)
    if r_ids:
        triggered.extend(r_ids)
        plan, stamp_ids = rule_r9_stamp_output(plan, triggered, gemini_used=False, demo_fixture=True)
        return plan, plan["rules_triggered"]

    # R1 schema check
    plan, r_ids = rule_r1_schema_validity(plan)
    if r_ids:
        triggered.extend(r_ids)
        plan, stamp_ids = rule_r9_stamp_output(plan, triggered, gemini_used=False, demo_fixture=True)
        return plan, plan["rules_triggered"]

    # R7 unknown guideline IDs
    plan, r_ids = rule_r7_guideline_ids(plan, known_guideline_ids)
    triggered.extend(r_ids)

    # R2 allowed drug classes
    plan, r_ids = rule_r2_allowed_drug_classes(plan)
    triggered.extend(r_ids)

    # R3 no dosing language
    plan, r_ids = rule_r3_no_dosing_language(plan)
    triggered.extend(r_ids)

    # R4 hypoglycemia history == true
    plan, r_ids = rule_r4_hypoglycemia_history(plan, patient_data)
    triggered.extend(r_ids)

    # R4b hypoglycemia history == unknown
    plan, r_ids = rule_r4b_hypoglycemia_unknown(plan, patient_data)
    triggered.extend(r_ids)

    # R5 kidney flag == true
    plan, r_ids = rule_r5_kidney_flag(plan, patient_data)
    triggered.extend(r_ids)

    # R8 strip predictive text
    plan, r_ids = rule_r8_strip_predictive_glucose(plan)
    triggered.extend(r_ids)

    # R9 stamping
    plan, r_ids = rule_r9_stamp_output(plan, triggered, gemini_used=gemini_used, demo_fixture=demo_fixture)
    return plan, plan["rules_triggered"]
