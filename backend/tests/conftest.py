from typing import Generator
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.data_loader import data_loader
from app.db import Base, get_db
from app.main import app
from app.twin.twin_engine import load_twin_model, get_twin_model

# In-memory SQLite engine for tests
TEST_DB_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_test_dataframes(monkeypatch):
    """
    Configure fast in-memory fixture DataFrames for data_loader and prevent
    lifespan startup from overwriting them during tests.
    """
    monkeypatch.setattr(data_loader, "load_all", lambda *args, **kwargs: None)

    # Tiny fixture for CGMacros bio dataset
    data_loader.bio_df = pd.DataFrame([
        {
            "subject": 101,
            "Age": 45,
            "Gender": "F",
            "BMI": 28.5,
            "A1c PDL (Lab)": 6.4,
            "Fasting GLU - PDL (Lab)": 115.0,
        },
        {
            "subject": 102,
            "Age": 52,
            "Gender": "M",
            "BMI": 31.2,
            "A1c PDL (Lab)": 7.1,
            "Fasting GLU - PDL (Lab)": 130.0,
        },
    ])
    data_loader.is_bio_available = True

    # Tiny fixture for Shanghai clinical dataset
    data_loader.shanghai_df = pd.DataFrame([
        {
            "patient_id": 3001,
            "session_id": "3001_0_test",
            "age": 58,
            "sex": "M",
            "bmi": 26.4,
            "fasting_glucose_mgdl": 125.0,
            "hba1c_pct": 7.8,
            "Hypoglycemia (yes/no)": "yes",
        },
        {
            "patient_id": 3002,
            "session_id": "3002_0_test",
            "age": 62,
            "sex": "F",
            "bmi": 24.1,
            "fasting_glucose_mgdl": 98.0,
            "hba1c_pct": 6.2,
            "Hypoglycemia (yes/no)": "no",
        },
    ])
    data_loader.is_shanghai_available = True

    # Tiny fixture for meals_db dataset
    data_loader.meals_df = pd.DataFrame([
        {
            "patient_id": 101,
            "timestamp": pd.Timestamp("2026-10-10 08:00:00"),
            "meal_type": "breakfast",
            "carbs_g": 45.0,
            "protein_g": 20.0,
            "fat_g": 12.0,
            "fiber_g": 5.0,
            "kcal": 368.0,
            "pre_glucose": 95.0,
            "pre_trend30": 0.0,
            "prior_act_60": 110.0,
            "post_act_60": 115.0,
            "hr_pre30": 80.0,
            "gap_prev_min": 250.0,
            "peak_rise": 25.0,
            "iauc_2h": 22.0,
            "hour": 8.0,
            "hour_sin": 0.866,
            "hour_cos": -0.5,
            "is_breakfast": 1.0,
            "is_lunch": 0.0,
            "is_dinner": 0.0,
            "is_snack": 0.0,
            "mem_mean_rise": 25.0,
            "mem_mean_iauc": 22.0,
            "mem_n": 1.0,
            "clean": True,
        },
        {
            "patient_id": 101,
            "timestamp": pd.Timestamp("2026-10-10 13:00:00"),
            "meal_type": "lunch",
            "carbs_g": 60.0,
            "protein_g": 30.0,
            "fat_g": 18.0,
            "fiber_g": 6.0,
            "kcal": 522.0,
            "pre_glucose": 100.0,
            "pre_trend30": -2.0,
            "prior_act_60": 120.0,
            "post_act_60": 110.0,
            "hr_pre30": 82.0,
            "gap_prev_min": 300.0,
            "peak_rise": 35.0,
            "iauc_2h": 32.0,
            "hour": 13.0,
            "hour_sin": -0.258,
            "hour_cos": -0.965,
            "is_breakfast": 0.0,
            "is_lunch": 1.0,
            "is_dinner": 0.0,
            "is_snack": 0.0,
            "mem_mean_rise": 30.0,
            "mem_mean_iauc": 27.0,
            "mem_n": 2.0,
            "clean": True,
        },
        {
            "patient_id": 102,
            "timestamp": pd.Timestamp("2026-10-10 12:00:00"),
            "meal_type": "lunch",
            "carbs_g": 50.0,
            "protein_g": 25.0,
            "fat_g": 15.0,
            "fiber_g": 4.0,
            "kcal": 435.0,
            "pre_glucose": 110.0,
            "pre_trend30": 1.0,
            "prior_act_60": 105.0,
            "post_act_60": 100.0,
            "hr_pre30": 85.0,
            "gap_prev_min": 280.0,
            "peak_rise": 45.0,
            "iauc_2h": 40.0,
            "hour": 12.0,
            "hour_sin": 0.0,
            "hour_cos": -1.0,
            "is_breakfast": 0.0,
            "is_lunch": 1.0,
            "is_dinner": 0.0,
            "is_snack": 0.0,
            "mem_mean_rise": 45.0,
            "mem_mean_iauc": 40.0,
            "mem_n": 1.0,
            "clean": True,
        },
    ])
    data_loader.is_meals_available = True

    # Tiny manifest fixture
    data_loader.model_manifest = {
        "class_name": "MealRecommender",
        "sklearn_version": "1.6.1",
        "pandas_version": "2.2.3",
        "numpy_version": "2.1.3",
        "meals_db": {"shape": [1200, 38]},
        "shanghai_clinical": {"shape": [109, 37]},
        "public_methods": {"recommend": "(self, meal, margin)"},
    }

    # Ensure twin recommender model singleton is loaded
    if get_twin_model() is None:
        load_twin_model()


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provide a fresh isolated database for each test function."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Test client using the test database session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
