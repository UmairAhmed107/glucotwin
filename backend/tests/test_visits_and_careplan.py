from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password
from app.db import SessionLocal
from app.main import app
from app.models_db import (
    CarePlan,
    CarePlanTask,
    CareTeamLink,
    GlucoseReading,
    MealEntry,
    Patient,
    RecommendationDraft,
    User,
    Visit,
)


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
def setup_visit_users_and_patients(db_session: Session):
    timestamp = int(datetime.now().timestamp() * 1000)

    # 1. Clinician User
    clinician = User(
        email=f"dr.smith_{timestamp}@glucotwin.org",
        password_hash=hash_password("Pass123!"),
        full_name="Dr. Smith",
        role="clinician",
    )
    # 2. Other Clinician
    other_clinician = User(
        email=f"dr.other_{timestamp}@glucotwin.org",
        password_hash=hash_password("Pass123!"),
        full_name="Dr. Other",
        role="clinician",
    )
    # 3. Patient User
    patient_user = User(
        email=f"patient.visit_{timestamp}@glucotwin.org",
        password_hash=hash_password("Pass123!"),
        full_name="Alex Visit",
        role="patient",
    )
    db_session.add_all([clinician, other_clinician, patient_user])
    db_session.flush()

    # 4. Patient Record (with hypoglycemia history to trigger R4 governor block)
    patient = Patient(
        user_id=patient_user.id,
        display_name="Alex Visit",
        source="new",
        age=56,
        sex="M",
        bmi=28.4,
        hba1c_pct=8.2,
        fasting_glucose_mgdl=145.0,
        hypoglycemia_history=True,  # triggers Governor R4
        kidney_flag=True,  # triggers Governor R5
        current_meds=["metformin"],
    )
    db_session.add(patient)
    db_session.flush()

    # Add readings for 14-day stats
    now = datetime.now(timezone.utc)
    for i in range(10):
        db_session.add(
            GlucoseReading(
                patient_id=patient.id,
                ts=now - timedelta(days=i, hours=2),
                value_mgdl=110.0 + (i * 10.0),
            )
        )
    # Add a hypo reading
    db_session.add(
        GlucoseReading(
            patient_id=patient.id,
            ts=now - timedelta(hours=5),
            value_mgdl=52.0,
        )
    )

    # Active care team link with Dr. Smith
    link = CareTeamLink(
        patient_id=patient.id,
        provider_user_id=clinician.id,
        role_in_team="primary_clinician",
        status="active",
    )
    db_session.add(link)
    db_session.commit()

    tokens = {
        "clinician": create_access_token({"sub": str(clinician.id), "email": clinician.email, "role": "clinician"}),
        "other_clinician": create_access_token({"sub": str(other_clinician.id), "email": other_clinician.email, "role": "clinician"}),
        "patient": create_access_token({"sub": str(patient_user.id), "email": patient_user.email, "role": "patient"}),
    }

    return {
        "clinician": clinician,
        "other_clinician": other_clinician,
        "patient_user": patient_user,
        "patient": patient,
        "tokens": tokens,
    }


