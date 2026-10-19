from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.audit import log_audit
from app.data_loader import (
    BioDataUnavailableException,
    ShanghaiDataUnavailableException,
    data_loader,
)
from app.db import get_db
from app.errors import (
    AppException,
    PatientNotFoundException,
    ServiceUnavailableException,
)
from app.models_db import AuditLog, Patient, TwinState
from app.schemas import AuditLogResponse, PatientCreate, PatientDetailResponse, PatientResponse
from app.twin.memory import recompute_twin_state

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.post("", response_model=PatientDetailResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreate, db: Session = Depends(get_db)
) -> PatientDetailResponse:
    """
    Create a patient via three modes:
    1. 'new': manual clinical profile (is_synthetic=True, source='new')
    2. 'cgmacros': loaded from CGMacros bio file (hypoglycemia_history=None, source='cgmacros', is_synthetic=False)
    3. 'shanghai_profile': selected from Shanghai cohort (is_synthetic=True, source='shanghai_profile')
    """
    if payload.mode == "new":
        patient = Patient(
            display_name=payload.display_name,
            is_synthetic=True,
            source="new",
            cgmacros_participant_id=None,
            age=payload.age,
            sex=payload.sex,
            bmi=payload.bmi,
            hba1c_pct=payload.hba1c_pct,
            fasting_glucose_mgdl=payload.fasting_glucose_mgdl,
            hypoglycemia_history=payload.hypoglycemia_history,
            kidney_flag=payload.kidney_flag,
            current_meds=payload.current_meds,
        )

    elif payload.mode == "cgmacros":
        try:
            profile = data_loader.get_cgmacros_profile(payload.cgmacros_participant_id)
        except BioDataUnavailableException as e:
            raise ServiceUnavailableException(
                message=str(e),
                details={"mode": "cgmacros", "reason": "bio_file_missing"},
            )
        except ValueError as e:
            raise AppException(
                code="PARTICIPANT_NOT_FOUND",
                message=str(e),
                status_code=404,
                details={"cgmacros_participant_id": payload.cgmacros_participant_id},
            )

        patient = Patient(
            display_name=payload.display_name or profile["display_name"],
            is_synthetic=False,
            source="cgmacros",
            cgmacros_participant_id=payload.cgmacros_participant_id,
            age=profile["age"],
            sex=profile["sex"],
            bmi=profile["bmi"],
            hba1c_pct=profile["hba1c_pct"],
            fasting_glucose_mgdl=profile["fasting_glucose_mgdl"],
            hypoglycemia_history=None,  # unknown per spec D2
            kidney_flag=payload.kidney_flag,
            current_meds=payload.current_meds,
        )

    elif payload.mode == "shanghai_profile":
        identifier = (
            payload.shanghai_patient_id
            if payload.shanghai_patient_id is not None
            else payload.session_id
        )
        try:
            profile = data_loader.get_shanghai_profile(identifier)
        except ShanghaiDataUnavailableException as e:
            raise ServiceUnavailableException(
                message=str(e),
                details={"mode": "shanghai_profile", "reason": "shanghai_dataset_missing"},
            )
        except ValueError as e:
            raise AppException(
                code="PROFILE_NOT_FOUND",
                message=str(e),
                status_code=404,
                details={"identifier": identifier},
            )

        patient = Patient(
            display_name=payload.display_name or profile["display_name"],
            is_synthetic=True,
            source="shanghai_profile",
            cgmacros_participant_id=None,
            age=profile["age"],
            sex=profile["sex"],
            bmi=profile["bmi"],
            hba1c_pct=profile["hba1c_pct"],
            fasting_glucose_mgdl=profile["fasting_glucose_mgdl"],
            hypoglycemia_history=profile["hypoglycemia_history"],
            kidney_flag=payload.kidney_flag,
            current_meds=payload.current_meds,
        )
    else:
        raise AppException(
            code="INVALID_MODE",
            message=f"Unsupported patient creation mode: {payload.mode}",
            status_code=400,
        )

    db.add(patient)
    db.commit()
    db.refresh(patient)

    # Initialize and compute associated twin state
    recompute_twin_state(patient.id, db)

    # Log audit entry
    log_audit(
        db=db,
        patient_id=patient.id,
        endpoint="/patients",
        inputs=payload.model_dump(mode="json"),
    )

    # Reload patient with relationships
    db.refresh(patient)
    return PatientDetailResponse.model_validate(patient)


@router.get("", response_model=List[PatientResponse])
def list_patients(db: Session = Depends(get_db)) -> List[PatientResponse]:
    """List all registered patients."""
    patients = db.query(Patient).order_by(Patient.id.desc()).all()
    return [PatientResponse.model_validate(p) for p in patients]


@router.get("/{patient_id}", response_model=PatientDetailResponse)
def get_patient(patient_id: int, db: Session = Depends(get_db)) -> PatientDetailResponse:
    """Get patient profile and current twin state."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise PatientNotFoundException(patient_id)
    return PatientDetailResponse.model_validate(patient)


@router.get("/{patient_id}/audit", response_model=List[AuditLogResponse])
def get_patient_audit_log(
    patient_id: int, db: Session = Depends(get_db)
) -> List[AuditLogResponse]:
    """Get audit trail entries for a patient."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise PatientNotFoundException(patient_id)
    entries = (
        db.query(AuditLog)
        .filter(AuditLog.patient_id == patient_id)
        .order_by(AuditLog.ts.desc())
        .limit(100)
        .all()
    )
    return [AuditLogResponse.model_validate(e) for e in entries]
