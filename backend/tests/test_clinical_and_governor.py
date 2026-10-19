import pytest
from unittest.mock import patch, MagicMock
from app.clinical.fallback import get_fallback_plan
from app.clinical.governor import (
    ALLOWED_DRUG_CLASSES,
    rule_r1_schema_validity,
    rule_r2_allowed_drug_classes,
    rule_r3_no_dosing_language,
    rule_r4_hypoglycemia_history,
    rule_r4b_hypoglycemia_unknown,
    rule_r5_kidney_flag,
    rule_r6_missing_critical_data,
    rule_r7_guideline_ids,
    rule_r8_strip_predictive_glucose,
    rule_r9_stamp_output,
    run_safety_governor,
)
from app.clinical.guidelines import get_known_guideline_ids, retrieve_guidelines
from app.clinical.reasoning import generate_clinical_plan, get_canned_fixture


@pytest.fixture
def sample_valid_plan():
    return {
        "therapy_options": [
            {
                "drug_class": "metformin",
                "rationale": "Foundational therapy for blood glucose regulation.",
                "patient_factors_used": ["Elevated HbA1c"],
                "expected_effect_literature": "Typical population-level reduction in HbA1c of 1.0% to 1.5%",
                "cautions": ["Assess renal filtration capacity before starting"],
                "monitoring": ["Annual eGFR assessment"],
                "guideline_ids": ["G-MET-01"],
            },
            {
                "drug_class": "sglt2_inhibitor",
                "rationale": "Cardiorenal protection alongside glycemic control.",
                "patient_factors_used": ["Renal risk consideration"],
                "expected_effect_literature": "Typical population-level reduction in HbA1c of 0.5% to 0.9%",
                "cautions": ["Monitor volume status"],
                "monitoring": ["eGFR", "Blood pressure"],
                "guideline_ids": ["G-SGLT2-01"],
            },
        ],
        "lifestyle_interventions": [
            {
                "title": "Post-Meal Walking",
                "detail": "Walk for 15 minutes after main meals to enhance glucose clearance.",
                "linked_twin_finding": "Blunts peak rise",
            }
        ],
        "red_flags": ["Standard clinical review required."],
        "questions_for_clinician": ["Discuss individual glycemic target."],
        "missing_information": ["Recent lipid profile."],
        "patient_summary": "Focus on daily walking and balanced meals with plenty of fiber. Please discuss medication options with your clinician.",
        "fallback": False,
        "demo_fixture": False,
    }


# ============================================================================
# Rule R1 Tests: Schema Validity
# ============================================================================

def test_rule_r1_schema_validity_positive(sample_valid_plan):
    cleaned, rules = rule_r1_schema_validity(sample_valid_plan)
    assert rules == []
    assert len(cleaned["therapy_options"]) == 2


def test_rule_r1_schema_validity_negative():
    bad_plan = {"therapy_options": "not a list"}
    cleaned, rules = rule_r1_schema_validity(bad_plan)
    assert "R1_INVALID_SCHEMA" in rules
    assert cleaned.get("fallback") is True


# ============================================================================
# Rule R2 Tests: Allowed Drug Classes
# ============================================================================

def test_rule_r2_allowed_drug_classes_positive(sample_valid_plan):
    cleaned, rules = rule_r2_allowed_drug_classes(sample_valid_plan)
    assert rules == []
    assert len(cleaned["therapy_options"]) == 2


def test_rule_r2_allowed_drug_classes_negative(sample_valid_plan):
    bad_option = {
        "drug_class": "disallowed_stimulant",
        "rationale": "Invalid class",
        "patient_factors_used": [],
        "expected_effect_literature": "N/A",
        "cautions": [],
        "monitoring": [],
        "guideline_ids": ["G-MET-01"],
    }
    sample_valid_plan["therapy_options"].append(bad_option)
    cleaned, rules = rule_r2_allowed_drug_classes(sample_valid_plan)
    assert "R2_DISALLOWED_DRUG_CLASS" in rules
    assert len(cleaned["therapy_options"]) == 2
    classes = [o["drug_class"] for o in cleaned["therapy_options"]]
    assert "disallowed_stimulant" not in classes


# ============================================================================
# Rule R3 Tests: No Dosing Language
# ============================================================================

def test_rule_r3_no_dosing_language_positive(sample_valid_plan):
    cleaned, rules = rule_r3_no_dosing_language(sample_valid_plan)
    assert rules == []
    assert len(cleaned["therapy_options"]) == 2


