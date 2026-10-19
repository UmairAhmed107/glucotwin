"""
Tests for Alerts Engine, Rule Boundaries, Clinician Patient Panel, and RBAC Scoping.
Verifies:
  1. All 6 alert rules with exact boundary conditions.
  2. Explainable risk score formula and classification.
  3. De-duplication of open alerts.
  4. Automatic rule evaluation on saving entries.
  5. Alert acknowledge & resolve endpoints.
  6. Clinician panel aggregation and RBAC access control (403 for patients).
"""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from app.clinical.alerts_engine import (
    check_post_meal_peaks,
    check_hypoglycemia,
    check_no_recent_entry,
    check_time_in_range,
    check_rising_hba1c,
    check_renal_metformin,
    calculate_patient_risk_score,
)
from app.db import SessionLocal
from app.models_db import Alert, CareTeamLink, GlucoseReading, MealEntry, Patient, User
from app.auth import create_access_token, hash_password
from app.main import app


# ============================================================================
# Unit Tests: Pure Alert Rules & Boundary Conditions
# ============================================================================

def test_rule1_post_meal_peaks_boundary():
    now = datetime(2026, 10, 19, 12, 0, tzinfo=timezone.utc)

    # 2 peaks > 250 -> below threshold (requires 3+)
    entries_2peaks = [
        {"timestamp": now - timedelta(days=1), "glucose_mgdl": 251.0, "is_post_meal": True},
        {"timestamp": now - timedelta(days=2), "glucose_mgdl": 260.0, "entry_type": "post_meal"},
        {"timestamp": now - timedelta(days=3), "glucose_mgdl": 250.0, "is_post_meal": True},  # exactly 250 (not > 250)
    ]
    assert check_post_meal_peaks(entries_2peaks, now=now) is None

    # 3 peaks > 250 -> triggers warning
    entries_3peaks = entries_2peaks + [
        {"timestamp": now - timedelta(days=4), "pre_glucose": 120.0, "observed_peak_rise": 135.0}  # 255.0 > 250
    ]
    res = check_post_meal_peaks(entries_3peaks, now=now)
    assert res is not None
    assert res.rule_key == "POST_MEAL_PEAKS_250"
    assert res.severity == "warning"
    assert "3 post-meal" in res.message


def test_rule2_hypoglycemia_boundaries():
    now = datetime(2026, 10, 19, 12, 0, tzinfo=timezone.utc)

    # 70.0 mg/dL -> exactly at threshold (not < 70)
    assert check_hypoglycemia([{"ts": now, "value_mgdl": 70.0}], now=now) is None

    # 69.9 mg/dL -> warning (< 70, >= 54)
    res_warn = check_hypoglycemia([{"ts": now, "value_mgdl": 69.9}], now=now)
    assert res_warn is not None
    assert res_warn.severity == "warning"

    # 54.0 mg/dL -> warning (not < 54)
    res_54 = check_hypoglycemia([{"ts": now, "value_mgdl": 54.0}], now=now)
    assert res_54 is not None
    assert res_54.severity == "warning"

    # 53.9 mg/dL -> critical (< 54)
    res_crit = check_hypoglycemia([{"ts": now, "value_mgdl": 53.9}], now=now)
    assert res_crit is not None
    assert res_crit.severity == "critical"
    assert "Critical hypoglycemia" in res_crit.message


def test_rule3_no_recent_entry_boundary():
    now = datetime(2026, 10, 19, 12, 0, tzinfo=timezone.utc)

    # Entry 47.9 hours ago -> under 48h -> None
    entries_47h = [{"ts": now - timedelta(hours=47.9), "value_mgdl": 120.0}]
    assert check_no_recent_entry(entries_47h, now=now) is None

    # Entry 48.1 hours ago -> exceeds 48h -> Warning
    entries_48h = [{"ts": now - timedelta(hours=48.1), "value_mgdl": 120.0}]
    res = check_no_recent_entry(entries_48h, now=now)
    assert res is not None
    assert res.rule_key == "NO_ENTRY_48H"
    assert res.severity == "warning"


