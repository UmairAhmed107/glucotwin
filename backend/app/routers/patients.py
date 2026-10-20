from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.audit import log_audit
from app.auth import get_current_user, log_audit_event, verify_patient_access
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
from app.models_db import AuditLog, CareTeamLink, Patient, TwinState, User, WearableDaily
from app.schemas import (
    AuditLogResponse,
    PatientCreate,
    PatientDetailResponse,
    PatientResponse,
    WearableDailyItem,
)
from app.twin.memory import recompute_twin_state

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.post("", response_model=PatientDetailResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
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

    # If current_user is a patient and has no profile yet, link it
    if current_user.role == "patient":
        patient.user_id = current_user.id

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
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="create",
        resource_type="patient",
        resource_id=patient.id,
        patient_id=patient.id,
    )

    # Reload patient with relationships
    db.refresh(patient)
    return PatientDetailResponse.model_validate(patient)


@router.get("", response_model=List[PatientResponse])
def list_patients(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[PatientResponse]:
    """List patients based on role and active care-team links."""
    if current_user.role == "admin":
        patients = db.query(Patient).order_by(Patient.id.desc()).all()
    elif current_user.role == "patient":
        patients = (
            db.query(Patient)
            .filter(Patient.user_id == current_user.id)
            .order_by(Patient.id.desc())
            .all()
        )
    elif current_user.role in ("clinician", "dietitian"):
        active_patient_ids = (
            db.query(CareTeamLink.patient_id)
            .filter(
                CareTeamLink.provider_user_id == current_user.id,
                CareTeamLink.status == "active",
            )
            .subquery()
        )
        patients = (
            db.query(Patient)
            .filter(Patient.id.in_(active_patient_ids))
            .order_by(Patient.id.desc())
            .all()
        )
    else:
        patients = []

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="read_list",
        resource_type="patient",
    )
    return [PatientResponse.model_validate(p) for p in patients]


@router.get("/{patient_id}", response_model=PatientDetailResponse)
def get_patient(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PatientDetailResponse:
    """Get patient profile and current twin state."""
    patient = verify_patient_access(patient_id, current_user, db)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="read",
        resource_type="patient",
        resource_id=patient.id,
        patient_id=patient.id,
    )
    return PatientDetailResponse.model_validate(patient)


@router.get("/{patient_id}/audit", response_model=List[AuditLogResponse])
def get_patient_audit_log(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[AuditLogResponse]:
    """Get audit trail entries for a patient."""
    patient = verify_patient_access(patient_id, current_user, db)

    entries = (
        db.query(AuditLog)
        .filter(AuditLog.patient_id == patient_id)
        .order_by(AuditLog.ts.desc())
        .limit(100)
        .all()
    )
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="read",
        resource_type="audit_log",
        patient_id=patient.id,
    )
    return [AuditLogResponse.model_validate(e) for e in entries]


@router.get("/{patient_id}/wearables", response_model=List[WearableDailyItem])
def get_patient_wearables(
    patient_id: int,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[WearableDailyItem]:
    """Retrieve daily wearable telemetry (steps, sleep hours) for display context."""
    patient = verify_patient_access(patient_id, current_user, db)
    items = (
        db.query(WearableDaily)
        .filter(WearableDaily.patient_id == patient.id)
        .order_by(WearableDaily.date.desc())
        .limit(limit)
        .all()
    )
    return items