def test_rule_r3_no_dosing_language_negative(sample_valid_plan):
    # Insert explicit dosing language
    sample_valid_plan["therapy_options"][0]["rationale"] = "Start with 500 mg twice daily with food."
    cleaned, rules = rule_r3_no_dosing_language(sample_valid_plan)
    assert "R3_DOSING_LANGUAGE_DETECTED" in rules
    assert len(cleaned["therapy_options"]) == 1
    assert cleaned["therapy_options"][0]["drug_class"] == "sglt2_inhibitor"


def test_rule_r3_dosing_in_patient_summary_stripped(sample_valid_plan):
    sample_valid_plan["patient_summary"] = (
        "Take 500 mg twice daily. Please engage in regular 15-minute walks. Start on 10 units of insulin."
    )
    cleaned, rules = rule_r3_no_dosing_language(sample_valid_plan)
    assert "R3_DOSING_LANGUAGE_DETECTED" in rules
    assert "500 mg" not in cleaned["patient_summary"]
    assert "10 units" not in cleaned["patient_summary"]
    assert "Please engage in regular 15-minute walks." in cleaned["patient_summary"]


# ============================================================================
# Rule R4 Tests: Hypoglycemia History == True
# ============================================================================

def test_rule_r4_hypoglycemia_history_positive(sample_valid_plan):
    patient_data = {"hypoglycemia_history": False}
    cleaned, rules = rule_r4_hypoglycemia_history(sample_valid_plan, patient_data)
    assert rules == []


def test_rule_r4_hypoglycemia_history_negative(sample_valid_plan):
    sample_valid_plan["therapy_options"].append({
        "drug_class": "sulfonylurea",
        "rationale": "Secretagogue",
        "patient_factors_used": [],
        "expected_effect_literature": "HbA1c drop",
        "cautions": [],
        "monitoring": [],
        "guideline_ids": ["G-SU-01"],
    })
    sample_valid_plan["lifestyle_interventions"][0]["detail"] = "Try a 45% carb reduction for meals."

    patient_data = {"hypoglycemia_history": True}
    cleaned, rules = rule_r4_hypoglycemia_history(sample_valid_plan, patient_data)
    assert "R4_HYPOGLYCEMIA_PROTECTION" in rules
    classes = [o["drug_class"] for o in cleaned["therapy_options"]]
    assert "sulfonylurea" not in classes
    assert "30% carb reduction" in cleaned["lifestyle_interventions"][0]["detail"]
    assert any("High risk of hypoglycemia" in f for f in cleaned["red_flags"])


# ============================================================================
# Rule R4b Tests: Hypoglycemia History == Unknown (None)
# ============================================================================

def test_rule_r4b_hypoglycemia_unknown_positive(sample_valid_plan):
    patient_data = {"hypoglycemia_history": False}
    cleaned, rules = rule_r4b_hypoglycemia_unknown(sample_valid_plan, patient_data)
    assert rules == []


def test_rule_r4b_hypoglycemia_unknown_negative(sample_valid_plan):
    sample_valid_plan["therapy_options"].insert(0, {
        "drug_class": "sulfonylurea",
        "rationale": "Secretagogue",
        "patient_factors_used": [],
        "expected_effect_literature": "HbA1c drop",
        "cautions": [],
        "monitoring": [],
        "guideline_ids": ["G-SU-01"],
    })
    patient_data = {"hypoglycemia_history": None}
    cleaned, rules = rule_r4b_hypoglycemia_unknown(sample_valid_plan, patient_data)
    assert "R4B_HYPOGLYCEMIA_UNKNOWN_CAUTION" in rules
    # sulfonylurea was demoted to the end
    assert cleaned["therapy_options"][-1]["drug_class"] == "sulfonylurea"
    assert "hypoglycaemia history unknown; confirm with the patient" in cleaned["therapy_options"][-1]["cautions"]
    assert any("Hypoglycaemia history is unknown" in q for q in cleaned["questions_for_clinician"])


# ============================================================================
# Rule R5 Tests: Kidney Flag == True (Demoted, Not Deleted)
# ============================================================================

def test_rule_r5_kidney_flag_positive(sample_valid_plan):
    patient_data = {"kidney_flag": False}
    cleaned, rules = rule_r5_kidney_flag(sample_valid_plan, patient_data)
    assert rules == []


