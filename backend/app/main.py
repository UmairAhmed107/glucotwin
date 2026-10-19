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
    auth,
    care_team,
    clinical,
    cohort,
    data,
    entries,
    patients,
    replay,
    reports,
    system,
    twin,
)
from app.twin.twin_engine import load_twin_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database schema, load data/manifests, and load twin recommender
    init_db()
    data_loader.load_all()
    load_twin_model()
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
app.include_router(data.router)
app.include_router(patients.router)
app.include_router(entries.router)
app.include_router(twin.router)
app.include_router(clinical.router)
app.include_router(cohort.router)
app.include_router(reports.router)
app.include_router(replay.router)