def test_rule4_time_in_range_boundary():
    now = datetime(2026, 10, 19, 12, 0, tzinfo=timezone.utc)

    # 10 readings: 5 in [70, 180] -> TIR = 50% -> not < 50%
    readings_50tir = [
        {"ts": now - timedelta(hours=i), "value_mgdl": 100.0} if i < 5
        else {"ts": now - timedelta(hours=i), "value_mgdl": 220.0}
        for i in range(10)
    ]
    assert check_time_in_range(readings_50tir, now=now) is None

    # 10 readings: 4 in [70, 180] -> TIR = 40% (< 50%) -> Warning
    readings_40tir = [
        {"ts": now - timedelta(hours=i), "value_mgdl": 100.0} if i < 4
        else {"ts": now - timedelta(hours=i), "value_mgdl": 220.0}
        for i in range(10)
    ]
    res_warn = check_time_in_range(readings_40tir, now=now)
    assert res_warn is not None
    assert res_warn.severity == "warning"

    # 10 readings: 3 in [70, 180] -> TIR = 30% (< 35%) -> Critical
    readings_30tir = [
        {"ts": now - timedelta(hours=i), "value_mgdl": 100.0} if i < 3
        else {"ts": now - timedelta(hours=i), "value_mgdl": 220.0}
        for i in range(10)
    ]
    res_crit = check_time_in_range(readings_30tir, now=now)
    assert res_crit is not None
    assert res_crit.severity == "critical"


def test_rule5_rising_hba1c():
    # HbA1c 7.0% -> not > 7.0 -> None
    assert check_rising_hba1c(current_hba1c=7.0, previous_hba1c=6.5) is None

    # HbA1c 7.5% but previous 7.8% (falling) -> None
    assert check_rising_hba1c(current_hba1c=7.5, previous_hba1c=7.8) is None

    # HbA1c 7.5% and previous 7.1% (rising) -> Warning
    res = check_rising_hba1c(current_hba1c=7.5, previous_hba1c=7.1)
    assert res is not None
    assert res.rule_key == "RISING_HBA1C"
    assert res.severity == "warning"


def test_rule6_renal_metformin_r5_reuse():
    # Renal flag false -> None
    assert check_renal_metformin({"kidney_flag": False, "current_meds": ["metformin"]}) is None

    # Renal flag true but no metformin -> None
    assert check_renal_metformin({"kidney_flag": True, "current_meds": ["glipizide"]}) is None

    # Renal flag true and metformin prescribed -> Critical alert directly leveraging Governor R5
    res = check_renal_metformin({"kidney_flag": True, "current_meds": ["metformin", "lisinopril"]})
    assert res is not None
    assert res.rule_key == "RENAL_METFORMIN_RISK"
    assert res.severity == "critical"
    assert "Governor R5" in res.message


def test_risk_score_calculation_explainable():
    # Low risk patient
    score_low, level_low = calculate_patient_risk_score(
        hba1c_pct=5.4,
        time_in_range=0.90,
        open_alerts=[],
        hypoglycemia_history=False,
    )
    assert 0 <= score_low <= 30
    assert level_low == "low"

    # Critical risk patient (severe hypos, low TIR, high HbA1c, critical alerts)
    score_crit, level_crit = calculate_patient_risk_score(
        hba1c_pct=10.5,
        time_in_range=0.25,
        open_alerts=[{"severity": "critical"}, {"severity": "warning"}],
        hypoglycemia_history=True,
        recent_hypo_min=48.0,
    )
    assert score_crit >= 80
    assert level_crit == "critical"


# ============================================================================
# Integration Tests: DB De-Duplication, Auto-Evaluation, RBAC & Panel
# ============================================================================

@pytest.fixture
def clean_client():
    from app.auth import get_current_user
    saved_overrides = dict(app.dependency_overrides)
    if get_current_user in app.dependency_overrides:
        del app.dependency_overrides[get_current_user]
    client = TestClient(app)
    yield client
    app.dependency_overrides = saved_overrides