def test_create_visit_and_pre_visit_summary(client: TestClient, setup_visit_users_and_patients):
    data = setup_visit_users_and_patients
    token = data["tokens"]["clinician"]
    patient_id = data["patient"].id

    res = client.post(
        f"/patients/{patient_id}/visits",
        json={"notes": "Initial diabetes management review"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "scheduled"
    assert body["patient_id"] == patient_id
    assert body["notes"] == "Initial diabetes management review"

    # Pre-visit summary verification
    summary = body["pre_visit_summary"]
    assert summary is not None
    assert summary["glucose_stats_14d"]["reading_count"] > 0
    assert summary["glucose_stats_14d"]["hypo_events_count"] >= 1
    assert summary["glucose_stats_14d"]["critical_hypo_count"] >= 1
    assert summary["twin_patterns"]["representative_meal_rise_mgdl"] > 0
    assert summary["biomarkers"]["hba1c_pct"] == 8.2
    assert summary["biomarkers"]["kidney_flag"] is True

    # Draft recommendations were generated
    assert len(body["drafts"]) > 0


def test_governor_blocked_draft_cannot_be_approved(client: TestClient, setup_visit_users_and_patients, db_session: Session):
    data = setup_visit_users_and_patients
    token = data["tokens"]["clinician"]
    patient_id = data["patient"].id

    # Create visit
    res_v = client.post(
        f"/patients/{patient_id}/visits",
        headers={"Authorization": f"Bearer {token}"},
    )
    visit_id = res_v.json()["id"]

    # Locate the governor-blocked draft (patient has hypoglycemia history -> sulfonylurea is blocked)
    drafts = res_v.json()["drafts"]
    blocked_draft = next((d for d in drafts if d.get("governor_trace", {}).get("blocked") is True), None)
    assert blocked_draft is not None, "Expected at least one governor-blocked draft for patient with hypo history"

    # Attempt to approve the blocked draft -> MUST return 400 Bad Request
    res_approve = client.put(
        f"/visits/drafts/{blocked_draft['id']}",
        json={"status": "approved", "clinician_comment": "Trying to force approval"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_approve.status_code == 400, res_approve.text
    err_msg = res_approve.json().get("error", {}).get("message") or res_approve.json().get("detail", "")
    assert "Cannot approve recommendation draft that failed deterministic safety governor checks" in err_msg

    # But rejecting or keeping rejected is permitted
    res_reject = client.put(
        f"/visits/drafts/{blocked_draft['id']}",
        json={"status": "rejected", "clinician_comment": "Acknowledged governor contraindication"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "rejected"


def test_visit_state_transitions_and_review_workflow(client: TestClient, setup_visit_users_and_patients):
    data = setup_visit_users_and_patients
    token = data["tokens"]["clinician"]
    patient_id = data["patient"].id

    # 1. Create Visit (Scheduled)
    res_v = client.post(
        f"/patients/{patient_id}/visits",
        headers={"Authorization": f"Bearer {token}"},
    )
    visit_id = res_v.json()["id"]
    assert res_v.json()["status"] == "scheduled"

    # 2. Start Visit (In Progress)
    res_start = client.post(
        f"/visits/{visit_id}/start",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_start.status_code == 200
    assert res_start.json()["status"] == "in_progress"

    # 3. Review clean drafts: approve one, edit one
    drafts = res_start.json()["drafts"]
    clean_drafts = [d for d in drafts if not d.get("governor_trace", {}).get("blocked")]
    assert len(clean_drafts) >= 2

    # Approve draft 1
    d1 = clean_drafts[0]
    res_d1 = client.put(
        f"/visits/drafts/{d1['id']}",
        json={"status": "approved", "clinician_comment": "Approved therapy per ADA guidelines"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_d1.status_code == 200
    assert res_d1.json()["status"] == "approved"
    assert res_d1.json()["clinician_comment"] == "Approved therapy per ADA guidelines"

    # Edit draft 2
    d2 = clean_drafts[1]
    res_d2 = client.put(
        f"/visits/drafts/{d2['id']}",
        json={
            "status": "edited",
            "title": "Custom Post-Meal Activity Regimen",
            "detail": "15-minute walk after lunch; 10-minute walk after dinner.",
            "clinician_comment": "Tailored to patient daily work schedule",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_d2.status_code == 200
    assert res_d2.json()["status"] == "edited"
    assert res_d2.json()["title"] == "Custom Post-Meal Activity Regimen"

    # 4. Complete Visit (Completed) -> publishes final plan & creates CarePlan
    res_complete = client.post(
        f"/visits/{visit_id}/complete?notes=Patient%20agreed%20to%20lifestyle%20and%20therapy%20changes",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_complete.status_code == 200
    comp_body = res_complete.json()
    assert comp_body["status"] == "completed"
    assert comp_body["completed_at"] is not None

    final_plan = comp_body["final_plan"]
    assert final_plan is not None
    # Only approved and edited items are included
    approved_items = final_plan["approved_recommendations"]
    assert len(approved_items) >= 2
    statuses = {item["status"] for item in approved_items}
    assert statuses.issubset({"approved", "edited"})


def test_care_plan_and_task_generation(client: TestClient, setup_visit_users_and_patients):
    data = setup_visit_users_and_patients
    clin_token = data["tokens"]["clinician"]
    patient_token = data["tokens"]["patient"]
    patient_id = data["patient"].id

    # Create and complete visit
    res_v = client.post(f"/patients/{patient_id}/visits", headers={"Authorization": f"Bearer {clin_token}"})
    v_id = res_v.json()["id"]

    # Approve clean drafts
    for d in res_v.json()["drafts"]:
        if not d.get("governor_trace", {}).get("blocked"):
            client.put(
                f"/visits/drafts/{d['id']}",
                json={"status": "approved", "clinician_comment": "Approved"},
                headers={"Authorization": f"Bearer {clin_token}"},
            )

    # Complete visit
    client.post(f"/visits/{v_id}/complete", headers={"Authorization": f"Bearer {clin_token}"})

    # Fetch Care Plan as Patient
    res_cp = client.get(f"/patients/{patient_id}/care-plan", headers={"Authorization": f"Bearer {patient_token}"})
    assert res_cp.status_code == 200, res_cp.text
    care_plan = res_cp.json()
    assert care_plan["status"] == "active"
    assert len(care_plan["tasks"]) >= 4

    # Check tasks due dates and assignments
    tasks = care_plan["tasks"]
    patient_tasks = [t for t in tasks if t["assigned_to"] == "patient"]
    clinician_tasks = [t for t in tasks if t["assigned_to"] == "clinician"]
    assert len(patient_tasks) >= 2
    assert len(clinician_tasks) >= 1

    # Patient checks off a task
    target_task = patient_tasks[0]
    res_task = client.patch(
        f"/care-plan/tasks/{target_task['id']}",
        json={"status": "completed"},
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert res_task.status_code == 200
    assert res_task.json()["status"] == "completed"
    assert res_task.json()["completed_at"] is not None


def test_permission_checks(client: TestClient, setup_visit_users_and_patients):
    data = setup_visit_users_and_patients
    clin_token = data["tokens"]["clinician"]
    other_token = data["tokens"]["other_clinician"]
    patient_token = data["tokens"]["patient"]
    patient_id = data["patient"].id

    # 1. Unlinked clinician cannot access patient visits -> 403
    res_unlinked = client.post(
        f"/patients/{patient_id}/visits",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_unlinked.status_code == 403

    # 2. Linked clinician creates visit
    res_v = client.post(f"/patients/{patient_id}/visits", headers={"Authorization": f"Bearer {clin_token}"})
    v_id = res_v.json()["id"]
    draft_id = res_v.json()["drafts"][0]["id"]

    # 3. Patient cannot review clinician drafts -> 403
    res_pt_review = client.put(
        f"/visits/drafts/{draft_id}",
        json={"status": "approved"},
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert res_pt_review.status_code == 403

    # 4. Patient cannot complete a clinical visit -> 403
    res_pt_complete = client.post(
        f"/visits/{v_id}/complete",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert res_pt_complete.status_code == 403
