"""
Metabolic Twin Lifecycle, Reconciliation, Drift Detection, and Maturity Engine.

Enforces the digital twin lifecycle without altering the underlying model:
1. Forecast Logging: Records every twin forecast for logged meals into PredictionRecord.
2. Reconciliation: When CGM/glucose readings cover the 3-hour postprandial window,
   computes actual peak rise, prediction error, and interval coverage (in P10-P90).
   Idempotent: reconciling multiple times produces identical state without side effects.
3. Personalization Update: Updates meal observed outcomes and invokes recompute_twin_state
   to advance patient memory (mem_n, mem_mean_rise, mem_mean_iauc).
4. Drift Detection: Evaluates a rolling window of the last 20 reconciled predictions.
   Flags drift if MAE rises > 30% above patient baseline OR interval coverage drops < 60%.
   Generates a clinical alert with root-cause suggestions.
5. Twin Maturity Scoring: Documented formula based on memory count, recent MAE,
   and interval coverage, mapped to 4 levels:
   Population, Learning, Personalized, and Well-calibrated.
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sqlalchemy.orm import Session

from app.models_db import Alert, GlucoseReading, MealEntry, Patient, PredictionRecord, TwinState
from app.twin.bounds import check_bounds
from app.twin.memory import compute_memory, get_population_baseline, recompute_twin_state
from app.twin.twin_engine import MealRecommender, get_model_version, get_twin_model

logger = logging.getLogger("glucotwin.twin.lifecycle")


# ============================================================================
# 1. Prediction Record Generation
# ============================================================================

def build_feature_row_from_meal(
    meal: MealEntry,
    mem: Dict[str, Any],
) -> Dict[str, Any]:
    """Construct the exact 20-feature row expected by MealRecommender from a MealEntry."""
    logged_time = meal.logged_at
    h = float(logged_time.hour + logged_time.minute / 60.0) if logged_time else 12.0
    hour_sin = float(np.sin(2.0 * np.pi * h / 24.0))
    hour_cos = float(np.cos(2.0 * np.pi * h / 24.0))

    # Inferred meal type from hour
    is_breakfast = 1.0 if (4.0 <= h < 11.0) else 0.0
    is_lunch = 1.0 if (11.0 <= h < 16.0) else 0.0
    is_dinner = 1.0 if (16.0 <= h < 22.0) else 0.0
    is_snack = 1.0 if (h < 4.0 or h >= 22.0) else 0.0

    return {
        "carbs_g": float(meal.carbs_g),
        "protein_g": float(meal.protein_g),
        "fat_g": float(meal.fat_g),
        "fiber_g": float(meal.fibre_g or 0.0),
        "kcal": float(meal.calories or 0.0),
        "pre_glucose": float(meal.pre_glucose),
        "pre_trend30": float(meal.pre_trend30 or 0.0),
        "hour_sin": hour_sin,
        "hour_cos": hour_cos,
        "is_breakfast": is_breakfast,
        "is_lunch": is_lunch,
        "is_dinner": is_dinner,
        "is_snack": is_snack,
        "prior_act_60": 118.76,
        "hr_pre30": 83.70,
        "gap_prev_min": 276.0,
        "post_act_60": 109.67,
        "mem_mean_rise": float(mem["mem_mean_rise"]),
        "mem_mean_iauc": float(mem["mem_mean_iauc"]),
        "mem_n": float(mem["mem_n"]),
    }


def create_prediction_record_for_meal(
    meal: MealEntry,
    patient_id: int,
    db: Session,
) -> PredictionRecord:
    """
    Generate and persist a PredictionRecord for a logged meal.
    If a record already exists for this meal_id, returns the existing record (idempotent).
    """
    existing = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.meal_id == meal.id)
        .first()
    )
    if existing:
        return existing

    rec = get_twin_model()
    mem = compute_memory(patient_id=patient_id, db=db, exclude_meal_id=meal.id)
    version = get_model_version() or "15-ensemble-bootstrap"

    if rec is not None:
        try:
            row = build_feature_row_from_meal(meal, mem)
            # Bound clamping for graceful forecast if slightly outside
            clamped_row = dict(row)
            for k in rec.lo.index:
                if k in clamped_row:
                    clamped_row[k] = float(np.clip(clamped_row[k], rec.lo[k], rec.hi[k]))

            preds = rec._predict(clamped_row)
            pred_median = float(round(float(np.median(preds)), 2))
            p10 = float(round(float(np.percentile(preds, 10)), 2))
            p90 = float(round(float(np.percentile(preds, 90)), 2))
        except Exception as e:
            logger.warning("Error predicting peak_rise with twin model: %s. Using baseline.", e)
            pop = get_population_baseline()
            pred_median = round(pop["pop_mean_rise"], 2)
            p10 = round(pred_median - 15.0, 2)
            p90 = round(pred_median + 15.0, 2)
    else:
        pop = get_population_baseline()
        pred_median = round(pop["pop_mean_rise"], 2)
        p10 = round(pred_median - 15.0, 2)
        p90 = round(pred_median + 15.0, 2)

    record = PredictionRecord(
        patient_id=patient_id,
        meal_id=meal.id,
        predicted_peak_rise=pred_median,
        p10=p10,
        p90=p90,
        model_version=version,
        created_at=meal.logged_at or datetime.now(timezone.utc),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ============================================================================
# 2. Postprandial 3-Hour Window Reconciliation
# ============================================================================

def _to_utc(dt: datetime) -> datetime:
    """Ensure datetime has UTC timezone."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def is_window_covered(
    meal: MealEntry,
    patient_readings: List[GlucoseReading],
) -> Tuple[bool, List[GlucoseReading]]:
    """
    Check if the 3-hour postprandial window [t_meal, t_meal + 3h] is covered by readings.
    Conditions for coverage:
    1. Direct observed_peak_rise already set on meal (e.g. from test or manual entry).
    2. OR at least one reading exists in [t_meal, t_meal + 3h] AND patient has readings
       reaching >= t_meal + 3h.
    3. OR readings in [t_meal, t_meal + 3h] span at least 90 minutes.
    """
    if meal.observed_peak_rise is not None:
        return True, []

    if not patient_readings:
        return False, []

    meal_time = _to_utc(meal.logged_at)
    window_end = meal_time + timedelta(hours=3)

    window_readings = [
        r for r in patient_readings
        if meal_time <= _to_utc(r.ts) <= window_end
    ]

    if not window_readings:
        return False, []

    # Check if latest reading in patient history is >= window_end
    latest_patient_time = max(_to_utc(r.ts) for r in patient_readings)
    if latest_patient_time >= window_end:
        return True, window_readings

    # Check if window readings span at least 90 minutes
    times = [_to_utc(r.ts) for r in window_readings]
    span_minutes = (max(times) - meal_time).total_seconds() / 60.0
    if span_minutes >= 90.0:
        return True, window_readings

    return False, []


