from datetime import datetime, timezone
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.models_db import AuditLog, MealEntry, Patient
from app.twin.bounds import check_bounds
from app.twin.memory import compute_confidence_score, compute_memory, recompute_twin_state
from app.twin.twin_engine import get_twin_model


def create_test_patient(client: TestClient, mode: str = "new", participant_id: int | None = None) -> int:
    if mode == "cgmacros":
        r = client.post("/patients", json={
            "mode": "cgmacros",
            "cgmacros_participant_id": participant_id or 101,
        })
    else:
        r = client.post("/patients", json={
            "mode": "new",
            "display_name": "Twin Test Patient",
            "age": 45,
            "sex": "F",
            "bmi": 26.0,
            "hba1c_pct": 6.8,
            "fasting_glucose_mgdl": 110.0,
        })
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ============================================================================
# 1. Memory computation tests (exclusion of current meal, baseline fallback, seeding)
# ============================================================================

def test_memory_computation_baseline_fallback(db_session: Session, client: TestClient):
    pid = create_test_patient(client, mode="new")

    # Patient has 0 prior meals -> falls back to population baseline
    mem = compute_memory(patient_id=pid, db=db_session)
    assert mem["mem_n"] == 0
    assert mem["baseline_used"] is True
    assert mem["mem_mean_rise"] > 0
    assert mem["mem_mean_iauc"] > 0
    assert 0.0 <= mem["confidence_score"] <= 1.0


def test_memory_computation_prior_meals_and_exclusion(db_session: Session, client: TestClient):
    pid = create_test_patient(client, mode="new")

    # Log 3 meals with observed responses
    m1 = client.post(f"/patients/{pid}/meals", json={
        "logged_at": "2026-10-15T08:00:00Z",
        "carbs_g": 40.0, "protein_g": 20.0, "fat_g": 10.0,
        "pre_glucose": 95.0, "pre_trend30": 0.0,
        "observed_peak_rise": 30.0, "observed_iauc_2h": 25.0,
    }).json()

    m2 = client.post(f"/patients/{pid}/meals", json={
        "logged_at": "2026-10-15T12:00:00Z",
        "carbs_g": 50.0, "protein_g": 25.0, "fat_g": 15.0,
        "pre_glucose": 100.0, "pre_trend30": 0.0,
        "observed_peak_rise": 40.0, "observed_iauc_2h": 35.0,
    }).json()

    m3 = client.post(f"/patients/{pid}/meals", json={
        "logged_at": "2026-10-15T18:00:00Z",
        "carbs_g": 60.0, "protein_g": 30.0, "fat_g": 20.0,
        "pre_glucose": 105.0, "pre_trend30": 0.0,
        "observed_peak_rise": 50.0, "observed_iauc_2h": 45.0,
    }).json()

    # 1. Total memory across all 3 meals
    mem_all = compute_memory(patient_id=pid, db=db_session)
    assert mem_all["mem_n"] == 3
    assert mem_all["mem_mean_rise"] == 40.0  # (30+40+50)/3
    assert mem_all["mem_mean_iauc"] == 35.0  # (25+35+45)/3
    assert mem_all["baseline_used"] is False

    # 2. Exclude current meal (m3) -> memory computed strictly prior to m3
    mem_exclude_m3 = compute_memory(patient_id=pid, db=db_session, exclude_meal_id=m3["id"])
    assert mem_exclude_m3["mem_n"] == 2
    assert mem_exclude_m3["mem_mean_rise"] == 35.0  # (30+40)/2
    assert mem_exclude_m3["mem_mean_iauc"] == 30.0  # (25+35)/2

    # 3. Exclude by timestamp before m2
    mem_before_m2 = compute_memory(
        patient_id=pid,
        db=db_session,
        before_time=datetime(2026, 10, 15, 11, 0, tzinfo=timezone.utc),
    )
    assert mem_before_m2["mem_n"] == 1
    assert mem_before_m2["mem_mean_rise"] == 30.0


