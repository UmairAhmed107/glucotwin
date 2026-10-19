from datetime import datetime, timezone
from fastapi.testclient import TestClient


def create_test_patient(client: TestClient) -> int:
    r = client.post("/patients", json={
        "mode": "new",
        "display_name": "Timeline Patient",
        "age": 40,
        "sex": "M",
        "bmi": 27.0,
        "hba1c_pct": 6.5,
        "fasting_glucose_mgdl": 108.0,
    })
    assert r.status_code == 201
    return r.json()["id"]


def test_meal_logging_success_and_calories_math(client: TestClient):
    pid = create_test_patient(client)

    payload = {
        "logged_at": "2026-10-15T08:30:00Z",
        "carbs_g": 50.0,
        "protein_g": 20.0,
        "fat_g": 10.0,
        "fibre_g": 5.0,
        "pre_glucose": 110.0,
        "pre_trend30": -5.0,
        "observed_peak_rise": 35.0,
        "observed_iauc_2h": 42.0,
    }
    r = client.post(f"/patients/{pid}/meals", json=payload)
    assert r.status_code == 201, r.text
    data = r.json()

    assert data["patient_id"] == pid
    assert data["carbs_g"] == 50.0
    assert data["observed_peak_rise"] == 35.0
    # Expected calories: 50*4 + 20*4 + 10*9 = 200 + 80 + 90 = 370.0
    assert data["calories"] == 370.0


def test_meal_validation_bounds(client: TestClient):
    pid = create_test_patient(client)

    # Carbs > 400
    r1 = client.post(f"/patients/{pid}/meals", json={
        "logged_at": "2026-10-15T08:30:00Z",
        "carbs_g": 401.0, "protein_g": 20.0, "fat_g": 10.0,
        "pre_glucose": 100.0, "pre_trend30": 0.0,
    })
    assert r1.status_code == 422
    assert r1.json()["error"]["code"] == "VALIDATION_ERROR"

    # Protein > 200
    r2 = client.post(f"/patients/{pid}/meals", json={
        "logged_at": "2026-10-15T08:30:00Z",
        "carbs_g": 50.0, "protein_g": 201.0, "fat_g": 10.0,
        "pre_glucose": 100.0, "pre_trend30": 0.0,
    })
    assert r2.status_code == 422

    # Fat > 200
    r3 = client.post(f"/patients/{pid}/meals", json={
        "logged_at": "2026-10-15T08:30:00Z",
        "carbs_g": 50.0, "protein_g": 20.0, "fat_g": 201.0,
        "pre_glucose": 100.0, "pre_trend30": 0.0,
    })
    assert r3.status_code == 422

    # Pre_glucose < 40
    r4 = client.post(f"/patients/{pid}/meals", json={
        "logged_at": "2026-10-15T08:30:00Z",
        "carbs_g": 50.0, "protein_g": 20.0, "fat_g": 10.0,
        "pre_glucose": 39.0, "pre_trend30": 0.0,
    })
    assert r4.status_code == 422

    # Pre_trend30 > 100
    r5 = client.post(f"/patients/{pid}/meals", json={
        "logged_at": "2026-10-15T08:30:00Z",
        "carbs_g": 50.0, "protein_g": 20.0, "fat_g": 10.0,
        "pre_glucose": 100.0, "pre_trend30": 105.0,
    })
    assert r5.status_code == 422

    # Missing timezone offset in logged_at (naive ISO string)
    r6 = client.post(f"/patients/{pid}/meals", json={
        "logged_at": "2026-10-15T08:30:00",  # no Z or offset
        "carbs_g": 50.0, "protein_g": 20.0, "fat_g": 10.0,
        "pre_glucose": 100.0, "pre_trend30": 0.0,
    })
    assert r6.status_code == 422
    assert "timezone-aware" in str(r6.json())


def test_glucose_reading_logging_and_validation(client: TestClient):
    pid = create_test_patient(client)

    # Valid reading
    r = client.post(f"/patients/{pid}/readings", json={
        "ts": "2026-10-15T09:00:00Z",
        "value_mgdl": 128.5,
        "source": "manual",
    })
    assert r.status_code == 201
    assert r.json()["value_mgdl"] == 128.5

    # Out of bounds value_mgdl (> 500)
    r_high = client.post(f"/patients/{pid}/readings", json={
        "ts": "2026-10-15T09:00:00Z",
        "value_mgdl": 501.0,
    })
    assert r_high.status_code == 422

    # Out of bounds value_mgdl (< 40)
    r_low = client.post(f"/patients/{pid}/readings", json={
        "ts": "2026-10-15T09:00:00Z",
        "value_mgdl": 38.0,
    })
    assert r_low.status_code == 422


def test_timeline_merged_chronological_ordering(client: TestClient):
    pid = create_test_patient(client)

    # Add items in non-chronological order
    # Event 3: reading at 12:00
    client.post(f"/patients/{pid}/readings", json={
        "ts": "2026-10-15T12:00:00Z",
        "value_mgdl": 140.0,
    })

    # Event 1: meal at 08:00
    client.post(f"/patients/{pid}/meals", json={
        "logged_at": "2026-10-15T08:00:00Z",
        "carbs_g": 40.0, "protein_g": 15.0, "fat_g": 10.0,
        "pre_glucose": 95.0, "pre_trend30": 0.0,
    })

    # Event 4: meal at 13:30
    client.post(f"/patients/{pid}/meals", json={
        "logged_at": "2026-10-15T13:30:00Z",
        "carbs_g": 60.0, "protein_g": 25.0, "fat_g": 15.0,
        "pre_glucose": 115.0, "pre_trend30": 2.0,
    })

    # Event 2: reading at 10:00
    client.post(f"/patients/{pid}/readings", json={
        "ts": "2026-10-15T10:00:00Z",
        "value_mgdl": 125.0,
    })

    # Fetch timeline
    response = client.get(f"/patients/{pid}/timeline")
    assert response.status_code == 200
    timeline = response.json()

    assert timeline["patient_id"] == pid
    events = timeline["events"]
    assert len(events) == 4

    # Verify chronological ordering
    types = [e["type"] for e in events]
    assert types == ["meal", "reading", "reading", "meal"]

    timestamps = [e["timestamp"] for e in events]
    assert timestamps == sorted(timestamps)
