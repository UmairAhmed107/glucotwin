"""
Alerts Router for GlucoTwin
Provides evaluation, listing, acknowledgement, and resolution of patient alerts.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, log_audit_event, verify_patient_access
from app.clinical.alerts_engine import evaluate_all_rules
from app.db import get_db
from app.models_db import Alert, CareTeamLink, GlucoseReading, MealEntry, Patient, PredictionRecord, User
from app.schemas import AlertResponse

router = APIRouter(prefix="/alerts", tags=["Clinical Alerts"])


def evaluate_and_sync_alerts(
    patient_id: int,
    db: Session,
    previous_hba1c: Optional[float] = None,
) -> List[Alert]:
    """
    Evaluates metabolic rules against patient readings & profile, inserting
    new open alerts while strictly avoiding duplicate open alerts for the same rule.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        return []

    patient_data = {
        "id": patient.id,
        "age": patient.age,
        "sex": patient.sex,
        "bmi": patient.bmi,
        "hba1c_pct": patient.hba1c_pct,
        "fasting_glucose_mgdl": patient.fasting_glucose_mgdl,
        "hypoglycemia_history": patient.hypoglycemia_history,
        "kidney_flag": patient.kidney_flag,
        "current_meds": patient.current_meds or [],
        "created_at": patient.created_at,
    }

    readings = (
        db.query(GlucoseReading)
        .filter(GlucoseReading.patient_id == patient_id)
        .order_by(GlucoseReading.ts.desc())
        .limit(200)
        .all()
    )

    meals = (
        db.query(MealEntry)
        .filter(MealEntry.patient_id == patient_id)
        .order_by(MealEntry.logged_at.desc())
        .limit(100)
        .all()
    )

    entries_payload = []
    for r in readings:
        entries_payload.append({
            "ts": r.ts,
            "value_mgdl": r.value_mgdl,
            "entry_type": "reading",
        })
    for m in meals:
        entries_payload.append({
            "logged_at": m.logged_at,
            "pre_glucose": m.pre_glucose,
            "observed_peak_rise": m.observed_peak_rise,
            "entry_type": "meal",
        })

    predictions = (
        db.query(PredictionRecord)
        .filter(
            PredictionRecord.patient_id == patient_id,
            PredictionRecord.reconciled_at.isnot(None),
        )
        .order_by(PredictionRecord.reconciled_at.asc())
        .all()
    )
    preds_payload = [
        {"error": p.error, "in_range": p.in_range, "actual_peak_rise": p.actual_peak_rise}
        for p in predictions
    ]

    now = datetime.now(timezone.utc)
    evaluations = evaluate_all_rules(
        patient_data=patient_data,
        entries=entries_payload,
        now=now,
        previous_hba1c=previous_hba1c,
        predictions=preds_payload,
    )

    # De-duplicate open alerts
    for ev in evaluations:
        existing_open = (
            db.query(Alert)
            .filter(
                Alert.patient_id == patient_id,
                Alert.rule_key == ev.rule_key,
                Alert.status == "open",
            )
            .first()
        )
        if not existing_open:
            new_alert = Alert(
                patient_id=patient_id,
                rule_key=ev.rule_key,
                severity=ev.severity,
                message=ev.message,
                created_at=now,
                status="open",
            )
            db.add(new_alert)

    db.commit()

    return (
        db.query(Alert)
        .filter(Alert.patient_id == patient_id, Alert.status == "open")
        .order_by(Alert.created_at.desc())
        .all()
    )


@router.post(
    "/evaluate/{patient_id}",
    response_model=List[AlertResponse],
    status_code=status.HTTP_200_OK,
)
def evaluate_patient_alerts(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[AlertResponse]:
    """
    Manually triggers rule evaluation for a specific patient.
    Checks ownership and active care team linkages before executing.
    """
    patient = verify_patient_access(patient_id, current_user, db)

    open_alerts = evaluate_and_sync_alerts(patient_id=patient.id, db=db)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="evaluate_alerts",
        resource_type="patient",
        resource_id=str(patient_id),
        patient_id=patient_id,
    )

    results = []
    for a in open_alerts:
        item = AlertResponse.model_validate(a)
        item.patient_name = patient.display_name
        results.append(item)
    return results


@router.get("", response_model=List[AlertResponse])
def list_alerts(
    patient_id: Optional[int] = Query(None, description="Filter by patient ID"),
    status: Optional[str] = Query(None, description="Filter by status (open, acknowledged, resolved)"),
    severity: Optional[str] = Query(None, description="Filter by severity (critical, warning, info)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[AlertResponse]:
    """
    Lists alerts with role-based scoping:
      - Patients see only their own alerts.
      - Clinicians and Dietitians see alerts for actively linked patients.
      - Admins see alerts across the entire institution.
    """
    query = db.query(Alert).join(Patient, Alert.patient_id == Patient.id)

    # Scoping by role
    if current_user.role == "patient":
        if not current_user.patient:
            return []
        query = query.filter(Alert.patient_id == current_user.patient.id)
    elif current_user.role in ("clinician", "dietitian"):
        active_links = (
            db.query(CareTeamLink.patient_id)
            .filter(
                CareTeamLink.provider_user_id == current_user.id,
                CareTeamLink.status == "active",
            )
            .all()
        )
        linked_ids = [l[0] for l in active_links]
        if patient_id is not None:
            if patient_id not in linked_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not have an active care team link for this patient.",
                )
            query = query.filter(Alert.patient_id == patient_id)
        else:
            query = query.filter(Alert.patient_id.in_(linked_ids))
    elif current_user.role == "admin":
        if patient_id is not None:
            query = query.filter(Alert.patient_id == patient_id)

    # Filters
    if status is not None:
        query = query.filter(Alert.status == status)
    if severity is not None:
        query = query.filter(Alert.severity == severity)

    alerts = query.order_by(Alert.created_at.desc()).all()

    results = []
    for a in alerts:
        item = AlertResponse.model_validate(a)
        if a.patient:
            item.patient_name = a.patient.display_name
        results.append(item)
    return results


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AlertResponse:
    """
    Acknowledge an open alert. Records user ID and timestamp.
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    # Verify user has access to this patient
    verify_patient_access(alert.patient_id, current_user, db)

    alert.status = "acknowledged"
    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="acknowledge_alert",
        resource_type="alert",
        resource_id=str(alert.id),
        patient_id=alert.patient_id,
    )

    resp = AlertResponse.model_validate(alert)
    if alert.patient:
        resp.patient_name = alert.patient.display_name
    return resp


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AlertResponse:
    """
    Resolve an alert (close it).
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    # Verify user has access to this patient
    verify_patient_access(alert.patient_id, current_user, db)

    alert.status = "resolved"
    db.commit()
    db.refresh(alert)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="resolve_alert",
        resource_type="alert",
        resource_id=str(alert.id),
        patient_id=alert.patient_id,
    )

    resp = AlertResponse.model_validate(alert)
    if alert.patient:
        resp.patient_name = alert.patient.display_name
    return resp
