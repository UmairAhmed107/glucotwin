from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.audit import log_audit
from app.auth import get_current_user, log_audit_event, verify_patient_access
from app.db import get_db
from app.errors import PatientNotFoundException
from app.models_db import GlucoseReading, MealEntry, Patient, User
from app.schemas import (
    GlucoseReadingCreate,
    GlucoseReadingResponse,
    MealEntryCreate,
    MealEntryResponse,
    TimelineItem,
    TimelineResponse,
)
from app.twin.memory import recompute_twin_state

router = APIRouter(prefix="/patients/{patient_id}", tags=["Entries & Timeline"])


@router.post("/meals", response_model=MealEntryResponse, status_code=status.HTTP_201_CREATED)
def log_meal(
    patient_id: int,
    payload: MealEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MealEntryResponse:
    """
    Log a meal entry for a patient.
    Stores entry and calls the recompute_twin_state hook function.
    """
    patient = verify_patient_access(patient_id, current_user, db)

    meal = MealEntry(
        patient_id=patient_id,
        logged_at=payload.logged_at,
        carbs_g=payload.carbs_g,
        protein_g=payload.protein_g,
        fat_g=payload.fat_g,
        fibre_g=payload.fibre_g,
        calories=payload.calories,
        pre_glucose=payload.pre_glucose,
        pre_trend30=payload.pre_trend30,
        observed_peak_rise=payload.observed_peak_rise,
        observed_iauc_2h=payload.observed_iauc_2h,
        observed_delta_60=payload.observed_delta_60,
        observed_delta_120=payload.observed_delta_120,
        activity_after_min=payload.activity_after_min,
    )
    db.add(meal)
    db.commit()
    db.refresh(meal)

    # Phase 1: Call hook function (returns without error)
    recompute_twin_state(patient_id=patient_id, db=db)

    # Audit log
    log_audit(
        db=db,
        patient_id=patient_id,
        endpoint=f"/patients/{patient_id}/meals",
        inputs=payload.model_dump(mode="json"),
    )
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="create",
        resource_type="meal_entry",
        resource_id=meal.id,
        patient_id=patient_id,
    )

    return MealEntryResponse.model_validate(meal)


@router.post("/readings", response_model=GlucoseReadingResponse, status_code=status.HTTP_201_CREATED)
def log_reading(
    patient_id: int,
    payload: GlucoseReadingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GlucoseReadingResponse:
    """
    Log a glucose reading for a patient.
    """
    patient = verify_patient_access(patient_id, current_user, db)

    reading = GlucoseReading(
        patient_id=patient_id,
        ts=payload.ts,
        value_mgdl=payload.value_mgdl,
        source=payload.source,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    # Audit log
    log_audit(
        db=db,
        patient_id=patient_id,
        endpoint=f"/patients/{patient_id}/readings",
        inputs=payload.model_dump(mode="json"),
    )
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="create",
        resource_type="glucose_reading",
        resource_id=reading.id,
        patient_id=patient_id,
    )

    return GlucoseReadingResponse.model_validate(reading)


@router.get("/timeline", response_model=TimelineResponse)
def get_timeline(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TimelineResponse:
    """
    Return merged chronological timeline of meals and readings for a patient.
    """
    patient = verify_patient_access(patient_id, current_user, db)

    meals = (
        db.query(MealEntry)
        .filter(MealEntry.patient_id == patient_id)
        .all()
    )
    readings = (
        db.query(GlucoseReading)
        .filter(GlucoseReading.patient_id == patient_id)
        .all()
    )

    events: list[TimelineItem] = []

    for m in meals:
        events.append(
            TimelineItem(
                type="meal",
                id=m.id,
                timestamp=m.logged_at,
                data=MealEntryResponse.model_validate(m).model_dump(mode="json"),
            )
        )

    for r in readings:
        events.append(
            TimelineItem(
                type="reading",
                id=r.id,
                timestamp=r.ts,
                data=GlucoseReadingResponse.model_validate(r).model_dump(mode="json"),
            )
        )

    # Sort chronologically by timestamp
    events.sort(key=lambda e: e.timestamp)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="read",
        resource_type="timeline",
        patient_id=patient_id,
    )

    return TimelineResponse(patient_id=patient_id, events=events)
