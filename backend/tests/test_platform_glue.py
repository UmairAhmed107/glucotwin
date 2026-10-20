"""
Tests for Platform Glue:
- Messaging: Thread and Message models, unread counts, contextual linking (visit, alert, scenario), role permissions.
- Data Import: Generic CSV, Libre-style CSV, de-duplication by timestamp, mmol/L to mg/dL conversion, error reporting, alert & reconciliation triggering.
- Wearables Import: Daily steps and sleep hours, validation, display-only context.
- Weekly Report Generator: TIR, best/worst meals, twin accuracy, adherence, plan progress, JSON and PDF generation.
- FHIR-Style Export: Simplified Bundle with Patient, Observation (glucose, HbA1c, eGFR), MedicationStatement, and docstring disclaimer.
"""

from datetime import datetime, timedelta, timezone
import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password
from app.db import get_db
from app.main import app
from app.models_db import (
    Alert,
    CarePlan,
    CarePlanTask,
    CareTeamLink,
    DoseLog,
    GlucoseReading,
    MealEntry,
    Medication,
    Patient,
    PredictionRecord,
    User,
    Visit,
    WearableDaily,
)
from app.routers.export import export_patient_fhir_bundle


@pytest.fixture
def clean_client(db_session: Session):
    """Test client with NO auth overrides, testing true JWT tokens."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()


@pytest.fixture
def glue_fixture(db_session: Session):
    timestamp = int(datetime.now().timestamp() * 1000)

    # 1. Clinician (with CareTeamLink)
    clinician = User(
        email=f"dr.care_{timestamp}@glucotwin.org",
        password_hash=hash_password("Pass123!"),
        full_name="Dr. Sarah Care",
        role="clinician",
    )
    # 2. Unauthorized Clinician (without CareTeamLink)
    unauth_clinician = User(
        email=f"dr.unauth_{timestamp}@glucotwin.org",
        password_hash=hash_password("Pass123!"),
        full_name="Dr. Unauth",
        role="clinician",
    )
    # 3. Patient User
    patient_user = User(
        email=f"pat.glue_{timestamp}@glucotwin.org",
        password_hash=hash_password("Pass123!"),
        full_name="Pat Glue",
        role="patient",
    )
    # 4. Another Patient User
    other_patient_user = User(
        email=f"other.pat_{timestamp}@glucotwin.org",
        password_hash=hash_password("Pass123!"),
        full_name="Other Pat",
        role="patient",
    )

    db_session.add_all([clinician, unauth_clinician, patient_user, other_patient_user])
    db_session.commit()

    # Create Patient records
    patient = Patient(
        user_id=patient_user.id,
        display_name="Pat Glue",
        is_synthetic=True,
        source="new",
        age=52,
        sex="F",
        bmi=28.4,
        hba1c_pct=7.6,
        fasting_glucose_mgdl=135.0,
        hypoglycemia_history=False,
        kidney_flag=True,
        current_meds=["Metformin", "SGLT2i"],
    )
    other_patient = Patient(
        user_id=other_patient_user.id,
        display_name="Other Pat",
        is_synthetic=True,
        source="new",
        age=48,
        sex="M",
        bmi=26.0,
        hba1c_pct=6.5,
        fasting_glucose_mgdl=108.0,
        hypoglycemia_history=False,
        kidney_flag=False,
        current_meds=["Metformin"],
    )
    db_session.add_all([patient, other_patient])
    db_session.commit()

    # Active Care Team Link between Dr. Care and Pat Glue
    link = CareTeamLink(
        patient_id=patient.id,
        provider_user_id=clinician.id,
        role_in_team="endocrinologist",
        status="active",
    )
    db_session.add(link)
    db_session.commit()

    # Tokens
    tokens = {
        "clinician": create_access_token({"sub": str(clinician.id)}),
        "unauth_clinician": create_access_token({"sub": str(unauth_clinician.id)}),
        "patient": create_access_token({"sub": str(patient_user.id)}),
        "other_patient": create_access_token({"sub": str(other_patient_user.id)}),
    }

    return {
        "clinician": clinician,
        "unauth_clinician": unauth_clinician,
        "patient_user": patient_user,
        "other_patient_user": other_patient_user,
        "patient": patient,
        "other_patient": other_patient,
        "tokens": tokens,
    }


# ===========================================================================
# 1. Messaging Permissions & Contextual Links Tests
# ===========================================================================

def test_messaging_permissions_and_links(clean_client: TestClient, glue_fixture, db_session: Session):
    tokens = glue_fixture["tokens"]
    patient = glue_fixture["patient"]
    clinician = glue_fixture["clinician"]

    # Create a dummy visit and alert for contextual linking
    visit = Visit(
        patient_id=patient.id,
        clinician_id=clinician.id,
        scheduled_at=datetime.now(timezone.utc) + timedelta(days=2),
        status="scheduled",
    )
    alert = Alert(
        patient_id=patient.id,
        rule_key="POSTPRANDIAL_SPIKE",
        severity="warning",
        message="Postprandial glucose exceeded 180 mg/dL",
        status="open",
    )
    db_session.add_all([visit, alert])
    db_session.commit()

    # 1. Patient creates a thread linked to the visit
    thread_payload = {
        "patient_id": patient.id,
        "title": "Upcoming visit question regarding fasting",
        "initial_message": "Hello Dr. Care, do I need to fast before our scheduled appointment?",
        "topic_type": "visit",
        "topic_id": str(visit.id),
    }
    resp = clean_client.post(
        "/messages/threads",
        json=thread_payload,
        headers={"Authorization": f"Bearer {tokens['patient']}"},
    )
    assert resp.status_code == 201, resp.text
    thread_data = resp.json()
    thread_id = thread_data["id"]
    assert thread_data["title"] == "Upcoming visit question regarding fasting"
    assert thread_data["topic_type"] == "visit"
    assert thread_data["topic_id"] == str(visit.id)
    assert len(thread_data["messages"]) == 1

    # 2. Unauthorized clinician tries to read thread -> 403 Forbidden
    resp = clean_client.get(
        f"/messages/threads/{thread_id}",
        headers={"Authorization": f"Bearer {tokens['unauth_clinician']}"},
    )
    assert resp.status_code == 403

    # 3. Other patient tries to read thread -> 403 Forbidden
    resp = clean_client.get(
        f"/messages/threads/{thread_id}",
        headers={"Authorization": f"Bearer {tokens['other_patient']}"},
    )
    assert resp.status_code == 403

    # 4. Authorized clinician reads thread and sees 1 unread message
    resp = clean_client.get(
        f"/messages/threads/{thread_id}",
        headers={"Authorization": f"Bearer {tokens['clinician']}"},
    )
    assert resp.status_code == 200
    assert resp.json()["unread_count"] == 1

    # 5. Clinician replies to thread
    resp = clean_client.post(
        f"/messages/threads/{thread_id}/messages",
        json={"content": "Yes Alex, please fast for 8 hours prior to the lab draw."},
        headers={"Authorization": f"Bearer {tokens['clinician']}"},
    )
    assert resp.status_code == 201
    reply_data = resp.json()
    assert reply_data["content"] == "Yes Alex, please fast for 8 hours prior to the lab draw."
    assert reply_data["sender_role"] == "clinician"

    # 6. Patient checks threads list and verifies unread count is 1 (clinician's reply)
    resp = clean_client.get(
        "/messages/threads",
        headers={"Authorization": f"Bearer {tokens['patient']}"},
    )
    assert resp.status_code == 200
    threads = resp.json()
    matched = next((t for t in threads if t["id"] == thread_id), None)
    assert matched is not None
    assert matched["unread_count"] == 1

    # 7. Patient marks thread as read -> unread count becomes 0
    resp = clean_client.post(
        f"/messages/threads/{thread_id}/read",
        headers={"Authorization": f"Bearer {tokens['patient']}"},
    )
    assert resp.status_code == 200
    assert resp.json()["unread_count"] == 0

    # 8. Check total unread count endpoint
    resp = clean_client.get(
        "/messages/unread-count",
        headers={"Authorization": f"Bearer {tokens['patient']}"},
    )
    assert resp.status_code == 200
    assert resp.json()["unread_count"] == 0


# ===========================================================================
# 2. CGM Data Import (Generic CSV, De-duplication, Bounds, Side Effects)
# ===========================================================================

def test_cgm_import_generic_csv_and_deduplication(clean_client: TestClient, glue_fixture, db_session: Session):
    tokens = glue_fixture["tokens"]
    patient = glue_fixture["patient"]

    # Pre-populate one existing reading to test cross-DB de-duplication
    existing_ts = datetime(2026, 3, 10, 8, 0, tzinfo=timezone.utc)
    db_session.add(
        GlucoseReading(
            patient_id=patient.id,
            ts=existing_ts,
            value_mgdl=110.0,
            source="manual",
        )
    )
    # Add a meal entry and prediction record so reconciliation gets triggered
    meal = MealEntry(
        patient_id=patient.id,
        logged_at=datetime(2026, 3, 10, 7, 55, tzinfo=timezone.utc),
        carbs_g=50.0,
        protein_g=20.0,
        fat_g=10.0,
        calories=370.0,
        pre_glucose=105.0,
        pre_trend30=0.0,
    )
    db_session.add(meal)
    db_session.flush()

    pred = PredictionRecord(
        patient_id=patient.id,
        meal_id=meal.id,
        predicted_peak_rise=35.0,
        p10=20.0,
        p90=50.0,
    )
    db_session.add(pred)
    db_session.commit()

    # CSV with:
    # - 1 duplicate matching DB (2026-03-10 08:00:00) -> should be skipped
    # - 2 valid readings (2026-03-10 08:15:00, 2026-03-10 08:30:00) -> should be accepted
    # - 1 duplicate within CSV (2026-03-10 08:15:00 again) -> should be skipped
    # - 1 bad timestamp row -> skipped with error
    # - 1 non-numeric glucose row -> skipped with error
    # - 1 impossible glucose (1200 mg/dL) -> skipped with error
    csv_content = """timestamp,glucose
