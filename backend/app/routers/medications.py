from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, log_audit_event, verify_patient_access
from app.db import get_db
from app.models_db import DoseLog, Medication, Patient, User
from app.schemas import (
    AdherenceStatsResponse,
    DoseLogResponse,
    DoseLogUpdate,
    MedicationCreate,
    MedicationResponse,
)

router = APIRouter(tags=["Medications & Adherence"])


@router.get("/patients/{patient_id}/medications", response_model=List[MedicationResponse])
def get_patient_medications(
    patient_id: int,
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[MedicationResponse]:
    """
    List prescribed medications for a patient.
    """
    verify_patient_access(patient_id, current_user, db)
    query = db.query(Medication).filter(Medication.patient_id == patient_id)
    if active_only:
        query = query.filter(Medication.is_active == True)
    meds = query.all()
    return [MedicationResponse.model_validate(m) for m in meds]


@router.post("/patients/{patient_id}/medications", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
def create_medication(
    patient_id: int,
    payload: MedicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MedicationResponse:
    """
    Add a new medication prescription for a patient.
    """
    verify_patient_access(patient_id, current_user, db)

    med = Medication(
        patient_id=patient_id,
        name=payload.name.strip(),
        dosage=payload.dosage.strip(),
        schedule=payload.schedule.strip(),
        frequency_per_day=max(1, payload.frequency_per_day),
        is_active=True,
    )
    db.add(med)
    db.commit()
    db.refresh(med)

    # Automatically schedule today's dose if none exists
    now = datetime.now(timezone.utc)
    scheduled_time = now.replace(minute=0, second=0, microsecond=0)
    dose = DoseLog(
        medication_id=med.id,
        patient_id=patient_id,
        dose=med.dosage,
        scheduled_time=scheduled_time,
        status="pending",
    )
    db.add(dose)
    db.commit()

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="create",
        resource_type="medication",
        resource_id=med.id,
        patient_id=patient_id,
    )

    return MedicationResponse.model_validate(med)


@router.post("/patients/{patient_id}/medications/{med_id}/doses", response_model=DoseLogResponse, status_code=status.HTTP_201_CREATED)
def log_dose(
    patient_id: int,
    med_id: int,
    dose: Optional[str] = None,
    taken_at: Optional[datetime] = None,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DoseLogResponse:
    """
    Log a taken medication dose.
    """
    verify_patient_access(patient_id, current_user, db)
    med = db.query(Medication).filter(Medication.id == med_id, Medication.patient_id == patient_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")

    now = datetime.now(timezone.utc)
    log_time = taken_at or now

    dose_entry = DoseLog(
        medication_id=med.id,
        patient_id=patient_id,
        dose=dose or med.dosage,
        scheduled_time=log_time,
        taken_at=log_time,
        status="taken",
        notes=notes,
    )
    db.add(dose_entry)
    db.commit()
    db.refresh(dose_entry)

    res = DoseLogResponse.model_validate(dose_entry)
    res.medication_name = med.name
    return res


@router.patch("/medications/doses/{dose_id}", response_model=DoseLogResponse)
def update_dose_status(
    dose_id: int,
    payload: DoseLogUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DoseLogResponse:
    """
    Mark a scheduled dose as taken, skipped, or pending.
    """
    dose = db.query(DoseLog).filter(DoseLog.id == dose_id).first()
    if not dose:
        raise HTTPException(status_code=404, detail="Dose log not found")

    verify_patient_access(dose.patient_id, current_user, db)

    dose.status = payload.status
    if payload.status == "taken":
        dose.taken_at = payload.taken_at or datetime.now(timezone.utc)
    elif payload.status in ("skipped", "pending"):
        dose.taken_at = None

    if payload.notes is not None:
        dose.notes = payload.notes

    db.commit()
    db.refresh(dose)

    med = db.query(Medication).filter(Medication.id == dose.medication_id).first()
    res = DoseLogResponse.model_validate(dose)
    if med:
        res.medication_name = med.name
    return res


@router.get("/patients/{patient_id}/medications/adherence", response_model=AdherenceStatsResponse)
def get_medication_adherence(
    patient_id: int,
    days: int = Query(7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdherenceStatsResponse:
    """
    Calculate medication adherence statistics over a time window (default 7 days).
    Returns total scheduled, taken, missed doses, adherence rate %, current streak, and today's dose checklist.
    """
    verify_patient_access(patient_id, current_user, db)

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=days)

    doses = (
        db.query(DoseLog)
        .filter(
            DoseLog.patient_id == patient_id,
            DoseLog.scheduled_time >= window_start,
            DoseLog.scheduled_time <= now + timedelta(hours=12),
        )
        .order_by(DoseLog.scheduled_time.asc())
        .all()
    )

    meds_map = {m.id: m.name for m in db.query(Medication).filter(Medication.patient_id == patient_id).all()}

    def to_utc(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    total_scheduled = len(doses)
    taken_count = sum(1 for d in doses if d.status == "taken")
    missed_count = sum(1 for d in doses if d.status == "skipped" or (d.status == "pending" and to_utc(d.scheduled_time) < now))

    rate_pct = round((taken_count / total_scheduled) * 100.0, 1) if total_scheduled > 0 else 100.0

    # Calculate streak (consecutive days where all past scheduled doses were taken)
    current_streak = 0
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    for d_idx in range(days):
        day_date = (today_start - timedelta(days=d_idx)).date()
        day_doses = [d for d in doses if d.scheduled_time.date() == day_date and to_utc(d.scheduled_time) <= now]
        if not day_doses:
            if d_idx == 0:
                continue
            break
        all_taken = all(d.status == "taken" for d in day_doses)
        if all_taken:
            current_streak += 1
        else:
            if d_idx > 0:  # If yesterday or earlier had a missed dose, streak broke
                break

    # Extract today's doses
    today_doses_list: List[DoseLogResponse] = []
    for d in doses:
        if d.scheduled_time.date() == now.date():
            res = DoseLogResponse.model_validate(d)
            res.medication_name = meds_map.get(d.medication_id, "Medication")
            today_doses_list.append(res)

    return AdherenceStatsResponse(
        patient_id=patient_id,
        days_window=days,
        total_scheduled_doses=total_scheduled,
        total_taken_doses=taken_count,
        total_missed_doses=missed_count,
        adherence_rate_pct=rate_pct,
        current_streak_days=current_streak,
        today_doses=today_doses_list,
    )
