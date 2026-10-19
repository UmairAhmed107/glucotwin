"""
Clinician Router for GlucoTwin
Provides the clinician home patient panel aggregation, risk stratification, and patient overview.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, log_audit_event, require_role
from app.clinical.alerts_engine import calculate_patient_risk_score
from app.db import get_db
from app.models_db import Alert, CareTeamLink, GlucoseReading, Patient, TwinState, User
from app.schemas import ClinicianPanelItem

router = APIRouter(prefix="/clinician", tags=["Clinician Panel"])


@router.get("/panel", response_model=List[ClinicianPanelItem], status_code=status.HTTP_200_OK)
def get_clinician_patient_panel(
    current_user: User = Depends(require_role("clinician", "dietitian", "admin")),
    db: Session = Depends(get_db),
) -> List[ClinicianPanelItem]:
    """
    Returns the comprehensive patient panel for the authenticated clinician or care team member.
    Aggregates:
      - Risk score (explainable weighted formula) and risk level (low/moderate/high/critical)
      - Time-in-range percentage (70-180 mg/dL target)
      - Last glucose reading timestamp
      - Open alert counts broken down by severity (critical, warning, info)
      - Metabolic twin personalization and calibration status
    """
    # Scope patients by provider access
    if current_user.role == "admin":
        patients = db.query(Patient).order_by(Patient.id).all()
        active_patient_ids = {p.id for p in patients}
    else:
        active_links = (
            db.query(CareTeamLink)
            .filter(
                CareTeamLink.provider_user_id == current_user.id,
                CareTeamLink.status == "active",
            )
            .all()
        )
        active_patient_ids = {l.patient_id for l in active_links}
        patients = (
            db.query(Patient)
            .filter(Patient.id.in_(active_patient_ids))
            .order_by(Patient.id)
            .all()
        )

    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    panel_items: List[ClinicianPanelItem] = []

    for patient in patients:
        # 1. Fetch open alerts
        open_alerts = (
            db.query(Alert)
            .filter(Alert.patient_id == patient.id, Alert.status == "open")
            .all()
        )
        alerts_by_sev = {"critical": 0, "warning": 0, "info": 0}
        alerts_dicts = []
        for a in open_alerts:
            sev = a.severity.lower()
            alerts_by_sev[sev] = alerts_by_sev.get(sev, 0) + 1
            alerts_dicts.append({"severity": sev, "rule_key": a.rule_key})

        # 2. Fetch glucose readings
        readings = (
            db.query(GlucoseReading)
            .filter(GlucoseReading.patient_id == patient.id)
            .order_by(GlucoseReading.ts.desc())
            .all()
        )

        last_reading_time = readings[0].ts if readings else None

        # Filter readings in last 7 days for Time in Range
        recent_readings = [
            r for r in readings
            if r.ts and (r.ts if r.ts.tzinfo else r.ts.replace(tzinfo=timezone.utc)) >= seven_days_ago
        ]
        eval_readings = recent_readings if recent_readings else readings[:50]

        time_in_range_pct: Optional[float] = None
        tir_float: Optional[float] = None
        lowest_recent_glucose: Optional[float] = None

        if eval_readings:
            in_range = sum(1 for r in eval_readings if 70.0 <= r.value_mgdl <= 180.0)
            tir_float = in_range / len(eval_readings)
            time_in_range_pct = round(tir_float * 100.0, 1)
            lowest_recent_glucose = min(r.value_mgdl for r in eval_readings)

        # 3. Calculate Risk Score using documented formula
        risk_score, risk_level = calculate_patient_risk_score(
            hba1c_pct=patient.hba1c_pct,
            time_in_range=tir_float,
            open_alerts=alerts_dicts,
            hypoglycemia_history=patient.hypoglycemia_history,
            recent_hypo_min=lowest_recent_glucose,
        )

        # 4. Twin state status
        twin_state = patient.twin_state
        twin_status = {
            "mem_n": twin_state.mem_n if twin_state else 0,
            "confidence_score": twin_state.confidence_score if twin_state else 0.0,
            "personalized": (twin_state.mem_n > 0) if twin_state else False,
            "last_calibrated": (
                twin_state.updated_at.isoformat()
                if twin_state and twin_state.updated_at
                else None
            ),
        }

        panel_items.append(
            ClinicianPanelItem(
                patient_id=patient.id,
                display_name=patient.display_name,
                age=patient.age,
                sex=patient.sex,
                hba1c_pct=patient.hba1c_pct,
                risk_score=risk_score,
                risk_level=risk_level,
                time_in_range_pct=time_in_range_pct,
                last_reading_time=last_reading_time,
                open_alerts_count=len(open_alerts),
                alerts_by_severity=alerts_by_sev,
                twin_status=twin_status,
                care_team_status="active",
            )
        )

    # Sort default by risk score descending (highest clinical priority first)
    panel_items.sort(key=lambda p: p.risk_score, reverse=True)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="read",
        resource_type="clinician_panel",
        resource_id="summary",
    )

    return panel_items