2026-03-10 08:00:00,110.0
2026-03-10 08:15:00,125.0
2026-03-10 08:30:00,140.0
2026-03-10 08:15:00,125.0
INVALID_DATE,130.0
2026-03-10 08:45:00,NOT_A_NUMBER
2026-03-10 09:00:00,1200.0
"""
    files = {"file": ("cgm_test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    resp = clean_client.post(
        f"/import/cgm?patient_id={patient.id}",
        files=files,
        headers={"Authorization": f"Bearer {tokens['clinician']}"},
    )
    assert resp.status_code == 200, resp.text
    report = resp.json()

    assert report["rows_accepted"] == 2  # 08:15 and 08:30
    assert report["rows_skipped"] == 5  # 1 DB dup + 1 CSV dup + 3 invalid rows
    assert len(report["errors"]) >= 3
    assert report["units_detected"] == "mg/dL"


# ===========================================================================
# 3. CGM Data Import (Abbott Libre format & mmol/L to mg/dL Conversion)
# ===========================================================================

def test_cgm_import_libre_mmol_conversion(clean_client: TestClient, glue_fixture, db_session: Session):
    tokens = glue_fixture["tokens"]
    patient = glue_fixture["patient"]

    # Typical Abbott Libre export with metadata preface rows and mmol/L values
    libre_csv = """FreeStyle Libre Clinical Export
