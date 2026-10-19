import io
import json
from pathlib import Path
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.models_db import Patient


def test_validation_endpoint_full_file(client: TestClient, monkeypatch, tmp_path: Path):
    """Test /system/validation with a complete validation.json file."""
    full_data = {
        "class": "MealRecommender",
        "sklearn_version": "1.6.1",
        "training_date": "2024-11-20",
        "trained_on": {
            "dataset": "cgmacros",
            "participants": 45,
            "meals": 1200,
        },
        "grouped_cv": {
            "peak_rise": {
                "baseline_mae": 18.4,
                "twin_mae": 11.2,
                "baseline_rmse": 23.6,
                "twin_rmse": 14.8,
            },
            "iauc_2h": {
                "baseline_mae": 1420.5,
                "twin_mae": 920.0,
                "baseline_rmse": 1850.0,
                "twin_rmse": 1210.5,
            },
        },
        "error_vs_memory": [
            {"mem_n": 0, "mae": 18.4, "n": 45},
            {"mem_n": 1, "mae": 15.6, "n": 45},
        ],
        "interval_calibration": [
            {"nominal": 0.5, "empirical": 0.49},
            {"nominal": 0.8, "empirical": 0.78},
        ],
        "limitations": [
            "45 participants in CGMacros cohort",
            "meal windows isolated by 2h",
        ],
    }

    metrics_dir = tmp_path / "metrics"
    metrics_dir.mkdir()
    val_file = metrics_dir / "validation.json"
    val_file.write_text(json.dumps(full_data), encoding="utf-8")

    from app.config import Settings
    monkeypatch.setattr(Settings, "metrics_dir", property(lambda self: metrics_dir))

    resp = client.get("/system/validation")
    assert resp.status_code == 200
    res_json = resp.json()
    assert res_json["class"] == "MealRecommender"
    assert res_json["sklearn_version"] == "1.6.1"
    assert "grouped_cv" in res_json
    assert "error_vs_memory" in res_json
    assert len(res_json["limitations"]) == 2


def test_validation_endpoint_partial_file(client: TestClient, monkeypatch, tmp_path: Path):
    """Test /system/validation with a partial validation.json missing some sections."""
    partial_data = {
        "sklearn_version": "1.6.1",
        "limitations": ["Limited cohort size of 45"],
    }

    metrics_dir = tmp_path / "metrics"
    metrics_dir.mkdir()
    val_file = metrics_dir / "validation.json"
    val_file.write_text(json.dumps(partial_data), encoding="utf-8")

    from app.config import Settings
    monkeypatch.setattr(Settings, "metrics_dir", property(lambda self: metrics_dir))

    resp = client.get("/system/validation")
    assert resp.status_code == 200
    res_json = resp.json()
    assert res_json["sklearn_version"] == "1.6.1"
    assert "grouped_cv" not in res_json
    assert "class" not in res_json
    assert len(res_json["limitations"]) == 1


def test_validation_endpoint_missing_file(client: TestClient, monkeypatch, tmp_path: Path):
    """Test /system/validation when validation.json is absent (returns 404)."""
    empty_dir = tmp_path / "nonexistent_metrics"
    empty_dir.mkdir()

    from app.config import Settings
    monkeypatch.setattr(Settings, "metrics_dir", property(lambda self: empty_dir))

    resp = client.get("/system/validation")
    assert resp.status_code == 404
    err = resp.json()
    assert err["error"]["code"] == "NOT_FOUND"
    assert "validation.json not found" in err["error"]["message"]