def test_rule_r5_kidney_flag_negative(sample_valid_plan):
    # Put a third class first to verify demotion
    sample_valid_plan["therapy_options"].insert(0, {
        "drug_class": "glp1_receptor_agonist",
        "rationale": "GLP1",
        "patient_factors_used": [],
        "expected_effect_literature": "Drop",
        "cautions": [],
        "monitoring": [],
        "guideline_ids": ["G-GLP1-01"],
    })
    patient_data = {"kidney_flag": True}
    cleaned, rules = rule_r5_kidney_flag(sample_valid_plan, patient_data)
    assert "R5_RENAL_REVIEW_REQUIRED" in rules
    # Metformin and SGLT2 should NOT be deleted, but demoted
    classes = [o["drug_class"] for o in cleaned["therapy_options"]]
    assert "metformin" in classes
    assert "sglt2_inhibitor" in classes
    assert classes[0] == "glp1_receptor_agonist"
    for opt in cleaned["therapy_options"]:
        if opt["drug_class"] in {"metformin", "sglt2_inhibitor"}:
            assert "kidney function must be reviewed before considering" in opt["cautions"]


# ============================================================================
# Rule R6 Tests: Missing Critical Data
# ============================================================================

def test_rule_r6_missing_critical_data_positive(sample_valid_plan):
    patient_data = {"age": 52, "hba1c_pct": 7.8}
    cleaned, rules = rule_r6_missing_critical_data(sample_valid_plan, patient_data)
    assert rules == []


def test_rule_r6_missing_critical_data_negative(sample_valid_plan):
    patient_data = {"age": None, "hba1c_pct": 7.8}
    cleaned, rules = rule_r6_missing_critical_data(sample_valid_plan, patient_data)
    assert "R6_MISSING_CRITICAL_DATA" in rules
    assert cleaned.get("fallback") is True


# ============================================================================
# Rule R7 Tests: Guideline IDs Must Exist
# ============================================================================

def test_rule_r7_guideline_ids_positive(sample_valid_plan):
    known_ids = ["G-MET-01", "G-SGLT2-01", "G-GLP1-01"]
    cleaned, rules = rule_r7_guideline_ids(sample_valid_plan, known_ids)
    assert rules == []
    assert len(cleaned["therapy_options"]) == 2


def test_rule_r7_guideline_ids_negative(sample_valid_plan):
    sample_valid_plan["therapy_options"].append({
        "drug_class": "glp1_receptor_agonist",
        "rationale": "GLP1",
        "patient_factors_used": [],
        "expected_effect_literature": "Drop",
        "cautions": [],
        "monitoring": [],
        "guideline_ids": ["G-UNKNOWN-999"],
    })
    known_ids = ["G-MET-01", "G-SGLT2-01"]
    cleaned, rules = rule_r7_guideline_ids(sample_valid_plan, known_ids)
    assert "R7_UNKNOWN_GUIDELINE_ID" in rules
    classes = [o["drug_class"] for o in cleaned["therapy_options"]]
    assert "glp1_receptor_agonist" not in classes


# ============================================================================
# Rule R8 Tests: Strip Patient-Specific Numeric Glucose Predictions
# ============================================================================

def test_rule_r8_strip_predictive_glucose_positive(sample_valid_plan):
    cleaned, rules = rule_r8_strip_predictive_glucose(sample_valid_plan)
    assert rules == []


def test_rule_r8_strip_predictive_glucose_negative(sample_valid_plan):
    sample_valid_plan["patient_summary"] = (
        "Your glucose will reach 220 mg/dl after dinner. Gentle walking is beneficial."
    )
    cleaned, rules = rule_r8_strip_predictive_glucose(sample_valid_plan)
    assert "R8_STRIPPED_PREDICTIVE_TEXT" in rules
    assert "220" not in cleaned["patient_summary"]
    assert "Gentle walking is beneficial." in cleaned["patient_summary"]


# ============================================================================
# Rule R9 Tests: Output Stamping
# ============================================================================

def test_rule_r9_stamp_output(sample_valid_plan):
    cleaned, rules = rule_r9_stamp_output(
        sample_valid_plan, ["R5_RENAL_REVIEW_REQUIRED"], gemini_used=True, demo_fixture=False
    )
    assert "R9_SAFETY_STAMPED" in rules
    assert cleaned["provenance"] == "GUIDELINE_AI"
    assert cleaned["safety_checked"] is True
    assert "R5_RENAL_REVIEW_REQUIRED" in cleaned["rules_triggered"]
    assert "R9_SAFETY_STAMPED" in cleaned["rules_triggered"]
    assert cleaned["gemini_used"] is True
    assert cleaned["demo_fixture"] is False


