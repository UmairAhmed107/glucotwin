from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password
from app.db import SessionLocal
from app.food_seeder import seed_foods
from app.main import app
from app.models_db import (
    DoseLog,
    FoodItem,
    GlucoseReading,
    MealEntry,
    Medication,
    Patient,
    SavedMeal,
    User,
)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        # Ensure foods table is seeded
        seed_foods(db)
        yield db
    finally:
        db.close()


@pytest.fixture
def setup_test_patient_and_auth(db_session: Session):
    timestamp = int(datetime.now().timestamp() * 1000)

    # Patient user
    patient_user = User(
        email=f"patient_fast_log_{timestamp}@glucotwin.org",
        password_hash=hash_password("Pass123!"),
        full_name="Priya Patel",
        role="patient",
    )
    db_session.add(patient_user)
    db_session.commit()
    db_session.refresh(patient_user)

    # Patient record
    patient = Patient(
        user_id=patient_user.id,
        display_name="Priya Patel",
        is_synthetic=False,
        source="new",
        age=48,
        sex="F",
        bmi=26.2,
        hba1c_pct=7.2,
        fasting_glucose_mgdl=118.0,
        hypoglycemia_history=False,
        kidney_flag=False,
        current_meds=["metformin"],
    )
    db_session.add(patient)
    db_session.commit()
    db_session.refresh(patient)

    token = create_access_token({
        "sub": str(patient_user.id),
        "email": patient_user.email,
        "role": patient_user.role,
    })
    headers = {"Authorization": f"Bearer {token}"}

    return {
        "user": patient_user,
        "patient": patient,
        "headers": headers,
    }


