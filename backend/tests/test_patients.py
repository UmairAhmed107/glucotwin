from fastapi.testclient import TestClient


def test_create_patient_mode_new(client: TestClient):
    payload = {
        "mode": "new",
        "display_name": "Test Jane Doe",
        "age": 45,
        "sex": "F",
        "bmi": 26.5,
        "hba1c_pct": 6.8,
        "fasting_glucose_mgdl": 115.0,
        "hypoglycemia_history": True,
        "kidney_flag": False,
        "current_meds": ["metformin"],
    }
    response = client.post("/patients", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()

    assert data["display_name"] == "Test Jane Doe"
    assert data["is_synthetic"] is True
    assert data["source"] == "new"
    assert data["age"] == 45
    assert data["hypoglycemia_history"] is True
    assert data["current_meds"] == ["metformin"]
    assert "twin_state" in data
    assert data["twin_state"]["mem_n"] == 0
    assert data["twin_state"]["confidence_score"] == 0.2  # 0.6*(1-exp(0)) + 0.4*(1-0.5) = 0.2


def test_create_patient_mode_cgmacros(client: TestClient):
    payload = {
        "mode": "cgmacros",
        "cgmacros_participant_id": 101,
        "kidney_flag": False,
        "current_meds": [],
    }
    response = client.post("/patients", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()

    # Loaded from fixture bio_df
    assert data["display_name"] == "CGMacros #101"
    assert data["source"] == "cgmacros"
    assert data["is_synthetic"] is False
    assert data["cgmacros_participant_id"] == 101
    assert data["age"] == 45
    assert data["sex"] == "F"
    assert data["bmi"] == 28.5
    assert data["hba1c_pct"] == 6.4
    assert data["fasting_glucose_mgdl"] == 115.0
    assert data["hypoglycemia_history"] is None  # Unknown for CGMacros cohort per spec D2
    assert "twin_state" in data


def test_create_patient_mode_shanghai_profile(client: TestClient):
    payload = {
        "mode": "shanghai_profile",
        "shanghai_patient_id": 3001,
    }
    response = client.post("/patients", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()

    # Loaded from fixture shanghai_df
    assert data["display_name"] == "Shanghai Profile #3001"
    assert data["source"] == "shanghai_profile"
    assert data["is_synthetic"] is True
    assert data["age"] == 58
    assert data["sex"] == "M"
    assert data["bmi"] == 26.4
    assert data["fasting_glucose_mgdl"] == 125.0
    assert data["hba1c_pct"] == 7.8
    assert data["hypoglycemia_history"] is True  # 'yes' mapped to True


def test_patient_validation_bounds(client: TestClient):
    # Test age < 18
    r_age_low = client.post("/patients", json={
        "mode": "new", "display_name": "Too Young", "age": 17, "sex": "M",
        "bmi": 25.0, "hba1c_pct": 6.0, "fasting_glucose_mgdl": 100.0,
    })
    assert r_age_low.status_code == 422
    assert r_age_low.json()["error"]["code"] == "VALIDATION_ERROR"

    # Test age > 100
    r_age_high = client.post("/patients", json={
        "mode": "new", "display_name": "Too Old", "age": 101, "sex": "M",
        "bmi": 25.0, "hba1c_pct": 6.0, "fasting_glucose_mgdl": 100.0,
    })
    assert r_age_high.status_code == 422

    # Test bmi < 12
    r_bmi_low = client.post("/patients", json={
        "mode": "new", "display_name": "BMI Low", "age": 30, "sex": "M",
        "bmi": 11.9, "hba1c_pct": 6.0, "fasting_glucose_mgdl": 100.0,
    })
    assert r_bmi_low.status_code == 422

    # Test bmi > 60
    r_bmi_high = client.post("/patients", json={
        "mode": "new", "display_name": "BMI High", "age": 30, "sex": "M",
        "bmi": 60.1, "hba1c_pct": 6.0, "fasting_glucose_mgdl": 100.0,
    })
    assert r_bmi_high.status_code == 422

    # Test hba1c < 4
    r_a1c_low = client.post("/patients", json={
        "mode": "new", "display_name": "A1c Low", "age": 30, "sex": "M",
        "bmi": 25.0, "hba1c_pct": 3.9, "fasting_glucose_mgdl": 100.0,
    })
    assert r_a1c_low.status_code == 422

    # Test hba1c > 18
    r_a1c_high = client.post("/patients", json={
        "mode": "new", "display_name": "A1c High", "age": 30, "sex": "M",
        "bmi": 25.0, "hba1c_pct": 18.1, "fasting_glucose_mgdl": 100.0,
    })
    assert r_a1c_high.status_code == 422

    # Test fasting glucose < 50
    r_fpg_low = client.post("/patients", json={
        "mode": "new", "display_name": "FPG Low", "age": 30, "sex": "M",
        "bmi": 25.0, "hba1c_pct": 6.0, "fasting_glucose_mgdl": 49.0,
    })
    assert r_fpg_low.status_code == 422

    # Test fasting glucose > 500
    r_fpg_high = client.post("/patients", json={
        "mode": "new", "display_name": "FPG High", "age": 30, "sex": "M",
        "bmi": 25.0, "hba1c_pct": 6.0, "fasting_glucose_mgdl": 501.0,
    })
    assert r_fpg_high.status_code == 422


def test_list_and_get_patient(client: TestClient):
    # Create patient
    r_create = client.post("/patients", json={
        "mode": "new",
        "display_name": "Alice Smith",
        "age": 35,
        "sex": "F",
        "bmi": 22.0,
        "hba1c_pct": 5.5,
        "fasting_glucose_mgdl": 92.0,
    })
    pid = r_create.json()["id"]

    # List patients
    r_list = client.get("/patients")
    assert r_list.status_code == 200
    items = r_list.json()
    assert any(p["id"] == pid for p in items)

    # Get single patient
    r_get = client.get(f"/patients/{pid}")
    assert r_get.status_code == 200
    assert r_get.json()["id"] == pid
    assert r_get.json()["display_name"] == "Alice Smith"
    assert "twin_state" in r_get.json()


def test_get_patient_not_found(client: TestClient):
    response = client.get("/patients/99999")
    assert response.status_code == 404
    err = response.json()
    assert err["error"]["code"] == "NOT_FOUND"
    assert "99999" in err["error"]["message"]
