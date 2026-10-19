from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import PatientNotFoundException
from app.models_db import Patient
from app.reports.pdf import generate_patient_report_pdf

router = APIRouter(prefix="/patients/{patient_id}", tags=["Reports"])


@router.get("/report.pdf")
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

