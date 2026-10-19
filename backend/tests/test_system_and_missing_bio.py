from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.data_loader import data_loader
from app.models_db import AuditLog


def test_health_check(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["models_loaded"] is True  # True in Phase 2 per task spec
    assert "sklearn_version_running" in data
    assert "version_match" in data
    assert data["version_match"] == (data["sklearn_version_running"] == data["sklearn_version_manifest"])


def test_system_models(client: TestClient):
    response = client.get("/system/models")
    assert response.status_code == 200
    data = response.json()
    assert data["class_name"] == "MealRecommender"
    assert data["sklearn_version"] == "1.6.1"
    assert "dataset_sizes" in data


def test_dropdown_endpoints(client: TestClient):
    # CGMacros dropdown
    r_cgm = client.get("/data/cgmacros-participants")
    assert r_cgm.status_code == 200
    cgm_list = r_cgm.json()
    assert len(cgm_list) > 0
    assert "summary" in cgm_list[0]
    assert "id" in cgm_list[0]

    # Shanghai dropdown
    r_shanghai = client.get("/data/shanghai-profiles")
    assert r_shanghai.status_code == 200
    shanghai_list = r_shanghai.json()
    assert len(shanghai_list) > 0
    assert "summary" in shanghai_list[0]
    assert "session_id" in shanghai_list[0]


def test_missing_bio_file_behavior(client: TestClient):
    # Backup existing bio dataframe
    prev_bio_df = data_loader.bio_df
    prev_available = data_loader.is_bio_available

    try:
        # Simulate missing bio file
        data_loader.bio_df = None
        data_loader.is_bio_available = False

        # 1. Dropdown should return 503
        r_drop = client.get("/data/cgmacros-participants")
        assert r_drop.status_code == 503
        err = r_drop.json()
        assert err["error"]["code"] == "SERVICE_UNAVAILABLE"
        assert "bio file is missing" in err["error"]["message"]

        # 2. Patient creation in mode='cgmacros' should return 503
        r_create = client.post("/patients", json={
            "mode": "cgmacros",
            "cgmacros_participant_id": 101,
        })
        assert r_create.status_code == 503
        err2 = r_create.json()
        assert err2["error"]["code"] == "SERVICE_UNAVAILABLE"

    finally:
        # Restore fixture state
        data_loader.bio_df = prev_bio_df
        data_loader.is_bio_available = prev_available


def test_audit_logging_mechanism(client: TestClient, db_session: Session):
    # Trigger an endpoint that generates an audit log
    r = client.post("/patients", json={
        "mode": "new",
        "display_name": "Audit Patient",
        "age": 50,
        "sex": "M",
        "bmi": 25.0,
        "hba1c_pct": 5.8,
        "fasting_glucose_mgdl": 99.0,
    })
    assert r.status_code == 201
    pid = r.json()["id"]

    # Check audit log in DB
    audit_entry = db_session.query(AuditLog).filter(AuditLog.patient_id == pid).first()
    assert audit_entry is not None
    assert audit_entry.endpoint == "/patients"
    assert len(audit_entry.inputs_hash) == 64  # SHA-256 length