def reconcile_patient_predictions(
    patient_id: int,
    db: Session,
    force_recheck: bool = False,
) -> int:
    """
    Reconciles all unreconciled PredictionRecords for a patient whose 3-hour
    glucose window has arrived.
    
    Idempotent: Predictions with reconciled_at is not None are skipped.
    Returns the count of newly reconciled predictions.
    """
    query = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.patient_id == patient_id)
    )
    if not force_recheck:
        query = query.filter(PredictionRecord.reconciled_at.is_(None))

    unreconciled = query.all()
    if not unreconciled:
        return 0

    patient_readings = (
        db.query(GlucoseReading)
        .filter(GlucoseReading.patient_id == patient_id)
        .order_by(GlucoseReading.ts.asc())
        .all()
    )

    reconciled_count = 0
    now = datetime.now(timezone.utc)

    for record in unreconciled:
        # If already reconciled and not forcing, skip
        if record.reconciled_at is not None and not force_recheck:
            continue

        meal = db.query(MealEntry).filter(MealEntry.id == record.meal_id).first()
        if not meal:
            continue

        covered, window_readings = is_window_covered(meal, patient_readings)
        if not covered:
            continue

        # Compute actual peak rise
        if window_readings:
            peak_glucose = max(
                [r.value_mgdl for r in window_readings] + [meal.pre_glucose]
            )
            actual_peak_rise = round(peak_glucose - meal.pre_glucose, 2)
            actual_iauc_2h = round(max(0.0, actual_peak_rise * 1.25), 2)
        elif meal.observed_peak_rise is not None:
            actual_peak_rise = round(meal.observed_peak_rise, 2)
            actual_iauc_2h = (
                round(meal.observed_iauc_2h, 2)
                if meal.observed_iauc_2h is not None
                else round(max(0.0, actual_peak_rise * 1.25), 2)
            )
        else:
            continue

        # Calculate error and interval coverage
        error = round(actual_peak_rise - record.predicted_peak_rise, 2)
        in_range = bool(record.p10 <= actual_peak_rise <= record.p90)

        record.actual_peak_rise = actual_peak_rise
        record.actual_iauc_2h = actual_iauc_2h
        record.error = error
        record.in_range = in_range
        record.reconciled_at = now

        # Update MealEntry observed values to trigger twin memory adaptation
        meal.observed_peak_rise = actual_peak_rise
        if meal.observed_iauc_2h is None:
            meal.observed_iauc_2h = actual_iauc_2h

        reconciled_count += 1

    if reconciled_count > 0:
        db.commit()
        # Personalization update: Recompute twin memory state (mem_n, mem_mean_rise, mem_mean_iauc)
        recompute_twin_state(patient_id=patient_id, db=db)
        # Check for model drift and sync alerts
        check_and_sync_drift_alert(patient_id=patient_id, db=db)

    return reconciled_count