def test_food_search_relevance_and_pagination(client: TestClient, setup_test_patient_and_auth):
    headers = setup_test_patient_and_auth["headers"]

    # 1. Search for 'roti'
    res = client.get("/foods/search?q=roti&limit=5", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["total"] >= 1
    assert any("roti" in item["name"].lower() or "chapati" in item["name"].lower() for item in data["items"])
    top_item = data["items"][0]
    assert "carbs" in top_item
    assert "protein" in top_item
    assert "disclaimer" in top_item

    # 2. Search for 'chicken'
    res2 = client.get("/foods/search?q=chicken&limit=10", headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["total"] >= 1
    assert any("chicken" in item["name"].lower() for item in data2["items"])

    # 3. Pagination verification
    res3 = client.get("/foods/search?limit=10&page=1", headers=headers)
    assert res3.status_code == 200
    data3 = res3.json()
    assert len(data3["items"]) == 10
    assert data3["page"] == 1
    assert data3["pages"] >= 1


def test_saved_meal_macro_computation_and_logging(client: TestClient, db_session: Session, setup_test_patient_and_auth):
    headers = setup_test_patient_and_auth["headers"]
    patient_id = setup_test_patient_and_auth["patient"].id

    # Retrieve 2 food items from database
    food1 = db_session.query(FoodItem).filter(FoodItem.name.ilike("%roti%")).first()
    food2 = db_session.query(FoodItem).filter(FoodItem.name.ilike("%dal%")).first()

    assert food1 is not None, "FoodItem with roti should exist in seeded database"
    assert food2 is not None, "FoodItem with dal should exist in seeded database"

    # Create saved meal: 2 servings of food1, 1 serving of food2
    payload = {
        "name": "Lunch Special (2 Rotis + 1 Dal)",
        "items": [
            {"food_id": food1.id, "servings": 2.0},
            {"food_id": food2.id, "servings": 1.0},
        ],
    }

    res = client.post(f"/patients/{patient_id}/saved-meals", json=payload, headers=headers)
    assert res.status_code == 201
    meal_data = res.json()

    expected_carbs = round(food1.carbs * 2.0 + food2.carbs * 1.0, 1)
    expected_protein = round(food1.protein * 2.0 + food2.protein * 1.0, 1)
    expected_fat = round(food1.fat * 2.0 + food2.fat * 1.0, 1)
    expected_calories = round(food1.calories * 2.0 + food2.calories * 1.0, 1)

    assert meal_data["computed_carbs"] == expected_carbs
    assert meal_data["computed_protein"] == expected_protein
    assert meal_data["computed_fat"] == expected_fat
    assert meal_data["computed_calories"] == expected_calories

    saved_meal_id = meal_data["id"]

    # List saved meals
    list_res = client.get(f"/patients/{patient_id}/saved-meals", headers=headers)
    assert list_res.status_code == 200
    meals_list = list_res.json()
    assert len(meals_list) >= 1
    assert any(m["id"] == saved_meal_id for m in meals_list)

    # Log from saved meal
    log_res = client.post(
        f"/patients/{patient_id}/saved-meals/{saved_meal_id}/log?pre_glucose=108.0&pre_trend30=0.0",
        headers=headers,
    )
    assert log_res.status_code == 201
    entry = log_res.json()
    assert entry["carbs_g"] == expected_carbs
    assert entry["protein_g"] == expected_protein
    assert entry["fat_g"] == expected_fat
    assert entry["pre_glucose"] == 108.0


def test_meal_photo_estimate_draft_confirm_flow(client: TestClient, setup_test_patient_and_auth):
    headers = setup_test_patient_and_auth["headers"]
    patient_id = setup_test_patient_and_auth["patient"].id

    # POST mock image file to /meals/estimate-from-photo
    file_content = b"fake-jpeg-image-bytes-for-deterministic-photo-estimate"
    files = {"file": ("meal_thali.jpg", file_content, "image/jpeg")}

    res = client.post("/meals/estimate-from-photo", files=files, headers=headers)
    assert res.status_code == 200
    draft = res.json()

    assert draft["confirmed"] is False
    assert draft["is_mock"] is True
    assert "draft_id" in draft
    assert "food_items" in draft
    assert len(draft["food_items"]) >= 1
    assert "estimated_macros" in draft
    assert draft["confidence"] >= 0.8
    assert "disclaimer" in draft

    # Verify patient reviews and confirms draft by submitting standard logged meal
    macros = draft["estimated_macros"]
    confirm_payload = {
        "logged_at": datetime.now(timezone.utc).isoformat(),
        "carbs_g": macros["carbs"],
        "protein_g": macros["protein"],
        "fat_g": macros["fat"],
        "fibre_g": macros["fiber"],
        "calories": macros["calories"],
        "pre_glucose": 112.0,
        "pre_trend30": 0.0,
    }
    confirm_res = client.post(f"/patients/{patient_id}/meals", json=confirm_payload, headers=headers)
    assert confirm_res.status_code == 201
    logged_entry = confirm_res.json()
    assert logged_entry["carbs_g"] == macros["carbs"]
    assert logged_entry["calories"] == macros["calories"]


def test_medication_and_dose_log_adherence_math(client: TestClient, db_session: Session, setup_test_patient_and_auth):
    headers = setup_test_patient_and_auth["headers"]
    patient_id = setup_test_patient_and_auth["patient"].id

    # 1. Create a medication
    med_payload = {
        "name": "Metformin Extended Release",
        "dosage": "500mg",
        "schedule": "Twice daily with breakfast and dinner",
        "frequency_per_day": 2,
    }
    create_res = client.post(f"/patients/{patient_id}/medications", json=med_payload, headers=headers)
    assert create_res.status_code == 201
    med = create_res.json()
    med_id = med["id"]

    # 2. Add 4 scheduled dose logs: 3 taken, 1 skipped
    now = datetime.now(timezone.utc)
    for i in range(4):
        dose_res = client.post(
            f"/patients/{patient_id}/medications/{med_id}/doses",
            json={
                "dose": "500mg",
                "scheduled_time": (now - timedelta(days=4 - i)).isoformat(),
                "status": "pending",
            },
            headers=headers,
        )
        assert dose_res.status_code == 201
        dose_id = dose_res.json()["id"]

        # Mark first 3 as taken, 4th as skipped
        target_status = "taken" if i < 3 else "skipped"
        taken_at_val = (now - timedelta(days=4 - i)).isoformat() if target_status == "taken" else None
        patch_res = client.patch(
            f"/medications/doses/{dose_id}",
            json={"status": target_status, "taken_at": taken_at_val},
            headers=headers,
        )
        assert patch_res.status_code == 200

    # 3. Check adherence stats
    adh_res = client.get(f"/patients/{patient_id}/medications/adherence?days_window=7", headers=headers)
    assert adh_res.status_code == 200
    adh = adh_res.json()

    assert adh["total_scheduled_doses"] >= 4
    assert adh["total_taken_doses"] >= 3
    assert adh["total_missed_doses"] >= 1
    # 3 / 4 = 75.0%
    expected_pct = round((adh["total_taken_doses"] / adh["total_scheduled_doses"]) * 100.0, 1)
    assert adh["adherence_rate_pct"] == expected_pct
    assert adh["current_streak_days"] >= 0


def test_patient_home_summary_endpoint(client: TestClient, db_session: Session, setup_test_patient_and_auth):
    headers = setup_test_patient_and_auth["headers"]
    patient_id = setup_test_patient_and_auth["patient"].id

    # Add a glucose reading and meal
    now = datetime.now(timezone.utc)
    db_session.add(
        GlucoseReading(
            patient_id=patient_id,
            ts=now - timedelta(hours=1),
            value_mgdl=124.0,
            source="manual",
        )
    )
    db_session.add(
        MealEntry(
            patient_id=patient_id,
            logged_at=now - timedelta(hours=2),
            carbs_g=42.0,
            protein_g=18.0,
            fat_g=10.0,
            fibre_g=5.0,
            calories=330.0,
            pre_glucose=102.0,
            pre_trend30=0.0,
            observed_peak_rise=34.0,
        )
    )
    db_session.commit()

    # Query home summary
    res = client.get(f"/patients/{patient_id}/home-summary", headers=headers)
    assert res.status_code == 200
    summary = res.json()

    # Verify components
    assert "today_glucose" in summary
    assert summary["today_glucose"]["current_value"] == 124.0

    assert "time_in_range_ring" in summary
    assert "in_range_pct" in summary["time_in_range_ring"]
    assert "status" in summary["time_in_range_ring"]

    assert "last_meal" in summary
    assert summary["last_meal"]["carbs_g"] == 42.0
    assert "observed_peak_rise" in summary["last_meal"]
    assert "predicted_peak_rise" in summary["last_meal"]
    assert "response_badge" in summary["last_meal"]

    assert "circadian_suggestion" in summary
    assert "optimal_window" in summary["circadian_suggestion"]
    assert "predicted_rise_reduction_mgdl" in summary["circadian_suggestion"]

    assert "medications_today" in summary
    assert isinstance(summary["medications_today"], list)

    assert "weekly_streak" in summary
    assert "current_streak_days" in summary["weekly_streak"]
    assert "history" in summary["weekly_streak"]