def test_cgmacros_patient_seeding(db_session: Session, client: TestClient):
    # Participant 101 in fixture meals_db has 2 historical meals (rise 25.0 and 35.0)
    pid = create_test_patient(client, mode="cgmacros", participant_id=101)

    mem = compute_memory(patient_id=pid, db=db_session)
    assert mem["mem_n"] == 2  # Seeded with the 2 meals from meals_db
    assert mem["mem_mean_rise"] == 30.0  # (25 + 35)/2
    assert mem["mem_mean_iauc"] == 27.0  # (22 + 32)/2
    assert mem["baseline_used"] is False

    # Twin state was persisted on patient creation
    twin_state_res = client.get(f"/patients/{pid}").json()["twin_state"]
    assert twin_state_res["mem_n"] == 2
    assert twin_state_res["mem_mean_rise"] == 30.0


def test_confidence_score_formula():
    # mem_n = 0, default spread 0.5:
    # 0.6 * (1 - exp(0)) + 0.4 * (1 - 0.5) = 0.0 + 0.2 = 0.2
    c0 = compute_confidence_score(0, band_width=15.0)
    assert c0["confidence_score"] == 0.2
    assert c0["components"]["memory_component"] == 0.0
    assert c0["components"]["spread_component"] == 0.5

    # Higher mem_n increases memory component monotonically
    c5 = compute_confidence_score(5, band_width=15.0)
    c10 = compute_confidence_score(10, band_width=15.0)
    assert c5["confidence_score"] > c0["confidence_score"]
    assert c10["confidence_score"] > c5["confidence_score"]

    # Clipped to [0, 1]
    c_large = compute_confidence_score(100, band_width=0.0)
    assert c_large["confidence_score"] <= 1.0


# ============================================================================
# 2. Bounds guard tests
# ============================================================================

def test_bounds_guard_direct():
    rec = get_twin_model()
    assert rec is not None

    # Within bounds (carbs 50, protein 30, fat 15, kcal 455, pre_glucose 100, pre_trend30 0)
    ok_features = {
        "carbs_g": 50.0, "protein_g": 30.0, "fat_g": 15.0,
        "fiber_g": 5.0, "kcal": 455.0, "pre_glucose": 100.0, "pre_trend30": 0.0,
    }
    res_ok = check_bounds(ok_features, rec.lo, rec.hi)
    assert res_ok["is_valid"] is True
    assert res_ok["status"] == "ok"
    assert len(res_ok["offending_features"]) == 0

    # Absurd carbs (carbs_g = 900.0)
    bad_features = ok_features.copy()
    bad_features["carbs_g"] = 900.0
    res_bad = check_bounds(bad_features, rec.lo, rec.hi)
    assert res_bad["is_valid"] is False
    assert res_bad["status"] == "out_of_range"
    assert len(res_bad["offending_features"]) == 1
    assert res_bad["offending_features"][0]["feature"] == "carbs_g"
    assert res_bad["offending_features"][0]["value"] == 900.0


# ============================================================================
# 3. POST /predict endpoint tests
# ============================================================================