# ============================================================================
# 3. Model Drift Detection
# ============================================================================

def detect_drift_metrics(
    reconciled_records: List[PredictionRecord],
    rolling_n: int = 20,
) -> Dict[str, Any]:
    """
    Pure evaluation of twin drift metrics:
    - Evaluates rolling window of up to last 20 reconciled predictions.
    - Compares recent MAE against earlier baseline MAE (or nominal 14.0 if baseline not yet mature).
    - Checks whether MAE rose > 30% above baseline OR interval coverage < 60%.
    """
    if not reconciled_records:
        return {
            "drift_detected": False,
            "reason": None,
            "rolling_mae": None,
            "baseline_mae": None,
            "coverage_pct": None,
            "window_size": 0,
        }

    # Sort chronologically by reconciled_at or created_at
    sorted_records = sorted(
        reconciled_records,
        key=lambda r: r.reconciled_at or r.created_at,
    )
    total_n = len(sorted_records)
    window = sorted_records[-rolling_n:]
    window_errors = [abs(r.error) for r in window if r.error is not None]
    window_in_range = [1 if r.in_range else 0 for r in window if r.in_range is not None]

    if not window_errors:
        return {
            "drift_detected": False,
            "reason": None,
            "rolling_mae": None,
            "baseline_mae": None,
            "coverage_pct": None,
            "window_size": 0,
        }

    recent_mae = round(float(np.mean(window_errors)), 2)
    coverage = round(float(np.mean(window_in_range)), 3) if window_in_range else 1.0
    coverage_pct = round(coverage * 100.0, 1)

    # Establish baseline MAE:
    # If we have earlier records prior to this rolling window, compute their MAE.
    if total_n > rolling_n:
        earlier = sorted_records[:-rolling_n]
        earlier_errors = [abs(r.error) for r in earlier if r.error is not None]
        baseline_mae = round(float(np.mean(earlier_errors)), 2) if earlier_errors else 14.0
    elif total_n >= 6:
        # Use first half as baseline
        half = total_n // 2
        initial_errors = [abs(r.error) for r in sorted_records[:half] if r.error is not None]
        baseline_mae = round(float(np.mean(initial_errors)), 2) if initial_errors else 14.0
    else:
        baseline_mae = 14.0  # Nominal population twin MAE

    drift_reasons = []
    # Trigger 1: MAE rises more than 30% above earlier baseline
    if total_n >= 5 and baseline_mae > 0 and recent_mae > (1.30 * baseline_mae):
        pct_increase = round(((recent_mae - baseline_mae) / baseline_mae) * 100.0, 1)
        drift_reasons.append(
            f"Rolling MAE ({recent_mae:.1f} mg/dL) increased {pct_increase}% above baseline ({baseline_mae:.1f} mg/dL)"
        )

    # Trigger 2: Interval coverage drops below 60%
    if len(window) >= 5 and coverage < 0.60:
        drift_reasons.append(
            f"Interval coverage ({coverage_pct}%) dropped below the 60% minimum threshold"
        )

    drift_detected = len(drift_reasons) > 0
    reason_str = "; ".join(drift_reasons) if drift_detected else None

    return {
        "drift_detected": drift_detected,
        "reason": reason_str,
        "rolling_mae": recent_mae,
        "baseline_mae": baseline_mae,
        "coverage_pct": coverage_pct,
        "window_size": len(window),
        "total_reconciled": total_n,
    }