def test_alerts_deduplication_and_auto_eval(clean_client):
    db = SessionLocal()
    try:
        # Create test patient
        patient = Patient(
            display_name="Alert Test Patient",
            source="new",
            age=55,
            sex="M",
            bmi=28.0,
            hba1c_pct=8.5,
            fasting_glucose_mgdl=160.0,
            kidney_flag=True,
            current_meds=["metformin"],
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
        pid = patient.id

        # Create doctor and link
        doctor = User(
            email=f"doc.alert.{pid}@hospital.org",
            password_hash=hash_password("DocPass123!"),
            full_name="Dr. Alert Reviewer",
            role="clinician",
        )
        db.add(doctor)
        db.commit()
        db.refresh(doctor)

        link = CareTeamLink(
            patient_id=pid,
            provider_user_id=doctor.id,
            status="active",
            role_in_team="clinician",
        )
        db.add(link)
        db.commit()
        doc_token = create_access_token(data={"sub": str(doctor.id), "email": doctor.email, "role": doctor.role})

    finally:
        db.close()

    headers = {"Authorization": f"Bearer {doc_token}"}

    # 1. Manual evaluate via POST /alerts/evaluate/{pid}
    r_eval1 = clean_client.post(f"/alerts/evaluate/{pid}", headers=headers)
    assert r_eval1.status_code == 200
    alerts1 = r_eval1.json()
    assert len(alerts1) >= 1
    renal_alerts1 = [a for a in alerts1 if a["rule_key"] == "RENAL_METFORMIN_RISK"]
    assert len(renal_alerts1) == 1

    # 2. Re-evaluating must NOT create duplicate open alert for the same rule
    r_eval2 = clean_client.post(f"/alerts/evaluate/{pid}", headers=headers)
    assert r_eval2.status_code == 200
    alerts2 = r_eval2.json()
    renal_alerts2 = [a for a in alerts2 if a["rule_key"] == "RENAL_METFORMIN_RISK"]
    assert len(renal_alerts2) == 1, "Expected exactly 1 open alert due to de-duplication"

    # 3. Test auto-evaluation on saving a critical glucose reading (< 54)
    now_iso = datetime.now(timezone.utc).isoformat()
    r_reading = clean_client.post(
        f"/patients/{pid}/readings",
        headers=headers,
        json={"ts": now_iso, "value_mgdl": 48.0, "source": "manual"},
    )
    assert r_reading.status_code == 201

    # Check that HYPOGLYCEMIA_EVENT was automatically created
    r_alerts_after = clean_client.get(f"/alerts?patient_id={pid}", headers=headers)
    assert r_alerts_after.status_code == 200
    all_alerts = r_alerts_after.json()
    hypo_alerts = [a for a in all_alerts if a["rule_key"] == "HYPOGLYCEMIA_EVENT"]
    assert len(hypo_alerts) == 1
    assert hypo_alerts[0]["severity"] == "critical"
    hypo_id = hypo_alerts[0]["id"]

    # 4. Acknowledge the hypo alert
    r_ack = clean_client.post(f"/alerts/{hypo_id}/acknowledge", headers=headers)
    assert r_ack.status_code == 200
    assert r_ack.json()["status"] == "acknowledged"
    assert r_ack.json()["acknowledged_by"] == doctor.id

    # 5. Resolve the alert
    r_res = clean_client.post(f"/alerts/{hypo_id}/resolve", headers=headers)
    assert r_res.status_code == 200
    assert r_res.json()["status"] == "resolved"


def test_clinician_panel_aggregation_and_rbac(clean_client):
    db = SessionLocal()
    try:
        # Create Patient A and Patient B
        p_a = Patient(display_name="Panel Patient A", source="new", age=60, sex="F", bmi=29.0, hba1c_pct=9.2, fasting_glucose_mgdl=180.0)
        p_b = Patient(display_name="Panel Patient B", source="new", age=45, sex="M", bmi=24.0, hba1c_pct=6.1, fasting_glucose_mgdl=100.0)
        db.add_all([p_a, p_b])
        db.commit()
        db.refresh(p_a)
        db.refresh(p_b)

        from uuid import uuid4
        uid = uuid4().hex[:6]
        # Create doctor linked only to Patient A
        doc = User(email=f"panel.doc.{uid}@hospital.org", password_hash=hash_password("Pass123!"), full_name="Dr. Panel", role="clinician")
        # Create unlinked patient login
        pat_user = User(email=f"panel.patient.{uid}@hospital.org", password_hash=hash_password("Pass123!"), full_name="Pat", role="patient")
        db.add_all([doc, pat_user])
        db.commit()
        db.refresh(doc)
        db.refresh(pat_user)

        p_b.user_id = pat_user.id
        db.commit()

        # Link doctor to Patient A only
        link_a = CareTeamLink(patient_id=p_a.id, provider_user_id=doc.id, status="active", role_in_team="clinician")
        db.add(link_a)
        db.commit()

        p_a_id = p_a.id
        doc_token = create_access_token(data={"sub": str(doc.id), "email": doc.email, "role": doc.role})
        pat_token = create_access_token(data={"sub": str(pat_user.id), "email": pat_user.email, "role": pat_user.role})

    finally:
        db.close()

    # 1. Patient accessing /clinician/panel must get 403 Forbidden
    r_pat = clean_client.get("/clinician/panel", headers={"Authorization": f"Bearer {pat_token}"})
    assert r_pat.status_code == 403

    # 2. Clinician gets panel showing only linked patients (Patient A, but NOT Patient B)
    r_doc = clean_client.get("/clinician/panel", headers={"Authorization": f"Bearer {doc_token}"})
    assert r_doc.status_code == 200
    panel = r_doc.json()
    assert len(panel) == 1
    assert panel[0]["patient_id"] == p_a_id
    assert panel[0]["display_name"] == "Panel Patient A"
    assert "risk_score" in panel[0]
    assert "risk_level" in panel[0]
    assert "open_alerts_count" in panel[0]
    assert "twin_status" in panel[0]
    assert panel[0]["care_team_status"] == "active"
