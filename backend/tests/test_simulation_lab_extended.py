"""
Tests for extended Simulation Lab:
- New what-if levers and bounds validation
- Documented bounded post-hoc adjustments and is_estimated_adjustment flag
- SavedScenario CRUD endpoints and compare math
- Goal-based planner (POST /twin/plan-goal) with Governor R1-R9 compliance
- Deterministic output with seed
- Apply planned tasks to care plan
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models_db import Patient, User, SavedScenario, CarePlan, CarePlanTask
from app.auth import hash_password


@pytest.fixture
def sim_setup(client: TestClient, db_session: Session):
    """Setup patient and authenticated user for simulation lab tests."""
    # 1. Create patient user
    user = User(
        email="sim_patient@example.com",
        password_hash=hash_password("SecretPass123!"),
        full_name="Sim Patient",
        role="patient",
    )
    db_session.add(user)
    db_session.flush()

    # 2. Patient with hypoglycemia history to test Governor R4 compliance
    patient = Patient(
        user_id=user.id,
        display_name="Sim Patient",
        is_synthetic=True,
        source="cgmacros",
        cgmacros_participant_id=101,
        age=52,
        sex="M",
        bmi=27.5,
        hba1c_pct=7.6,
        fasting_glucose_mgdl=135.0,
        hypoglycemia_history=True,  # Triggers Governor R4: 30% carb reduction cap
        kidney_flag=False,
        current_meds=["metformin"],
    )
    db_session.add(patient)
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(patient)

    # 3. Authenticate
    login_res = client.post(
        "/auth/login",
        json={"email": "sim_patient@example.com", "password": "SecretPass123!"},
    )
    assert login_res.status_code == 200, login_res.text
    token = login_res.json()["access_token"]
    client.headers = {"Authorization": f"Bearer {token}"}

    return {"patient_id": patient.id, "user_id": user.id}


# ============================================================================
# 1. New Levers & Bounds Validation
# ============================================================================

def test_whatif_new_levers_bounds_validation(client: TestClient, sim_setup):
    pid = sim_setup["patient_id"]
    base_meal = {
        "carbs_g": 55.0,
        "protein_g": 25.0,
        "fat_g": 15.0,
        "calories": 455.0,
        "time_of_day": 12.5,
        "pre_glucose": 110.0,
        "pre_trend30": 0.0,
    }

    # Invalid carb_reduction_pct (>50%)
    res = client.post(
        f"/patients/{pid}/whatif",
        json={"meal": base_meal, "interventions": {"carb_reduction_pct": 55.0}},
    )
    assert res.status_code == 422

    # Invalid walk_duration_min (>60 min)
    res = client.post(
        f"/patients/{pid}/whatif",
        json={"meal": base_meal, "interventions": {"walk_duration_min": 75.0}},
    )
    assert res.status_code == 422

    # Invalid timing_shift_hours (>4h)
    res = client.post(
        f"/patients/{pid}/whatif",
        json={"meal": base_meal, "interventions": {"timing_shift_hours": 6.0}},
    )
    assert res.status_code == 422

    # Invalid meal_order
    res = client.post(
        f"/patients/{pid}/whatif",
        json={"meal": base_meal, "interventions": {"meal_order": "dessert_first"}},
    )
    assert res.status_code == 422

    # Invalid walk_intensity
    res = client.post(
        f"/patients/{pid}/whatif",
        json={"meal": base_meal, "interventions": {"walk_intensity": "sprinting"}},
    )
    assert res.status_code == 422


def test_whatif_estimated_adjustments_and_citations(client: TestClient, sim_setup):
    pid = sim_setup["patient_id"]
    base_meal = {
        "carbs_g": 55.0,
        "protein_g": 25.0,
        "fat_g": 15.0,
        "calories": 455.0,
        "time_of_day": 12.5,
        "pre_glucose": 110.0,
        "pre_trend30": 0.0,
    }

    # Case 1: Standard baseline with no non-native adjustments
    res_std = client.post(
        f"/patients/{pid}/whatif",
        json={
            "meal": base_meal,
            "interventions": {
                "carb_reduction_pct": 0.0,
                "meal_order": "standard",
                "walk_duration_min": 0.0,
                "walk_intensity": "none",
                "timing_shift_hours": 0.0,
            },
        },
    ).json()

    assert res_std["is_estimated_adjustment"] is False
    assert len(res_std["adjustments"]) == 0
    std_median = res_std["intervention"]["median"]

    # Case 2: Meal order = veggies_first -> estimated adjustment applied
    res_order = client.post(
        f"/patients/{pid}/whatif",
        json={
            "meal": base_meal,
            "interventions": {
                "carb_reduction_pct": 0.0,
                "meal_order": "veggies_first",
            },
        },
    ).json()

    assert res_order["is_estimated_adjustment"] is True
    assert len(res_order["adjustments"]) >= 1
    adj = res_order["adjustments"][0]
    assert adj["lever"] == "meal_order"
    assert adj["adjustment_pct"] == -18.0
    assert "Shukla" in adj["citation"]
    # Peak rise must be lower than standard
    assert res_order["intervention"]["median"] < std_median

    # Case 3: Brisk walk (30 min) -> GLUT4 muscular disposal adjustment
    res_walk = client.post(
        f"/patients/{pid}/whatif",
        json={
            "meal": base_meal,
            "interventions": {
                "walk_duration_min": 30.0,
                "walk_intensity": "brisk",
            },
        },
    ).json()

    assert res_walk["is_estimated_adjustment"] is True
    walk_adj = next(a for a in res_walk["adjustments"] if a["lever"] == "walk_intensity_duration")
    assert walk_adj["adjustment_pct"] < 0
    assert "Borror" in walk_adj["citation"]


# ============================================================================
# 2. Saved Scenarios CRUD & Compare Math
# ============================================================================

def test_saved_scenarios_crud_and_compare_math(client: TestClient, sim_setup):
    pid = sim_setup["patient_id"]

    # 1. Create Scenario A (Light walk)
    scen_a_payload = {
        "name": "Scenario A: 15m Light Walk",
        "description": "Post-lunch gentle stroll",
        "inputs": {
            "meal": {"carbs_g": 60.0, "protein_g": 20.0, "fat_g": 15.0},
            "interventions": {"carb_reduction_pct": 10.0, "walk_duration_min": 15.0, "walk_intensity": "light"},
        },
        "baseline_output": {"median": 45.0, "p10": 35.0, "p90": 58.0},
        "intervention_output": {"median": 38.0, "p10": 29.0, "p90": 49.0},
    }
    res_a = client.post(f"/patients/{pid}/scenarios", json=scen_a_payload)
    assert res_a.status_code == 201, res_a.text
    scen_a = res_a.json()
    assert scen_a["name"] == scen_a_payload["name"]
    id_a = scen_a["id"]

    # 2. Create Scenario B (30m Brisk Walk + Veggies First)
    scen_b_payload = {
        "name": "Scenario B: 30m Brisk Walk + Veggies",
        "description": "Intensive glycemic intervention",
        "inputs": {
            "meal": {"carbs_g": 60.0, "protein_g": 20.0, "fat_g": 15.0},
            "interventions": {"carb_reduction_pct": 25.0, "walk_duration_min": 30.0, "walk_intensity": "brisk", "meal_order": "veggies_first"},
        },
        "baseline_output": {"median": 45.0, "p10": 35.0, "p90": 58.0},
        "intervention_output": {"median": 26.5, "p10": 18.0, "p90": 36.0},
    }
    res_b = client.post(f"/patients/{pid}/scenarios", json=scen_b_payload)
    assert res_b.status_code == 201
    scen_b = res_b.json()
    id_b = scen_b["id"]

    # 3. List Scenarios
    list_res = client.get(f"/patients/{pid}/scenarios")
    assert list_res.status_code == 200
    scenarios = list_res.json()
    assert len(scenarios) >= 2
    ids = [s["id"] for s in scenarios]
    assert id_a in ids and id_b in ids

    # 4. Get Scenario by ID
    get_res = client.get(f"/patients/{pid}/scenarios/{id_a}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == scen_a_payload["name"]

    # 5. Compare Scenarios A and B
    comp_res = client.post(
        f"/patients/{pid}/scenarios/compare",
        json={"scenario_id_a": id_a, "scenario_id_b": id_b},
    )
    assert comp_res.status_code == 200, comp_res.text
    comp_data = comp_res.json()

    comparison = comp_data["comparison"]
    # Math: B - A = 26.5 - 38.0 = -11.5 mg/dL
    assert comparison["median_diff_mgdl"] == -11.5
    # P10 diff: 18.0 - 29.0 = -11.0
    assert comparison["p10_diff_mgdl"] == -11.0
    # Carb reduction diff: 25.0 - 10.0 = +15.0%
    assert comparison["carb_reduction_diff_pct"] == 15.0
    # Summary should mention lower rise
    assert "lower predicted peak rise" in comparison["summary"]

    # 6. Delete Scenario
    del_res = client.delete(f"/patients/{pid}/scenarios/{id_a}")
    assert del_res.status_code == 200

    # Verify deleted
    get_del = client.get(f"/patients/{pid}/scenarios/{id_a}")
    assert get_del.status_code == 404


# ============================================================================
# 3. Goal-Based Planner & Safety Governor Compliance
# ============================================================================

def test_goal_planner_governor_enforcement_and_seed_determinism(client: TestClient, sim_setup):
    pid = sim_setup["patient_id"]

    candidate_meals = [
        {
            "name": "Chicken Biryani with Raita",
            "carbs_g": 75.0,
            "protein_g": 32.0,
            "fat_g": 20.0,
            "calories": 608.0,
            "time_of_day": 13.0,
            "pre_glucose": 115.0,
            "pre_trend30": 0.0,
        },
        {
            "name": "Paneer Tikka with Naan and Mint Chutney",
            "carbs_g": 65.0,
            "protein_g": 28.0,
            "fat_g": 25.0,
            "calories": 597.0,
            "time_of_day": 19.5,
            "pre_glucose": 110.0,
            "pre_trend30": 0.0,
        },
    ]

    goal_payload = {
        "patient_id": pid,
        "target_peak_rise_limit": 35.0,
        "candidate_meals": candidate_meals,
        "carb_ceiling_g": 60.0,
        "foods_to_avoid": ["naan"],  # Should exclude the Paneer Tikka with Naan meal
        "min_portion_pct": 50.0,
        "max_portion_pct": 100.0,
        "allow_timing_shift": True,
        "allow_walk": True,
        "allow_meal_order": True,
        "seed": 42,
    }

    # Run planner
    res = client.post("/twin/plan-goal", json=goal_payload)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["provenance"] == "TWIN_PREDICTED"
    assert data["safety_checked"] is True
    plans = data["plans"]
    assert len(plans) >= 1
    assert len(plans) <= 3

    # Check Governor R4 enforcement:
    # Patient has hypoglycemia_history=True -> no plan may exceed 30% carb reduction (portion >= 70%)
    for plan in plans:
        assert plan["governor_trace"]["clean"] is True
        assert "R4_HYPOGLYCEMIA_PROTECTION" in plan["governor_trace"]["rules_triggered"]
        assert "R9_SAFETY_STAMPED" in plan["governor_trace"]["rules_triggered"]

        for m in plan["meals"]:
            assert m["portion_pct"] >= 70.0, f"Governor R4 violated: portion {m['portion_pct']}% < 70%"
            # Verify foods_to_avoid was respected
            assert "naan" not in m["meal_name"].lower()

    # Check Determinism: Same seed must return identical predicted peak rises
    res2 = client.post("/twin/plan-goal", json=goal_payload).json()
    assert len(res2["plans"]) == len(plans)
    for p1, p2 in zip(plans, res2["plans"]):
        assert p1["plan_id"] == p2["plan_id"]
        assert p1["predicted_peak"]["median"] == p2["predicted_peak"]["median"]


# ============================================================================
# 4. Apply Plan to Care Plan Endpoint
# ============================================================================

def test_apply_plan_to_care_plan(client: TestClient, sim_setup, db_session: Session):
    pid = sim_setup["patient_id"]

    tasks_payload = [
        {
            "title": "Eat salad/vegetables before Biryani",
            "category": "diet",
            "due_date": "Daily with meal",
            "assigned_to": "patient",
        },
        {
            "title": "20 min moderate walk after Lunch",
            "category": "exercise",
            "due_date": "Within 30 min of lunch",
            "assigned_to": "patient",
        },
    ]

    res = client.post(
        "/twin/apply-plan",
        json={
            "patient_id": pid,
            "plan_id": "plan_lifestyle_first",
            "tasks": tasks_payload,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["task_count"] == 2
    care_plan_id = data["care_plan_id"]

    # Verify tasks saved to CarePlanTask table
    tasks_db = db_session.query(CarePlanTask).filter(CarePlanTask.care_plan_id == care_plan_id).all()
    assert len(tasks_db) == 2
    titles = [t.title for t in tasks_db]
    assert "Eat salad/vegetables before Biryani" in titles
    assert "20 min moderate walk after Lunch" in titles