def test_pdf_endpoint_returns_pdf_and_nontrivial_size(client: TestClient, db_session: Session):
    """Test GET /patients/{id}/report.pdf returns valid PDF of non-trivial size."""
    # Create patient in test db
    p = Patient(
        display_name="Demo Test Patient",
        is_synthetic=True,
        source="new",
        age=54,
        sex="F",
        bmi=27.4,
        hba1c_pct=6.7,
        fasting_glucose_mgdl=118.0,
        hypoglycemia_history=True,
        kidney_flag=False,
        current_meds=["metformin"],
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)

    resp = client.get(f"/patients/{p.id}/report.pdf")
    assert resp.status_code == 200
    assert "application/pdf" in resp.headers["content-type"]

    pdf_bytes = resp.content
    assert len(pdf_bytes) > 2000  # Non-trivial size
    assert pdf_bytes.startswith(b"%PDF")  # Valid PDF signature

    # Unknown patient should return 404
    resp_404 = client.get("/patients/99999/report.pdf")
    assert resp_404.status_code == 404


def test_replay_start_and_stream_with_tiny_fixture(client: TestClient, monkeypatch, tmp_path: Path):
    """Test SSE replay endpoint yields events for a tiny fixture dataset across speeds."""
    # Create tiny fixture CSV
    fixture_data = [
        {
            "participant_id": 42,
            "timestamp": "2026-10-15T08:00:00",
            "glucose": 95.0,
            "meal_type": "",
            "carbs_g": "",
            "protein_g": "",
            "fat_g": "",
            "calories": "",
        },
        {
            "participant_id": 42,
            "timestamp": "2026-10-15T08:05:00",
            "glucose": 96.5,
            "meal_type": "breakfast",
            "carbs_g": 40.0,
            "protein_g": 15.0,
            "fat_g": 10.0,
            "calories": 310.0,
        },
        {
            "participant_id": 42,
            "timestamp": "2026-10-15T08:10:00",
            "glucose": 115.0,
            "meal_type": "",
            "carbs_g": "",
            "protein_g": "",
            "fat_g": "",
            "calories": "",
        },
    ]
    df = pd.DataFrame(fixture_data)
    csv_file = tmp_path / "test_cgm.csv"
    df.to_csv(csv_file, index=False)

    from app.config import Settings
    monkeypatch.setattr(Settings, "resolve_replay_path", lambda self: csv_file)

    # 1. Test POST /replay/{participant_id}/start
    resp_start = client.post("/replay/42/start", json={"speed": 10})
    assert resp_start.status_code == 200
    start_json = resp_start.json()
    assert start_json["status"] == "ready"
    assert start_json["speed"] == 10
    assert start_json["total_points"] == 3

    # 2. Test GET /replay/{participant_id}/stream at 60x speed
    with client.stream("GET", "/replay/42/stream?speed=60") as stream_resp:
        assert stream_resp.status_code == 200
        assert "text/event-stream" in stream_resp.headers["content-type"]

        events = []
        for line in stream_resp.iter_lines():
            if line.startswith("data: "):
                payload = json.loads(line[6:])
                events.append(payload)

        assert len(events) >= 3
        # Check first reading event
        assert events[0]["type"] == "reading"
        assert events[0]["glucose"] == 95.0

        # Check second event is meal with predicted response
        assert events[1]["type"] == "meal"
        assert events[1]["meal"]["meal_type"] == "breakfast"
        assert "predicted_response" in events[1]
        assert "peak_rise" in events[1]["predicted_response"]
        assert "curve" in events[1]["predicted_response"]


def test_replay_unavailable_returns_503(client: TestClient, monkeypatch):
    """Test replay endpoints return 503 when dataset file is missing or unconfigured."""
    from app.config import Settings
    monkeypatch.setattr(Settings, "resolve_replay_path", lambda self: None)

    # POST start returns 503
    resp_start = client.post("/replay/1/start")
    assert resp_start.status_code == 503
    err_start = resp_start.json()
    assert err_start["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert "time series dataset is not available" in err_start["error"]["message"]

    # GET stream returns 503
    resp_stream = client.get("/replay/1/stream")
    assert resp_stream.status_code == 503
    err_stream = resp_stream.json()
    assert err_stream["error"]["code"] == "SERVICE_UNAVAILABLE"