Device ID,123456789
Generated,2026-03-10
Meter Timestamp,Scan Glucose mmol/L,Historic Glucose mmol/L
10-03-2026 10:00,,5.5
10-03-2026 10:15,,7.2
10-03-2026 10:30,,8.0
10-03-2026 10:45,,6.1
"""
    files = {"file": ("libre_export.csv", io.BytesIO(libre_csv.encode("utf-8")), "text/csv")}
    resp = clean_client.post(
        f"/import/cgm?patient_id={patient.id}",
        files=files,
        headers={"Authorization": f"Bearer {tokens['patient']}"},
    )
    assert resp.status_code == 200, resp.text
    report = resp.json()

    assert report["rows_accepted"] == 4
    assert "mmol/L" in report["units_detected"]

    # Verify that values in database were converted to mg/dL (~18.0182x)
    # 5.5 mmol/L * 18.0182 = 99.1 mg/dL
    reading = (
        db_session.query(GlucoseReading)
        .filter(
            GlucoseReading.patient_id == patient.id,
            GlucoseReading.source == "cgm_import",
        )
        .order_by(GlucoseReading.ts.asc())
        .first()
    )
    assert reading is not None
    assert 98.0 <= reading.value_mgdl <= 100.5


# ===========================================================================
# 4. Wearable Telemetry Import & Display
# ===========================================================================

def test_wearables_import_and_display(clean_client: TestClient, glue_fixture, db_session: Session):
    tokens = glue_fixture["tokens"]
    patient = glue_fixture["patient"]

    wearable_csv = """Date,Daily Steps,Sleep Hours
