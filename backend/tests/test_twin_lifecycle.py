"""
Tests for Strengthened Digital Twin Loop (Backend Lifecycle).

Covers:
- PredictionRecord creation on meal logging
- Reconciliation windows (3-hour postprandial window check)
- Memory updates (mem_n, running means advance upon reconciliation)
- Drift detection triggers with synthetic sequences (MAE spike > 30% and coverage < 60%)
- Alerts engine integration with suggested causes (medication, illness, sensor)
- Maturity score calculation and level thresholds (Population, Learning, Personalized, Well-calibrated)
- Idempotency (reconciling twice produces zero duplicate state)
- Accuracy and Maturity endpoints (GET /twin/{patient_id}/accuracy, /twin/{patient_id}/maturity)
"""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password
from app.db import SessionLocal
from app.main import app
from app.models_db import Alert, GlucoseReading, MealEntry, Patient, PredictionRecord, TwinState, User
from app.twin.lifecycle import (
    compute_twin_maturity,
    create_prediction_record_for_meal,
    detect_drift_metrics,
    is_window_covered,
    reconcile_patient_predictions,
)
from app.twin.memory import recompute_twin_state


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def setup_lifecycle_patient(db_session: Session):
    timestamp = int(datetime.now().timestamp() * 1000)

    # Patient user
    patient_user = User(
        email=f"patient_twin_lifecycle_{timestamp}@glucotwin.org",
        password_hash=hash_password("Pass123!"),
        full_name="Lifecycle Patient",
        role="patient",
    )
    db_session.add(patient_user)
    db_session.commit()
    db_session.refresh(patient_user)

    # Patient record
    patient = Patient(
        user_id=patient_user.id,
        display_name="Lifecycle Patient",
        is_synthetic=False,
        source="new",
        age=52,
        sex="M",
        bmi=27.4,
        hba1c_pct=7.1,
        fasting_glucose_mgdl=115.0,
        hypoglycemia_history=False,
        kidney_flag=False,
        current_meds=["Metformin 500mg"],
        created_at=datetime.now(timezone.utc) - timedelta(days=14),
    )
    db_session.add(patient)
    db_session.commit()
    db_session.refresh(patient)

    recompute_twin_state(patient.id, db_session)
    token = create_access_token(data={"sub": str(patient_user.id), "email": patient_user.email, "role": "patient"})

    return {
        "patient": patient,
        "user": patient_user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


# ============================================================================
# 1. Prediction Record & Reconciliation Window Tests
# ============================================================================

def test_meal_logging_creates_prediction_record(client: TestClient, db_session: Session, setup_lifecycle_patient):
    patient = setup_lifecycle_patient["patient"]
    headers = setup_lifecycle_patient["headers"]

    now = datetime.now(timezone.utc)
    meal_payload = {
        "logged_at": now.isoformat(),
        "carbs_g": 60.0,
        "protein_g": 20.0,
        "fat_g": 15.0,
        "calories": 455.0,
        "pre_glucose": 110.0,
        "pre_trend30": 0.0,
    }

    res = client.post(f"/patients/{patient.id}/meals", json=meal_payload, headers=headers)
    assert res.status_code == 201
    meal_data = res.json()
    meal_id = meal_data["id"]

    # Check prediction record exists
    pred_record = db_session.query(PredictionRecord).filter(PredictionRecord.meal_id == meal_id).first()
    assert pred_record is not None
    assert pred_record.patient_id == patient.id
    assert pred_record.predicted_peak_rise > 0
    assert pred_record.p10 <= pred_record.predicted_peak_rise <= pred_record.p90
    assert pred_record.reconciled_at is None


def test_reconciliation_3hour_window(db_session: Session, setup_lifecycle_patient):
    patient = setup_lifecycle_patient["patient"]
    base_time = datetime.now(timezone.utc) - timedelta(hours=5)

    # Create a meal 5 hours ago
    meal = MealEntry(
        patient_id=patient.id,
        logged_at=base_time,
        carbs_g=55.0,
        protein_g=18.0,
        fat_g=12.0,
        calories=400.0,
        pre_glucose=100.0,
        pre_trend30=0.0,
    )
    db_session.add(meal)
    db_session.commit()
    db_session.refresh(meal)

    # Initial forecast
    pred = create_prediction_record_for_meal(meal, patient.id, db_session)
    assert pred.reconciled_at is None

    # Case A: No readings -> window not covered
    readings = db_session.query(GlucoseReading).filter(GlucoseReading.patient_id == patient.id).all()
    covered, _ = is_window_covered(meal, readings)
    assert covered is False

    # Case B: Only 1 early reading at +15 min -> window not covered
    early_reading = GlucoseReading(
        patient_id=patient.id,
        ts=base_time + timedelta(minutes=15),
        value_mgdl=108.0,
        source="manual",
    )
    db_session.add(early_reading)
    db_session.commit()

    reconciled = reconcile_patient_predictions(patient.id, db_session)
    assert reconciled == 0
    db_session.refresh(pred)
    assert pred.reconciled_at is None

    # Case C: Readings covering 2h post-meal with peak at +75m and final reading past +120m
    peak_reading = GlucoseReading(
        patient_id=patient.id,
        ts=base_time + timedelta(minutes=75),
        value_mgdl=145.0,
        source="manual",
    )
    late_reading = GlucoseReading(
        patient_id=patient.id,
        ts=base_time + timedelta(minutes=135),
        value_mgdl=118.0,
        source="manual",
    )
    db_session.add_all([peak_reading, late_reading])
    db_session.commit()

    # Now reconciliation should succeed
    reconciled = reconcile_patient_predictions(patient.id, db_session)
    assert reconciled == 1

    db_session.refresh(pred)
    assert pred.reconciled_at is not None
    # Peak is 145.0, pre_glucose was 100.0 -> actual_peak_rise = 45.0
    assert pred.actual_peak_rise == 45.0
    assert pred.error == round(45.0 - pred.predicted_peak_rise, 2)
    assert pred.in_range == (pred.p10 <= 45.0 <= pred.p90)


# ============================================================================
# 2. Idempotency & Personalization Memory Update Tests
# ============================================================================

def test_reconciliation_idempotency_and_memory_update(db_session: Session, setup_lifecycle_patient):
    patient = setup_lifecycle_patient["patient"]
    initial_state = db_session.query(TwinState).filter(TwinState.patient_id == patient.id).first()
    initial_mem_n = initial_state.mem_n if initial_state else 0

    meal_time = datetime.now(timezone.utc) - timedelta(hours=4)
    meal = MealEntry(
        patient_id=patient.id,
        logged_at=meal_time,
        carbs_g=50.0,
        protein_g=20.0,
        fat_g=10.0,
        calories=370.0,
        pre_glucose=105.0,
        pre_trend30=0.0,
    )
    db_session.add(meal)
    db_session.commit()
    db_session.refresh(meal)

    pred = create_prediction_record_for_meal(meal, patient.id, db_session)

    # Post glucose readings spanning full 3h
    for mins, val in [(30, 130.0), (60, 155.0), (120, 125.0), (180, 108.0)]:
        r = GlucoseReading(
            patient_id=patient.id,
            ts=meal_time + timedelta(minutes=mins),
            value_mgdl=val,
            source="manual",
        )
        db_session.add(r)
    db_session.commit()

    # First reconciliation run
    count1 = reconcile_patient_predictions(patient.id, db_session)
    assert count1 == 1

    db_session.refresh(pred)
    first_reconciled_at = pred.reconciled_at
    first_error = pred.error
    assert first_reconciled_at is not None

    # Check that twin memory updated
    db_session.refresh(initial_state)
    assert initial_state.mem_n == initial_mem_n + 1

    # Second reconciliation run (idempotency check)
    count2 = reconcile_patient_predictions(patient.id, db_session)
    assert count2 == 0  # Nothing changed

    db_session.refresh(pred)
    assert pred.reconciled_at == first_reconciled_at
    assert pred.error == first_error
    db_session.refresh(initial_state)
    assert initial_state.mem_n == initial_mem_n + 1  # Memory not double incremented


# ============================================================================
# 3. Model Drift Detection & Alerts Engine Trigger Tests
# ============================================================================

def test_drift_detection_synthetic_sequence_mae_spike():
    """Synthetic sequence where MAE jumps > 30% above earlier baseline."""
    now = datetime.now(timezone.utc)
    synthetic_records = []

    # First 10 records: well calibrated, low error ~ 8 mg/dL
    for i in range(10):
        rec = PredictionRecord(
            patient_id=1,
            predicted_peak_rise=35.0,
            p10=25.0,
            p90=45.0,
            actual_peak_rise=33.0 if i % 2 == 0 else 42.0,
            error=2.0 if i % 2 == 0 else 7.0,
            in_range=True,
            created_at=now - timedelta(days=20 - i),
            reconciled_at=now - timedelta(days=20 - i),
        )
        synthetic_records.append(rec)

    # Next 10 records: massive errors (e.g. 26 mg/dL error) -> spike > 30%
    for i in range(10, 20):
        rec = PredictionRecord(
            patient_id=1,
            predicted_peak_rise=35.0,
            p10=25.0,
            p90=45.0,
            actual_peak_rise=65.0,
            error=30.0,
            in_range=False,
            created_at=now - timedelta(days=20 - i),
            reconciled_at=now - timedelta(days=20 - i),
        )
        synthetic_records.append(rec)

    metrics = detect_drift_metrics(synthetic_records, rolling_n=20)
    assert metrics["drift_detected"] is True
    assert "increased" in metrics["reason"] or "below" in metrics["reason"]
    assert metrics["rolling_mae"] > 1.30 * (metrics["baseline_mae"] or 14.0)


def test_drift_detection_coverage_drop_triggers_alert(db_session: Session, setup_lifecycle_patient):
    """Interval coverage dropping below 60% creates a TWIN_MODEL_DRIFT alert with suggested causes."""
    patient = setup_lifecycle_patient["patient"]
    now = datetime.now(timezone.utc)

    # Clear any previous alerts
    db_session.query(Alert).filter(Alert.patient_id == patient.id).delete()
    db_session.commit()

    # Insert 10 reconciled predictions with only 30% coverage (7 out of range)
    for i in range(10):
        in_range = (i < 3)  # only 3 out of 10 in range = 30% coverage
        rec = PredictionRecord(
            patient_id=patient.id,
            predicted_peak_rise=38.0,
            p10=30.0,
            p90=46.0,
            actual_peak_rise=40.0 if in_range else 68.0,
            error=2.0 if in_range else 30.0,
            in_range=in_range,
            created_at=now - timedelta(hours=20 - i),
            reconciled_at=now - timedelta(hours=20 - i),
        )
        db_session.add(rec)
    db_session.commit()

    reconciled = (
        db_session.query(PredictionRecord)
        .filter(PredictionRecord.patient_id == patient.id)
        .all()
    )
    metrics = detect_drift_metrics(reconciled)
    assert metrics["drift_detected"] is True
    assert metrics["coverage_pct"] < 60.0

    # Evaluate alerts engine
    from app.twin.lifecycle import check_and_sync_drift_alert
    alert = check_and_sync_drift_alert(patient.id, db_session)
    assert alert is not None
    assert alert.rule_key == "TWIN_MODEL_DRIFT"
    assert "medication" in alert.message.lower()
    assert "illness" in alert.message.lower()
    assert "sensor" in alert.message.lower()


# ============================================================================
# 4. Maturity Scoring & Thresholds Tests
# ============================================================================

def test_twin_maturity_levels(db_session: Session, setup_lifecycle_patient):
    patient = setup_lifecycle_patient["patient"]

    # Initial state with mem_n == 0 -> Population
    maturity = compute_twin_maturity(patient.id, db_session)
    assert maturity["level"] == "Population"
    assert maturity["score"] < 35.0
    assert len(maturity["timeline"]) >= 1

    # Simulate Learning level (mem_n = 8)
    twin_state = db_session.query(TwinState).filter(TwinState.patient_id == patient.id).first()
    twin_state.mem_n = 8
    db_session.commit()

    maturity_learning = compute_twin_maturity(patient.id, db_session)
    assert maturity_learning["level"] in ("Population", "Learning")

    # Simulate Well-calibrated (mem_n = 30, high coverage, low MAE)
    twin_state.mem_n = 30
    now = datetime.now(timezone.utc)
    for i in range(25):
        rec = PredictionRecord(
            patient_id=patient.id,
            predicted_peak_rise=35.0,
            p10=26.0,
            p90=44.0,
            actual_peak_rise=36.0,
            error=1.0,
            in_range=True,
            created_at=now - timedelta(days=26 - i),
            reconciled_at=now - timedelta(days=26 - i),
        )
        db_session.add(rec)
    db_session.commit()

    maturity_calibrated = compute_twin_maturity(patient.id, db_session)
    assert maturity_calibrated["score"] >= 80.0
    assert maturity_calibrated["level"] == "Well-calibrated"
    assert maturity_calibrated["components"]["memory_score"] > 35.0
    assert maturity_calibrated["components"]["accuracy_score"] > 25.0


# ============================================================================
# 5. REST Endpoints Tests (/twin/{patient_id}/accuracy & /maturity)
# ============================================================================

def test_twin_accuracy_and_maturity_endpoints(client: TestClient, setup_lifecycle_patient):
    patient = setup_lifecycle_patient["patient"]
    headers = setup_lifecycle_patient["headers"]

    # GET /twin/{patient_id}/accuracy
    res_acc = client.get(f"/twin/{patient.id}/accuracy", headers=headers)
    assert res_acc.status_code == 200
    acc_data = res_acc.json()
    assert "patient_id" in acc_data
    assert "total_predictions" in acc_data
    assert "reconciled_count" in acc_data
    assert "history" in acc_data

    # GET /twin/{patient_id}/maturity
    res_mat = client.get(f"/twin/{patient.id}/maturity", headers=headers)
    assert res_mat.status_code == 200
    mat_data = res_mat.json()
    assert "score" in mat_data
    assert "level" in mat_data
    assert "components" in mat_data
    assert "timeline" in mat_data

    # POST /twin/{patient_id}/reconcile
    res_rec = client.post(f"/twin/{patient.id}/reconcile", headers=headers)
    assert res_rec.status_code == 200
    rec_data = res_rec.json()
    assert "reconciled_count" in rec_data
