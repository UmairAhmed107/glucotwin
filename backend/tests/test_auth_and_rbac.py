import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password
from app.db import get_db
from app.main import app
from app.models_db import AuditLog, CareTeamLink, Patient, User


@pytest.fixture
def clean_client(db_session: Session):
    """Test client with NO dependency overrides, testing true unauthenticated and token auth."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()


def test_auth_registration_and_login(clean_client: TestClient, db_session: Session):
    # 1. Register a new clinician
    reg_resp = clean_client.post(
        "/auth/register",
        json={
            "email": "nurse.joy@glucotwin.org",
            "password": "SecretPassword123!",
            "full_name": "Nurse Joy",
            "role": "clinician",
        },
    )
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "nurse.joy@glucotwin.org"
    assert data["user"]["role"] == "clinician"

    # 2. Duplicate registration should return 400
    dup_resp = clean_client.post(
        "/auth/register",
        json={
            "email": "nurse.joy@glucotwin.org",
            "password": "AnotherPassword!",
            "full_name": "Duplicate Joy",
            "role": "clinician",
        },
    )
    assert dup_resp.status_code == 400

    # 3. Login with wrong password should return 401
    wrong_login = clean_client.post(
        "/auth/login",
        json={"email": "nurse.joy@glucotwin.org", "password": "WrongPassword!"},
    )
    assert wrong_login.status_code == 401

    # 4. Login with correct password
    good_login = clean_client.post(
        "/auth/login",
        json={"email": "nurse.joy@glucotwin.org", "password": "SecretPassword123!"},
    )
    assert good_login.status_code == 200
    token = good_login.json()["access_token"]
    assert token

    # 5. Call /auth/me with Bearer token
    me_resp = clean_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "nurse.joy@glucotwin.org"

    # 6. Call /auth/me without token -> 401
    unauth_resp = clean_client.get("/auth/me")
    assert unauth_resp.status_code == 401


def test_patient_self_registration_links_profile(clean_client: TestClient):
    reg_resp = clean_client.post(
        "/auth/register",
        json={
            "email": "patient.tim@glucotwin.org",
            "password": "MySecretPass123!",
            "full_name": "Tim Drake",
            "role": "patient",
        },
    )
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert data["user"]["patient_id"] is not None


def test_role_enforcement_and_ownership_403(clean_client: TestClient, db_session: Session):
    pwd_hash = hash_password("Password123!")

    # User A (Patient 1)
    user_a = User(email="patient.a@test.org", full_name="User A", role="patient", password_hash=pwd_hash)
    db_session.add(user_a)
    db_session.commit()
    db_session.refresh(user_a)

    pat_a = Patient(
        user_id=user_a.id,
        display_name="Patient A",
        is_synthetic=True,
        source="new",
        age=50,
        sex="M",
        bmi=27.0,
        hba1c_pct=7.0,
        fasting_glucose_mgdl=120.0,
        current_meds=[],
    )
    db_session.add(pat_a)

    # User B (Patient 2)
    user_b = User(email="patient.b@test.org", full_name="User B", role="patient", password_hash=pwd_hash)
    db_session.add(user_b)
    db_session.commit()
    db_session.refresh(user_b)

    pat_b = Patient(
        user_id=user_b.id,
        display_name="Patient B",
        is_synthetic=True,
        source="new",
        age=60,
        sex="F",
        bmi=30.0,
        hba1c_pct=8.0,
        fasting_glucose_mgdl=140.0,
        current_meds=[],
    )
    db_session.add(pat_b)

    # Clinician without links
    dr_unlinked = User(email="dr.unlinked@test.org", full_name="Dr. Unlinked", role="clinician", password_hash=pwd_hash)
    db_session.add(dr_unlinked)

    # Clinician with active link to Patient A
    dr_linked = User(email="dr.linked@test.org", full_name="Dr. Linked", role="clinician", password_hash=pwd_hash)
    db_session.add(dr_linked)
    db_session.commit()
    db_session.refresh(dr_linked)

    link = CareTeamLink(patient_id=pat_a.id, provider_user_id=dr_linked.id, role_in_team="clinician", status="active")
    db_session.add(link)
    db_session.commit()

    token_a = create_access_token({"sub": str(user_a.id), "email": user_a.email, "role": user_a.role})
    token_unlinked = create_access_token({"sub": str(dr_unlinked.id), "email": dr_unlinked.email, "role": dr_unlinked.role})
    token_linked = create_access_token({"sub": str(dr_linked.id), "email": dr_linked.email, "role": dr_linked.role})

    # Case 1: Patient A accesses Patient A data -> 200
    res_a_own = clean_client.get(
        f"/patients/{pat_a.id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_a_own.status_code == 200

    # Case 2: Patient A attempts to access Patient B data -> 403 Forbidden
    res_a_other = clean_client.get(
        f"/patients/{pat_b.id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_a_other.status_code == 403

    # Case 3: Patient A attempts to log a meal for Patient B -> 403 Forbidden
    res_meal_cross = clean_client.post(
        f"/patients/{pat_b.id}/meals",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "logged_at": "2026-10-10T12:00:00Z",
            "carbs_g": 40.0,
            "protein_g": 20.0,
            "fat_g": 10.0,
            "pre_glucose": 100.0,
            "pre_trend30": 0.0,
        },
    )
    assert res_meal_cross.status_code == 403

    # Case 4: Unlinked clinician accesses Patient A -> 403 Forbidden
    res_dr_unlinked = clean_client.get(
        f"/patients/{pat_a.id}",
        headers={"Authorization": f"Bearer {token_unlinked}"},
    )
    assert res_dr_unlinked.status_code == 403

    # Case 5: Linked clinician accesses Patient A -> 200 OK
    res_dr_linked = clean_client.get(
        f"/patients/{pat_a.id}",
        headers={"Authorization": f"Bearer {token_linked}"},
    )
    assert res_dr_linked.status_code == 200


def test_care_team_approval_and_revocation_flow(clean_client: TestClient, db_session: Session):
    pwd_hash = hash_password("Password123!")

    # Patient
    pat_user = User(email="patient.flow@test.org", full_name="Patient Flow", role="patient", password_hash=pwd_hash)
    db_session.add(pat_user)
    db_session.commit()
    db_session.refresh(pat_user)

    patient = Patient(
        user_id=pat_user.id,
        display_name="Flow Patient",
        is_synthetic=True,
        source="new",
        age=45,
        sex="M",
        bmi=25.0,
        hba1c_pct=6.5,
        fasting_glucose_mgdl=110.0,
        current_meds=[],
    )
    db_session.add(patient)

    # Clinician
    doctor = User(email="doctor.flow@test.org", full_name="Doctor Flow", role="clinician", password_hash=pwd_hash)
    db_session.add(doctor)
    db_session.commit()
    db_session.refresh(doctor)

    token_pat = create_access_token({"sub": str(pat_user.id), "email": pat_user.email, "role": pat_user.role})
    token_doc = create_access_token({"sub": str(doctor.id), "email": doctor.email, "role": doctor.role})

    # Doctor requests care team link (status starts as "pending")
    req_resp = clean_client.post(
        "/care-team/request",
        headers={"Authorization": f"Bearer {token_doc}"},
        json={"patient_id": patient.id, "role_in_team": "clinician"},
    )
    assert req_resp.status_code == 201
    link_id = req_resp.json()["id"]
    assert req_resp.json()["status"] == "pending"

    # Clinician tries to access patient while link is pending -> 403
    pending_access = clean_client.get(
        f"/patients/{patient.id}",
        headers={"Authorization": f"Bearer {token_doc}"},
    )
    assert pending_access.status_code == 403

    # Patient views care team
    team_resp = clean_client.get(
        "/care-team/my-team",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    assert team_resp.status_code == 200
    assert len(team_resp.json()) == 1

    # Patient approves link
    approve_resp = clean_client.post(
        f"/care-team/{link_id}/approve",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "active"

    # Now clinician CAN access patient -> 200
    active_access = clean_client.get(
        f"/patients/{patient.id}",
        headers={"Authorization": f"Bearer {token_doc}"},
    )
    assert active_access.status_code == 200

    # Patient revokes link
    revoke_resp = clean_client.post(
        f"/care-team/{link_id}/revoke",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["status"] == "revoked"

    # Clinician access is now 403 again
    revoked_access = clean_client.get(
        f"/patients/{patient.id}",
        headers={"Authorization": f"Bearer {token_doc}"},
    )
    assert revoked_access.status_code == 403


def test_audit_log_entries_recorded(clean_client: TestClient, db_session: Session):
    pwd_hash = hash_password("Password123!")
    user = User(email="audit.user@test.org", full_name="Audit Tester", role="admin", password_hash=pwd_hash)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    pat = Patient(
        display_name="Audited Patient",
        is_synthetic=True,
        source="new",
        age=50,
        sex="F",
        bmi=26.0,
        hba1c_pct=6.9,
        fasting_glucose_mgdl=115.0,
        current_meds=[],
    )
    db_session.add(pat)
    db_session.commit()
    db_session.refresh(pat)

    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})

    # Read patient
    clean_client.get(f"/patients/{pat.id}", headers={"Authorization": f"Bearer {token}"})

    # Log a meal
    clean_client.post(
        f"/patients/{pat.id}/meals",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "logged_at": "2026-10-10T08:00:00Z",
            "carbs_g": 35.0,
            "protein_g": 15.0,
            "fat_g": 10.0,
            "pre_glucose": 95.0,
            "pre_trend30": 0.0,
        },
    )

    # Check AuditLog table directly
    logs = (
        db_session.query(AuditLog)
        .filter(AuditLog.patient_id == pat.id, AuditLog.user_id == user.id)
        .all()
    )
    assert len(logs) >= 2
    actions = [l.action for l in logs]
    assert "read" in actions
    assert "create" in actions
    for log in logs:
        assert log.timestamp is not None
        assert log.resource_type is not None