2026-03-01,8450,7.5
2026-03-02,10200,8.0
2026-03-03,6100,6.2
INVALID_DATE,5000,7.0
"""
    files = {"file": ("wearables.csv", io.BytesIO(wearable_csv.encode("utf-8")), "text/csv")}
    resp = clean_client.post(
        f"/import/wearables?patient_id={patient.id}",
        files=files,
        headers={"Authorization": f"Bearer {tokens['clinician']}"},
    )
    assert resp.status_code == 200, resp.text
    report = resp.json()
    assert report["rows_accepted"] == 3
    assert report["rows_skipped"] == 1

    # Verify query returns wearable data
    resp = clean_client.get(
        f"/patients/{patient.id}/wearables",
        headers={"Authorization": f"Bearer {tokens['clinician']}"},
    )
    assert resp.status_code == 200
    wearables = resp.json()
    assert len(wearables) == 3
    assert wearables[0]["steps"] in (8450, 10200, 6100)
    assert wearables[0]["sleep_hours"] > 0.0


# ===========================================================================
# 5. Weekly Report Generator (JSON & PDF)
# ===========================================================================

def test_weekly_report_totals_and_pdf(clean_client: TestClient, glue_fixture, db_session: Session):
    tokens = glue_fixture["tokens"]
    patient = glue_fixture["patient"]

    # Seed glucose readings (TIR testing: 1 low, 3 in-range, 1 high)
    now = datetime.now(timezone.utc)
    readings = [
        GlucoseReading(patient_id=patient.id, ts=now - timedelta(hours=5), value_mgdl=65.0),   # TBR < 70
        GlucoseReading(patient_id=patient.id, ts=now - timedelta(hours=4), value_mgdl=100.0),  # TIR 70-180
        GlucoseReading(patient_id=patient.id, ts=now - timedelta(hours=3), value_mgdl=120.0),  # TIR 70-180
        GlucoseReading(patient_id=patient.id, ts=now - timedelta(hours=2), value_mgdl=150.0),  # TIR 70-180
        GlucoseReading(patient_id=patient.id, ts=now - timedelta(hours=1), value_mgdl=195.0),  # TAR > 180
    ]
    # Seed care plan
    plan = CarePlan(patient_id=patient.id, title="Weekly Test Plan", status="active")
    db_session.add(plan)
    db_session.flush()

    task1 = CarePlanTask(care_plan_id=plan.id, patient_id=patient.id, title="Walk", due_date=now, category="lifestyle", status="completed")
    task2 = CarePlanTask(care_plan_id=plan.id, patient_id=patient.id, title="Hydrate", due_date=now, category="lifestyle", status="pending")

    db_session.add_all(readings + [task1, task2])
    db_session.commit()

    # 1. Trigger generation via POST endpoint
    resp = clean_client.post(
        f"/reports/weekly/{patient.id}/generate",
        headers={"Authorization": f"Bearer {tokens['clinician']}"},
    )
    assert resp.status_code == 200, resp.text
    rep_json = resp.json()

    # Verify report totals
    assert rep_json["patient_id"] == patient.id
    tir = rep_json["tir_stats"]
    assert tir["total_readings"] == 5
    assert tir["tir_pct"] == 60.0  # 3 / 5 = 60%
    assert tir["tar_pct"] == 20.0  # 1 / 5 = 20%
    assert tir["tbr_pct"] == 20.0  # 1 / 5 = 20%

    plan_prog = rep_json["plan_progress"]
    assert plan_prog["completed_tasks"] == 1
    assert plan_prog["total_tasks"] == 2
    assert plan_prog["progress_pct"] == 50.0

    # 2. PDF Download Endpoint
    resp_pdf = clean_client.get(
        f"/reports/weekly/{patient.id}/pdf",
        headers={"Authorization": f"Bearer {tokens['patient']}"},
    )
    assert resp_pdf.status_code == 200
    assert resp_pdf.headers["content-type"] == "application/pdf"
    assert resp_pdf.content.startswith(b"%PDF-")


# ===========================================================================
# 6. Simplified FHIR Bundle Export
# ===========================================================================

def test_fhir_bundle_export(clean_client: TestClient, glue_fixture, db_session: Session):
    tokens = glue_fixture["tokens"]
    patient = glue_fixture["patient"]

    # Verify docstring clearly states simplified subset
    docstring = export_patient_fhir_bundle.__doc__
    assert docstring is not None
    assert "simplified subset" in docstring.lower()

    # Seed medication
    med = Medication(
        patient_id=patient.id,
        name="Metformin Hydrochloride",
        dosage="500 mg twice daily",
        schedule="with_meals",
        frequency_per_day=2,
        is_active=True,
    )
    db_session.add(med)
    db_session.commit()

    resp = clean_client.get(
        f"/export/fhir/{patient.id}",
        headers={"Authorization": f"Bearer {tokens['clinician']}"},
    )
    assert resp.status_code == 200, resp.text
    bundle = resp.json()

    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "collection"
    assert "entry" in bundle
    entries = bundle["entry"]

    # Identify resources by resourceType
    resource_types = [e["resource"]["resourceType"] for e in entries]
    assert "Patient" in resource_types
    assert "Observation" in resource_types
    assert "MedicationStatement" in resource_types

    # Validate Observation codes (HbA1c, eGFR, Glucose)
    obs_codes = []
    for e in entries:
        if e["resource"]["resourceType"] == "Observation":
            codings = e["resource"]["code"].get("coding", [])
            for c in codings:
                obs_codes.append(c.get("code"))

    assert "4548-4" in obs_codes  # HbA1c
    assert "33914-3" in obs_codes  # eGFR
    assert "1558-6" in obs_codes or "2339-0" in obs_codes  # Glucose
