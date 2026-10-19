"""
Cohort comparison router.
Note: The main GET /patients/{patient_id}/cohort-position endpoint is mounted
via the twin router (app.routers.twin) per the Phase 2 specification.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/cohort", tags=["Cohort Comparison"])
