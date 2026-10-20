"""
Reports Router for GlucoTwin.
Provides:
- 2-page clinical consultation PDF report
- Per-patient Weekly report generator (JSON and PDF) summarizing:
  time-in-range, best and worst meals, twin accuracy, adherence, alerts, and plan progress.
- Manual trigger endpoints for generating and downloading reports.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, log_audit_event, verify_patient_access
from app.db import get_db
from app.errors import PatientNotFoundException
from app.models_db import Patient, User
from app.reports.pdf import generate_patient_report_pdf
from app.reports.weekly_report import (
    generate_weekly_report_data,
    generate_weekly_report_pdf,
)
from app.schemas import WeeklyReportResponse

router = APIRouter(tags=["Reports"])


# ---------------------------------------------------------------------------
# Consultation Dossier (Existing 2-Page Clinical Report)
# ---------------------------------------------------------------------------

@router.get("/patients/{patient_id}/report.pdf")
def get_patient_report_pdf(
    patient_id: int,
    db: Session = Depends(get_db),
):
    """
    Generate a 2-page clinical PDF report for the patient.
    Includes banner, patient profile, twin state and confidence,
    last predictions with ranges, what-if result, governed clinical plan,
    sources, and audit ID.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise PatientNotFoundException(patient_id)

    pdf_bytes = generate_patient_report_pdf(patient=patient, db=db)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="glucotwin_report_patient_{patient_id}.pdf"',
            "Content-Type": "application/pdf",
        },
    )


# ---------------------------------------------------------------------------
# Weekly Metabolic Progress Report (JSON & PDF)
# ---------------------------------------------------------------------------

@router.get("/reports/weekly/{patient_id}", response_model=WeeklyReportResponse)
@router.get("/patients/{patient_id}/weekly-report", response_model=WeeklyReportResponse)
def get_weekly_report_json(
    patient_id: int,
    period_days: int = Query(7, ge=1, le=90),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WeeklyReportResponse:
    """
    Generate weekly summary for patient in JSON format.
    Summarizes time-in-range, best and worst meals, twin accuracy,
    adherence, alerts, and care plan progress.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise PatientNotFoundException(patient_id)

    if current_user:
        verify_patient_access(patient_id, current_user, db)

    report_dict = generate_weekly_report_data(patient=patient, db=db, period_days=period_days)
    return WeeklyReportResponse(**report_dict)


@router.post("/reports/weekly/{patient_id}/generate", response_model=WeeklyReportResponse, status_code=status.HTTP_200_OK)
def trigger_weekly_report_generation(
    patient_id: int,
    period_days: int = Query(7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WeeklyReportResponse:
    """
    Manual trigger endpoint for generating the weekly patient summary report.
    No recurring background scheduler required.
    """
    patient = verify_patient_access(patient_id, current_user, db)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="generate_weekly_report",
        resource_type="weekly_report",
        resource_id=str(patient.id),
        patient_id=patient.id,
    )

    report_dict = generate_weekly_report_data(patient=patient, db=db, period_days=period_days)
    return WeeklyReportResponse(**report_dict)


@router.get("/reports/weekly/{patient_id}/pdf")
@router.get("/patients/{patient_id}/weekly-report.pdf")
def get_weekly_report_pdf(
    patient_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Download patient weekly progress dossier as a high-fidelity 2-page PDF.
    Reuses existing ReportLab canvas styling.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise PatientNotFoundException(patient_id)

    if current_user:
        verify_patient_access(patient_id, current_user, db)

    pdf_bytes = generate_weekly_report_pdf(patient=patient, db=db)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="glucotwin_weekly_report_patient_{patient_id}.pdf"',
            "Content-Type": "application/pdf",
        },
    )
