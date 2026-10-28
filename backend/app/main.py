"""
GlucoTwin API - Personalized Metabolic Digital Twin Platform
Branch: feature/clinical-decision-support (v1.1.0)
Feature: Clinician-in-the-Loop Decision Cockpit, Safety Attestation & Unified Meal Intelligence
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.data_loader import data_loader
from app.db import init_db
from app.errors import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.routers import (
    alerts,
    auth,
    care_team,
    clinical,
    clinician,
    cohort,
    data,
    data_import,
    entries,
    export,
    foods,
    medications,
    messaging,
    patient_home,
    patients,
    replay,
    reports,
    system,
    twin,
    visits,
)
from app.twin.twin_engine import load_twin_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database schema, load data/manifests, and load twin recommender
    init_db()
    data_loader.load_all()
    load_twin_model()

    # Seed food items, medications, numbered patients, doctors & South Indian meals
    from app.db import SessionLocal
    from app.food_seeder import seed_foods, seed_demo_medications
    from app.comprehensive_seeder import seed_comprehensive_database
    db = SessionLocal()
    try:
        seed_foods(db)
        seed_demo_medications(db)
        seed_comprehensive_database(db)
    except Exception as e:
        print(f"Warning during comprehensive database seeding: {e}")
    finally:
        db.close()

    yield
    # Shutdown logic (if any)


app = FastAPI(
    title="GlucoTwin API",
    description="A personalised Type 2 diabetes digital twin with new-data entry, prediction, simulation, and personalised decision support.",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers for consistent error formatting
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)

# Register routers
app.include_router(system.router)
app.include_router(auth.router)
app.include_router(care_team.router)
app.include_router(alerts.router)
app.include_router(clinician.router)
app.include_router(data.router)
app.include_router(patients.router)
app.include_router(entries.router)
app.include_router(twin.router)
app.include_router(clinical.router)
app.include_router(cohort.router)
app.include_router(reports.router)
app.include_router(messaging.router)
app.include_router(data_import.router)
app.include_router(export.router)
app.include_router(replay.router)
app.include_router(visits.router)
app.include_router(foods.router)
app.include_router(medications.router)
app.include_router(patient_home.router)