# ============================================================================
# Integration & Endpoints Tests
# ============================================================================

def test_llm_cache_avoids_second_call(client, db_session):
    # Create test patient
    create_res = client.post("/patients", json={
        "mode": "new",
        "display_name": "Cache Patient",
        "age": 55,
        "sex": "M",
        "bmi": 28.5,
        "hba1c_pct": 7.9,
        "fasting_glucose_mgdl": 135.0,
        "hypoglycemia_history": False,
        "kidney_flag": False,
        "current_meds": ["metformin"],
    })
    assert create_res.status_code == 201
    p_id = create_res.json()["id"]

    with patch("app.clinical.reasoning._call_gemini_api") as mock_gemini:
        mock_gemini.return_value = get_canned_fixture({}, [{"id": "G-MET-01", "topic": "Metformin", "text": "..."}])

        # First call: populates cache
        res1 = client.post(f"/patients/{p_id}/clinical-plan")
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["provenance"] == "GUIDELINE_AI"

        # Second call: must hit cache
        res2 = client.post(f"/patients/{p_id}/clinical-plan")
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["plan"]["patient_summary"] == data1["plan"]["patient_summary"]


def test_mock_gemini_returns_demo_fixture(client):
    create_res = client.post("/patients", json={
        "mode": "new",
        "display_name": "Mock Gemini Patient",
        "age": 60,
        "sex": "F",
        "bmi": 29.0,
        "hba1c_pct": 8.1,
        "fasting_glucose_mgdl": 140.0,
        "hypoglycemia_history": None,
        "kidney_flag": True,
        "current_meds": [],
    })
    p_id = create_res.json()["id"]

    res = client.post(f"/patients/{p_id}/clinical-plan")
    assert res.status_code == 200
    data = res.json()
    assert data["provenance"] == "GUIDELINE_AI"
    assert data["safety_checked"] is True
    assert data["demo_fixture"] is True
    assert data["gemini_used"] is False
    # Governor should have triggered R5 and R4b
    assert "R5_RENAL_REVIEW_REQUIRED" in data["governor_trace"]["rules_triggered"]
    assert "R4B_HYPOGLYCEMIA_UNKNOWN_CAUTION" in data["governor_trace"]["rules_triggered"]


def test_therapy_scenarios_projection_provenance(client):
    create_res = client.post("/patients", json={
        "mode": "new",
        "display_name": "Scenario Patient",
        "age": 48,
        "sex": "M",
        "bmi": 26.0,
        "hba1c_pct": 7.5,
        "fasting_glucose_mgdl": 125.0,
        "hypoglycemia_history": False,
        "kidney_flag": False,
    })
    p_id = create_res.json()["id"]

    res = client.get(f"/patients/{p_id}/therapy-scenarios")
    assert res.status_code == 200
    data = res.json()
    assert "scenarios" in data
    assert len(data["scenarios"]) > 0
    for scen in data["scenarios"]:
        assert scen["provenance"] == "PROJECTION"
        assert scen["projection_label"] == "Population-literature projection, not a twin prediction"
        if scen["range"] is not None:
            assert scen["range"]["min"] is not None
            assert scen["range"]["max"] is not None


def test_combined_4week_plan_carries_provenance(client):
    create_res = client.post("/patients", json={
        "mode": "new",
        "display_name": "4Week Patient",
        "age": 50,
        "sex": "F",
        "bmi": 27.0,
        "hba1c_pct": 7.6,
        "fasting_glucose_mgdl": 120.0,
        "hypoglycemia_history": False,
        "kidney_flag": False,
    })
    p_id = create_res.json()["id"]

    res = client.post(f"/patients/{p_id}/plan")
    assert res.status_code == 200
    data = res.json()
    assert data["provenance"] == "GUIDELINE_AI"
    assert data["safety_checked"] is True
    assert len(data["weeks"]) == 4

    valid_provenances = {"GUIDELINE_AI", "TWIN_PREDICTED", "PROJECTION"}
    for week in data["weeks"]:
        assert len(week["items"]) >= 3
        for item in week["items"]:
            assert item["provenance"] in valid_provenances
            if item["category"] == "twin_meal_advice":
                assert item["provenance"] == "TWIN_PREDICTED"
            elif item["category"] in {"lifestyle", "monitoring", "clinician_review"}:
                assert item["provenance"] == "GUIDELINE_AI"