def test_predict_success_and_monotonic_percentiles(client: TestClient):
    pid = create_test_patient(client, mode="cgmacros", participant_id=101)

    payload = {
        "carbs_g": 50.0,
        "protein_g": 25.0,
        "fat_g": 15.0,
        "fibre_g": 5.0,
        "time_of_day": 12.5,
        "pre_glucose": 105.0,
        "pre_trend30": -2.0,
    }
    r = client.post(f"/patients/{pid}/predict", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()

    assert data["provenance"] == "TWIN_PREDICTED"
    assert data["safety_checked"] is True
    assert "MealRecommender" in data["model_version"]
    assert data["patient_id"] == pid

    target_pred = data["targets"]["peak_rise"]
    assert target_pred is not None
    # Verify strict monotonic ordering: min <= p10 <= median <= p90 <= max
    assert target_pred["min"] <= target_pred["p10"]
    assert target_pred["p10"] <= target_pred["median"]
    assert target_pred["median"] <= target_pred["p90"]
    assert target_pred["p90"] <= target_pred["max"]
    assert target_pred["band_width"] == round(target_pred["p90"] - target_pred["p10"], 2)

    assert 0.0 <= data["confidence_score"] <= 1.0


def test_predict_absurd_input_returns_out_of_range(client: TestClient):
    pid = create_test_patient(client, mode="new")

    # Carbs 900.0 exceeds maximum training boundary (94.0g)
    payload = {
        "carbs_g": 900.0,
        "protein_g": 25.0,
        "fat_g": 15.0,
        "pre_glucose": 100.0,
        "pre_trend30": 0.0,
    }
    r = client.post(f"/patients/{pid}/predict", json=payload)
    # Pydantic schema caps carbs_g at 400.0 (returns 422 VALIDATION_ERROR)
    # If passed within schema bound (e.g. carbs_g=150.0 > training hi 94.0):
    assert r.status_code == 422

    payload_training_out = {
        "carbs_g": 150.0,  # inside Pydantic schema <=400, but outside training hi 94.0
        "protein_g": 25.0,
        "fat_g": 15.0,
        "pre_glucose": 100.0,
        "pre_trend30": 0.0,
    }
    r2 = client.post(f"/patients/{pid}/predict", json=payload_training_out)
    assert r2.status_code == 422
    data = r2.json()
    assert data["error"]["code"] == "OUT_OF_RANGE"
    assert data["error"]["details"]["status"] == "out_of_range"
    offending_names = [f["feature"] for f in data["error"]["details"]["offending_features"]]
    assert "carbs_g" in offending_names


# ============================================================================
# 4. POST /whatif endpoint and margin boundary logic
# ============================================================================

def test_whatif_calorie_math_and_margin_label(client: TestClient):
    pid = create_test_patient(client, mode="cgmacros", participant_id=101)

    payload = {
        "meal": {
            "carbs_g": 60.0,
            "protein_g": 30.0,
            "fat_g": 15.0,
            "calories": 495.0,
            "time_of_day": 13.0,
            "pre_glucose": 100.0,
            "pre_trend30": 0.0,
        },
        "interventions": {
            "carb_reduction_pct": 30.0,  # 30% reduction -> 42.0g carbs (-18g)
            "post_meal_walk": True,
            "margin": 15.0,
        },
    }
    r = client.post(f"/patients/{pid}/whatif", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()

    assert data["provenance"] == "TWIN_PREDICTED"
    assert data["status"] == "evaluated"
    assert data["baseline"]["median"] > 0
    assert data["intervention"]["median"] > 0

    # Verify calorie math: 18g carbs * 4 kcal/g = 72 kcal reduction -> 495 - 72 = 423 kcal
    assert data["new_macros"]["carbs_g"] == 42.0
    assert data["new_macros"]["kcal"] == 423.0

    gains = data["gains"]
    assert gains["pessimistic_gain"] is not None
    assert gains["label"] in ["supported", "not_supported"]

    # Verify margin boundary: if margin is set extremely high, it must be not_supported
    payload["interventions"]["margin"] = 999.0
    r_high_margin = client.post(f"/patients/{pid}/whatif", json=payload).json()
    assert r_high_margin["gains"]["label"] == "not_supported"

    # If margin is set extremely low, it must be supported
    payload["interventions"]["margin"] = -999.0
    r_low_margin = client.post(f"/patients/{pid}/whatif", json=payload).json()
    assert r_low_margin["gains"]["label"] == "supported"


# ============================================================================
# 5. POST /compare-meals endpoint tests
# ============================================================================

def test_compare_meals(client: TestClient):
    pid = create_test_patient(client, mode="cgmacros", participant_id=101)

    payload = {
        "meals": [
            {"carbs_g": 30.0, "protein_g": 25.0, "fat_g": 15.0, "pre_glucose": 95.0, "pre_trend30": 0.0},
            {"carbs_g": 60.0, "protein_g": 25.0, "fat_g": 15.0, "pre_glucose": 95.0, "pre_trend30": 0.0},
            {"carbs_g": 85.0, "protein_g": 25.0, "fat_g": 15.0, "pre_glucose": 95.0, "pre_trend30": 0.0},
        ],
        "labels": ["Low Carb Salad", "Medium Carb Bowl", "High Carb Pasta"],
    }
    r = client.post(f"/patients/{pid}/compare-meals", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()

    assert data["provenance"] == "TWIN_PREDICTED"
    assert len(data["ranked_meals"]) == 3
    # Sorted ascending by median peak rise (rank 1 <= rank 2 <= rank 3)
    medians = [m["prediction"]["median"] for m in data["ranked_meals"]]
    assert medians == sorted(medians)
    assert data["best_meal"]["rank"] == 1
    assert data["best_meal"]["delta_vs_best"] == 0.0


# ============================================================================
# 6. GET /best-time endpoint tests
# ============================================================================

def test_best_time_to_eat_sweep(client: TestClient):
    pid = create_test_patient(client, mode="cgmacros", participant_id=101)

    r = client.get(
        f"/patients/{pid}/best-time",
        params={
            "carbs_g": 45.0,
            "protein_g": 20.0,
            "fat_g": 10.0,
            "pre_glucose": 95.0,
            "pre_trend30": 0.0,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()

    assert data["provenance"] == "TWIN_PREDICTED"
    assert len(data["slots"]) == 48  # 0.0 to 23.5 in 0.5h steps
    assert data["best_slot"]["median_rise"] <= data["worst_slot"]["median_rise"]
    assert data["spread"] == round(data["worst_slot"]["median_rise"] - data["best_slot"]["median_rise"], 2)


# ============================================================================
# 7. POST /daily-plan endpoint tests and overlap warnings
# ============================================================================

def test_daily_plan_overlap_warnings_and_worst_meal(client: TestClient):
    pid = create_test_patient(client, mode="cgmacros", participant_id=101)

    payload = {
        "meals": [
            {
                "label": "Breakfast",
                "time_of_day": 8.0,
                "carbs_g": 35.0,
                "protein_g": 15.0,
                "fat_g": 10.0,
                "pre_glucose": 90.0,
                "pre_trend30": 0.0,
            },
            {
                "label": "Mid-Morning Snack",
                "time_of_day": 9.5,  # Only 90 minutes after breakfast (< 120 min)
                "carbs_g": 20.0,
                "protein_g": 5.0,
                "fat_g": 5.0,
                "pre_glucose": 95.0,
                "pre_trend30": 0.0,
            },
            {
                "label": "Dinner",
                "time_of_day": 19.0,
                "carbs_g": 70.0,
                "protein_g": 35.0,
                "fat_g": 20.0,
                "pre_glucose": 105.0,
                "pre_trend30": 1.0,
            },
        ]
    }
    r = client.post(f"/patients/{pid}/daily-plan", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()

    assert data["provenance"] == "TWIN_PREDICTED"
    assert len(data["plan"]) == 3
    # Overlap warning between Breakfast and Snack
    assert len(data["warnings"]) >= 1
    assert "90 min apart" in data["warnings"][0]

    # Exactly one worst meal flagged
    worst_flags = [m["is_worst_meal"] for m in data["plan"]]
    assert sum(worst_flags) == 1
    assert data["worst_meal"]["is_worst_meal"] is True


# ============================================================================
# 8. GET /cohort-position endpoint tests
# ============================================================================

def test_cohort_position_on_fixture(client: TestClient):
    pid = create_test_patient(client, mode="cgmacros", participant_id=101)

    r = client.get(f"/patients/{pid}/cohort-position")
    assert r.status_code == 200, r.text
    data = r.json()

    assert data["provenance"] == "TWIN_PREDICTED"
    assert data["cohort_size"] >= 2
    assert 0.0 <= data["percentile_mem_mean_rise"] <= 100.0
    assert 0.0 <= data["percentile_mem_mean_iauc"] <= 100.0
    assert "median" in data["cohort_rise_stats"]


# ============================================================================
# 9. GET /twin-learning/{participant_id} endpoint tests
# ============================================================================

def test_twin_learning_progression(client: TestClient):
    # In fixture meals_df, participant 101 has 2 meals
    r = client.get("/twin-learning/101")
    assert r.status_code == 200, r.text
    data = r.json()

    assert data["participant_id"] == 101
    assert len(data["data_points"]) == 2
    assert "bootstrap ensemble" in data["note"]

    # Unknown participant returns 404
    r_bad = client.get("/twin-learning/9999")
    assert r_bad.status_code == 404


# ============================================================================
# 10. Audit log verification
# ============================================================================

def test_endpoints_write_audit_log(client: TestClient, db_session: Session):
    pid = create_test_patient(client, mode="new")
    initial_count = db_session.query(AuditLog).count()

    client.post(f"/patients/{pid}/predict", json={
        "carbs_g": 45.0, "protein_g": 20.0, "fat_g": 10.0,
        "pre_glucose": 95.0, "pre_trend30": 0.0,
    })
    new_count = db_session.query(AuditLog).count()
    assert new_count > initial_count