def check_and_sync_drift_alert(
    patient_id: int,
    db: Session,
) -> Optional[Alert]:
    """
    Check drift for patient and maintain an alert in the Alert table via Prompt 2 alerts module rules.
    If drift is active and no open alert exists, creates one.
    If drift has resolved and an open alert exists, marks it resolved.
    """
    reconciled = (
        db.query(PredictionRecord)
        .filter(
            PredictionRecord.patient_id == patient_id,
            PredictionRecord.reconciled_at.isnot(None),
        )
        .order_by(PredictionRecord.reconciled_at.asc())
        .all()
    )

    metrics = detect_drift_metrics(reconciled)
    now = datetime.now(timezone.utc)

    existing_open = (
        db.query(Alert)
        .filter(
            Alert.patient_id == patient_id,
            Alert.rule_key == "TWIN_MODEL_DRIFT",
            Alert.status == "open",
        )
        .first()
    )

    if metrics["drift_detected"]:
        if not existing_open:
            msg = (
                f"Twin model drift detected ({metrics['reason']}). "
                f"Possible causes include medication change, illness/stress, or CGM sensor calibration issue."
            )
            # Critical severity if both high MAE and low coverage
            severity = "critical" if (metrics["coverage_pct"] is not None and metrics["coverage_pct"] < 40.0) else "warning"
            alert = Alert(
                patient_id=patient_id,
                rule_key="TWIN_MODEL_DRIFT",
                severity=severity,
                message=msg,
                created_at=now,
                status="open",
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            return alert
        return existing_open
    else:
        # If no drift detected and alert was open, resolve it
        if existing_open:
            existing_open.status = "resolved"
            db.commit()
        return None


# ============================================================================
# 4. Twin Maturity Scoring Engine
# ============================================================================

def compute_twin_maturity(patient_id: int, db: Session) -> Dict[str, Any]:
    """
    Calculates the Twin Maturity Score [0, 100] and maps to maturity levels:
    - Population (< 35 or mem_n < 5)
    - Learning (35 - 59 or mem_n < 15)
    - Personalized (60 - 79)
    - Well-calibrated (>= 80 with mem_n >= 20, MAE <= 16, coverage >= 70%)

    Documented Formula:
    - S_mem = 40 * (1 - exp(-mem_n / 10))
    - S_mae = 30 * max(0, min(1, 1 - (recent_mae - 8) / 27)) [or 15 if no records]
    - S_cov = 30 * min(1, (coverage_pct / 100) / 0.80) [or 15 if no records]
    Total = round(S_mem + S_mae + S_cov, 1)
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        return {
            "patient_id": patient_id,
            "score": 0.0,
            "level": "Population",
            "description": "Patient not found.",
            "components": {},
            "next_milestone": "Initialize patient profile.",
            "timeline": [],
        }

    twin_state = db.query(TwinState).filter(TwinState.patient_id == patient_id).first()
    mem_n = twin_state.mem_n if twin_state else 0

    reconciled = (
        db.query(PredictionRecord)
        .filter(
            PredictionRecord.patient_id == patient_id,
            PredictionRecord.reconciled_at.isnot(None),
        )
        .order_by(PredictionRecord.reconciled_at.asc())
        .all()
    )

    drift_info = detect_drift_metrics(reconciled)
    recent_mae = drift_info["rolling_mae"]
    coverage_pct = drift_info["coverage_pct"]

    # 1. Memory Component (0 - 40 pts)
    s_mem = 40.0 * (1.0 - float(np.exp(-mem_n / 10.0)))

    # 2. Accuracy Component (0 - 30 pts)
    if recent_mae is not None:
        s_mae = 30.0 * float(max(0.0, min(1.0, 1.0 - (recent_mae - 8.0) / 27.0)))
    else:
        s_mae = 15.0  # Population prior

    # 3. Calibration / Coverage Component (0 - 30 pts)
    if coverage_pct is not None:
        s_cov = 30.0 * float(min(1.0, (coverage_pct / 100.0) / 0.80))
    else:
        s_cov = 15.0  # Population prior

    raw_score = s_mem + s_mae + s_cov
    score = round(float(np.clip(raw_score, 0.0, 100.0)), 1)

    # Level Classification
    if mem_n < 5 or score < 35.0:
        level = "Population"
        description = "Twin relies predominantly on population-wide metabolic priors. Log more postprandial meals to build personalized memory."
        next_milestone = f"Log {max(1, 5 - mem_n)} more meal(s) with glucose readings to reach Learning level."
    elif mem_n < 15 or score < 60.0:
        level = "Learning"
        description = "Twin is actively learning individual glycemic dynamics. Personalized calibration in progress."
        next_milestone = f"Log {max(1, 15 - mem_n)} more meal(s) to reach Personalized level."
    elif score < 80.0 or mem_n < 20 or (recent_mae is not None and recent_mae > 16.0) or (coverage_pct is not None and coverage_pct < 70.0):
        level = "Personalized"
        description = "Twin has established strong individual postprandial memory and accurate glycemic forecasting."
        next_milestone = "Maintain steady postprandial tracking with rolling MAE <= 16 mg/dL to achieve Well-calibrated status."
    else:
        level = "Well-calibrated"
        description = "Twin is highly calibrated to patient physiology with high accuracy and tight prediction intervals."
        next_milestone = "Twin is operating at peak calibration. Continue regular logging to maintain stability."

    # Build Milestone Timeline based on history
    timeline: List[Dict[str, Any]] = [
        {
            "level": "Population",
            "reached_at": (patient.created_at or datetime.now(timezone.utc)).isoformat(),
            "description": "Baseline population metabolic priors initialized.",
            "unlocked": True,
        }
    ]

    # Check if Learning milestone reached
    if len(reconciled) >= 5 or mem_n >= 5:
        reached_date = reconciled[4].reconciled_at if len(reconciled) >= 5 else patient.created_at
        timeline.append({
            "level": "Learning",
            "reached_at": (reached_date or datetime.now(timezone.utc)).isoformat(),
            "description": "Achieved initial 5+ postprandial observations.",
            "unlocked": True,
        })
    else:
        timeline.append({
            "level": "Learning",
            "reached_at": None,
            "description": "Requires 5 reconciled meals.",
            "unlocked": False,
        })

    # Check if Personalized milestone reached
    if len(reconciled) >= 15 or mem_n >= 15:
        reached_date = reconciled[14].reconciled_at if len(reconciled) >= 15 else patient.created_at
        timeline.append({
            "level": "Personalized",
            "reached_at": (reached_date or datetime.now(timezone.utc)).isoformat(),
            "description": "Achieved 15+ meals with tailored glycemic patterns.",
            "unlocked": True,
        })
    else:
        timeline.append({
            "level": "Personalized",
            "reached_at": None,
            "description": "Requires 15 reconciled meals and score >= 60.",
            "unlocked": False,
        })

    # Check if Well-calibrated milestone reached
    if level == "Well-calibrated":
        reached_date = reconciled[-1].reconciled_at if reconciled else patient.created_at
        timeline.append({
            "level": "Well-calibrated",
            "reached_at": (reached_date or datetime.now(timezone.utc)).isoformat(),
            "description": "Achieved high calibration score (>= 80), MAE <= 16 mg/dL, and >= 70% coverage.",
            "unlocked": True,
        })
    else:
        timeline.append({
            "level": "Well-calibrated",
            "reached_at": None,
            "description": "Requires score >= 80, 20+ meals, MAE <= 16 mg/dL, and coverage >= 70%.",
            "unlocked": False,
        })

    return {
        "patient_id": patient_id,
        "score": score,
        "level": level,
        "description": description,
        "components": {
            "memory_score": round(s_mem, 1),
            "accuracy_score": round(s_mae, 1),
            "calibration_score": round(s_cov, 1),
            "mem_n": mem_n,
            "recent_mae": recent_mae,
            "coverage_pct": coverage_pct,
            "formula": "Score = 40*(1-exp(-mem_n/10)) + 30*max(0,1-(MAE-8)/27) + 30*min(1,Cov/0.80)",
        },
        "next_milestone": next_milestone,
        "timeline": timeline,
    }


# ============================================================================
# 5. Accuracy & Error History Engine
# ============================================================================

def get_twin_accuracy_summary(patient_id: int, db: Session) -> Dict[str, Any]:
    """
    Produces full accuracy and calibration metrics for GET /twin/{patient_id}/accuracy:
    - History of predictions (predicted vs actual, errors, in_range)
    - Cumulative and rolling MAE
    - Coverage percentage
    - Active drift evaluation
    """
    records = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.patient_id == patient_id)
        .order_by(PredictionRecord.created_at.asc())
        .all()
    )

    reconciled = [r for r in records if r.reconciled_at is not None]
    drift_metrics = detect_drift_metrics(reconciled)

    # Compute rolling MAE per point for smooth visualization
    history_items: List[Dict[str, Any]] = []
    running_abs_errors: List[float] = []

    for r in records:
        rolling_mae_at_point = None
        if r.error is not None:
            running_abs_errors.append(abs(r.error))
            # 20-point rolling window
            window_slice = running_abs_errors[-20:]
            rolling_mae_at_point = round(float(np.mean(window_slice)), 2)

        history_items.append({
            "id": r.id,
            "meal_id": r.meal_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "predicted_peak_rise": r.predicted_peak_rise,
            "p10": r.p10,
            "p90": r.p90,
            "actual_peak_rise": r.actual_peak_rise,
            "actual_iauc_2h": r.actual_iauc_2h,
            "error": r.error,
            "in_range": r.in_range,
            "reconciled_at": r.reconciled_at.isoformat() if r.reconciled_at else None,
            "rolling_mae": rolling_mae_at_point,
            "model_version": r.model_version,
        })

    all_errors = [abs(r.error) for r in reconciled if r.error is not None]
    overall_mae = round(float(np.mean(all_errors)), 2) if all_errors else None

    # Check if open drift alert exists
    open_drift_alert = (
        db.query(Alert)
        .filter(
            Alert.patient_id == patient_id,
            Alert.rule_key == "TWIN_MODEL_DRIFT",
            Alert.status == "open",
        )
        .first()
    )

    return {
        "patient_id": patient_id,
        "total_predictions": len(records),
        "reconciled_count": len(reconciled),
        "overall_mae": overall_mae,
        "rolling_mae_20": drift_metrics["rolling_mae"],
        "interval_coverage_pct": drift_metrics["coverage_pct"],
        "drift_detected": drift_metrics["drift_detected"] or (open_drift_alert is not None),
        "drift_details": {
            "reason": drift_metrics["reason"] or (open_drift_alert.message if open_drift_alert else None),
            "baseline_mae": drift_metrics["baseline_mae"],
            "recent_mae": drift_metrics["rolling_mae"],
            "coverage_pct": drift_metrics["coverage_pct"],
            "suggested_causes": ["medication change", "illness / physiological stress", "sensor calibration issue"],
        } if (drift_metrics["drift_detected"] or open_drift_alert is not None) else None,
        "history": history_items,
    }
