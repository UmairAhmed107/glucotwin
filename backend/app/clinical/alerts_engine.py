"""
Alerts Engine for GlucoTwin
Pure functional rules engine for metabolic clinical safety alerts.
All functions are side-effect free, deterministic, and easily testable.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.clinical.governor import rule_r5_kidney_flag


@dataclass
class AlertEvaluation:
    rule_key: str
    severity: str  # 'info' | 'warning' | 'critical'
    message: str


def check_post_meal_peaks(
    entries: List[Dict[str, Any]],
    now: Optional[datetime] = None,
    days: int = 7,
    threshold_mgdl: float = 250.0,
    required_count: int = 3,
) -> Optional[AlertEvaluation]:
    """
    Rule 1: 3+ post-meal peaks above 250 mg/dL in 7 days.
    Checks entries within the trailing `days` window. Considers either:
      - entry with explicit is_post_meal=True or entry_type in ('post_meal', 'meal') and glucose > 250
      - meal with observed_peak_rise + pre_glucose > 250
    """
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    window_start = now - timedelta(days=days)
    peak_count = 0

    for entry in entries:
        ts = entry.get("timestamp") or entry.get("logged_at") or entry.get("ts")
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                continue
        if ts:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts < window_start:
                continue

        # Check peak calculation
        glucose = entry.get("glucose_mgdl") or entry.get("value_mgdl")
        pre_glucose = entry.get("pre_glucose")
        peak_rise = entry.get("observed_peak_rise")

        is_peak = False
        if glucose is not None and glucose > threshold_mgdl:
            # Check if tagged as post-meal or meal
            entry_type = entry.get("entry_type", "")
            is_post_meal = entry.get("is_post_meal", False)
            if is_post_meal or entry_type in ("post_meal", "meal"):
                is_peak = True
        elif pre_glucose is not None and peak_rise is not None:
            if (pre_glucose + peak_rise) > threshold_mgdl:
                is_peak = True

        if is_peak:
            peak_count += 1

    if peak_count >= required_count:
        return AlertEvaluation(
            rule_key="POST_MEAL_PEAKS_250",
            severity="warning" if peak_count < 5 else "critical",
            message=f"{peak_count} post-meal glucose peaks above {threshold_mgdl:.0f} mg/dL recorded in the last {days} days.",
        )
    return None


def check_hypoglycemia(
    entries: List[Dict[str, Any]],
    now: Optional[datetime] = None,
    days: int = 7,
    warning_threshold: float = 70.0,
    critical_threshold: float = 54.0,
) -> Optional[AlertEvaluation]:
    """
    Rule 2: any reading below 70 mg/dL (critical below 54 mg/dL).
    """
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    window_start = now - timedelta(days=days)
    lowest_reading: Optional[float] = None

    for entry in entries:
        ts = entry.get("timestamp") or entry.get("ts") or entry.get("logged_at")
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                continue
        if ts:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts < window_start:
                continue

        glucose = entry.get("value_mgdl") or entry.get("glucose_mgdl")
        if glucose is not None:
            if lowest_reading is None or glucose < lowest_reading:
                lowest_reading = float(glucose)

    if lowest_reading is not None and lowest_reading < warning_threshold:
        if lowest_reading < critical_threshold:
            return AlertEvaluation(
                rule_key="HYPOGLYCEMIA_EVENT",
                severity="critical",
                message=f"Critical hypoglycemia detected: {lowest_reading:.0f} mg/dL (< {critical_threshold:.0f} mg/dL threshold). Immediate clinician review required.",
            )
        else:
            return AlertEvaluation(
                rule_key="HYPOGLYCEMIA_EVENT",
                severity="warning",
                message=f"Hypoglycemia episode detected: {lowest_reading:.0f} mg/dL (< {warning_threshold:.0f} mg/dL threshold).",
            )
    return None


def check_no_recent_entry(
    entries: List[Dict[str, Any]],
    patient_created_at: Optional[datetime] = None,
    now: Optional[datetime] = None,
    threshold_hours: float = 48.0,
) -> Optional[AlertEvaluation]:
    """
    Rule 3: no glucose entry for 48 hours.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    latest_ts: Optional[datetime] = None
    for entry in entries:
        glucose = entry.get("value_mgdl") or entry.get("glucose_mgdl")
        if glucose is None:
            continue
        ts = entry.get("timestamp") or entry.get("ts") or entry.get("logged_at")
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                continue
        if ts:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if latest_ts is None or ts > latest_ts:
                latest_ts = ts

    # If no readings exist, reference patient creation time
    reference_time = latest_ts or patient_created_at
    if reference_time is not None:
        if reference_time.tzinfo is None:
            reference_time = reference_time.replace(tzinfo=timezone.utc)
        elapsed_hours = (now - reference_time).total_seconds() / 3600.0
        if elapsed_hours >= threshold_hours:
            return AlertEvaluation(
                rule_key="NO_ENTRY_48H",
                severity="warning",
                message=f"No glucose entry recorded for {elapsed_hours:.0f} hours (exceeds {threshold_hours:.0f}h clinical monitoring interval).",
            )
    return None


def check_time_in_range(
    entries: List[Dict[str, Any]],
    now: Optional[datetime] = None,
    days: int = 7,
    tir_threshold: float = 0.50,
    range_min: float = 70.0,
    range_max: float = 180.0,
    min_readings: int = 3,
) -> Optional[AlertEvaluation]:
    """
    Rule 4: time-in-range (70-180 mg/dL) under 50% over 7 days.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    window_start = now - timedelta(days=days)
    readings: List[float] = []

    for entry in entries:
        ts = entry.get("timestamp") or entry.get("ts") or entry.get("logged_at")
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                continue
        if ts:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts < window_start:
                continue

        glucose = entry.get("value_mgdl") or entry.get("glucose_mgdl")
        if glucose is not None:
            readings.append(float(glucose))

    if len(readings) >= min_readings:
        in_range_count = sum(1 for g in readings if range_min <= g <= range_max)
        tir = in_range_count / len(readings)
        if tir < tir_threshold:
            severity = "critical" if tir < 0.35 else "warning"
            return AlertEvaluation(
                rule_key="LOW_TIME_IN_RANGE",
                severity=severity,
                message=f"Time-in-range ({range_min:.0f}-{range_max:.0f} mg/dL) is {tir * 100:.1f}%, failing the {tir_threshold * 100:.0f}% target over {days} days ({len(readings)} readings evaluated).",
            )
    return None


def check_rising_hba1c(
    current_hba1c: Optional[float],
    previous_hba1c: Optional[float] = None,
    hba1c_history: Optional[List[Tuple[Any, float]]] = None,
    threshold_pct: float = 7.0,
) -> Optional[AlertEvaluation]:
    """
    Rule 5: HbA1c above 7.0% with a rising trend.
    """
    if current_hba1c is None or current_hba1c <= threshold_pct:
        return None

    is_rising = False
    prior_val = previous_hba1c

    if previous_hba1c is not None and current_hba1c > previous_hba1c:
        is_rising = True
    elif hba1c_history and len(hba1c_history) >= 2:
        # Check chronological trend
        sorted_history = sorted(hba1c_history, key=lambda x: x[0])
        prior_val = sorted_history[-2][1]
        if current_hba1c > prior_val:
            is_rising = True

    if is_rising:
        prev_str = f" (increased from {prior_val:.1f}%)" if prior_val is not None else ""
        return AlertEvaluation(
            rule_key="RISING_HBA1C",
            severity="warning",
            message=f"HbA1c elevated at {current_hba1c:.1f}% (> {threshold_pct:.1f}% target){prev_str} with an upward clinical trend.",
        )
    return None


def check_renal_metformin(patient_data: Dict[str, Any]) -> Optional[AlertEvaluation]:
    """
    Rule 6: eGFR-related flag if the renal flag is set and metformin is active.
    Strictly reuses Governor R5 logic without duplication.
    """
    if not patient_data.get("kidney_flag"):
        return None

    # Check whether patient has metformin in current_meds
    meds = patient_data.get("current_meds") or []
    if isinstance(meds, str):
        meds = [m.strip().lower() for m in meds.split(",")]
    else:
        meds = [str(m).strip().lower() for m in meds]

    has_active_metformin = any("metformin" in m for m in meds)
    if not has_active_metformin:
        return None

    # Call Governor R5 to verify clinical constraint enforcement
    dummy_plan = {"therapy_options": [{"drug_class": "metformin", "cautions": []}]}
    _, triggered_rules = rule_r5_kidney_flag(dummy_plan, patient_data)

    if "R5_RENAL_REVIEW_REQUIRED" in triggered_rules:
        return AlertEvaluation(
            rule_key="RENAL_METFORMIN_RISK",
            severity="critical",
            message="Renal impairment flag active with concurrent Metformin therapy; elevated lactic acidosis risk requires mandatory eGFR review (Governor R5).",
        )
    return None


def check_twin_model_drift(
    predictions: List[Dict[str, Any]],
    rolling_n: int = 20,
) -> Optional[AlertEvaluation]:
    """
    Rule 7: Twin Model Drift Detection.
    Evaluates rolling window of up to 20 reconciled predictions.
    Triggers when MAE rises > 30% above earlier baseline OR interval coverage drops < 60%.
    Message suggests possible causes: medication change, illness, sensor issue.
    """
    if not predictions:
        return None

    # Filter reconciled
    reconciled = [p for p in predictions if p.get("error") is not None]
    if len(reconciled) < 5:
        return None

    window = reconciled[-rolling_n:]
    window_errors = [abs(p["error"]) for p in window if p.get("error") is not None]
    if not window_errors:
        return None

    recent_mae = float(sum(window_errors) / len(window_errors))
    in_range_count = sum(1 for p in window if p.get("in_range") is True)
    coverage = float(in_range_count / len(window))

    # Baseline MAE
    if len(reconciled) > rolling_n:
        earlier = reconciled[:-rolling_n]
        earlier_errors = [abs(p["error"]) for p in earlier if p.get("error") is not None]
        baseline_mae = float(sum(earlier_errors) / len(earlier_errors)) if earlier_errors else 14.0
    elif len(reconciled) >= 6:
        half = len(reconciled) // 2
        initial_errors = [abs(p["error"]) for p in reconciled[:half] if p.get("error") is not None]
        baseline_mae = float(sum(initial_errors) / len(initial_errors)) if initial_errors else 14.0
    else:
        baseline_mae = 14.0

    drift_triggered = False
    reasons = []
    if baseline_mae > 0 and recent_mae > (1.30 * baseline_mae):
        drift_triggered = True
        pct = ((recent_mae - baseline_mae) / baseline_mae) * 100.0
        reasons.append(f"MAE rose {pct:.0f}% above baseline ({recent_mae:.1f} vs {baseline_mae:.1f} mg/dL)")

    if coverage < 0.60:
        drift_triggered = True
        reasons.append(f"interval coverage fell to {coverage*100:.0f}% (< 60% threshold)")

    if drift_triggered:
        reason_txt = "; ".join(reasons)
        severity = "critical" if (coverage < 0.40 and recent_mae > 1.50 * baseline_mae) else "warning"
        return AlertEvaluation(
            rule_key="TWIN_MODEL_DRIFT",
            severity=severity,
            message=(
                f"Twin model drift detected ({reason_txt}). "
                f"Suggested potential causes: medication change, illness, sensor issue."
            ),
        )
    return None


def evaluate_all_rules(
    patient_data: Dict[str, Any],
    entries: List[Dict[str, Any]],
    now: Optional[datetime] = None,
    previous_hba1c: Optional[float] = None,
    predictions: Optional[List[Dict[str, Any]]] = None,
) -> List[AlertEvaluation]:
    """
    Pure orchestration function that evaluates all metabolic and twin safety rules.
    Returns a list of AlertEvaluation results for all triggered rules.
    """
    alerts: List[AlertEvaluation] = []

    # Rule 1: 3+ post-meal peaks above 250 in 7 days
    r1 = check_post_meal_peaks(entries, now=now)
    if r1:
        alerts.append(r1)

    # Rule 2: any reading below 70 (critical below 54)
    r2 = check_hypoglycemia(entries, now=now)
    if r2:
        alerts.append(r2)

    # Rule 3: no glucose entry for 48 hours
    created_at = patient_data.get("created_at")
    r3 = check_no_recent_entry(entries, patient_created_at=created_at, now=now)
    if r3:
        alerts.append(r3)

    # Rule 4: time-in-range under 50% over 7 days
    r4 = check_time_in_range(entries, now=now)
    if r4:
        alerts.append(r4)

    # Rule 5: HbA1c above 7.0% with a rising trend
    r5 = check_rising_hba1c(
        current_hba1c=patient_data.get("hba1c_pct"),
        previous_hba1c=previous_hba1c or patient_data.get("previous_hba1c"),
    )
    if r5:
        alerts.append(r5)

    # Rule 6: eGFR renal flag + metformin (reuses Governor R5)
    r6 = check_renal_metformin(patient_data)
    if r6:
        alerts.append(r6)

    # Rule 7: Twin model drift (Prompt 2 alerts module)
    if predictions:
        r7 = check_twin_model_drift(predictions)
        if r7:
            alerts.append(r7)

    return alerts


def calculate_patient_risk_score(
    hba1c_pct: Optional[float],
    time_in_range: Optional[float],
    open_alerts: List[Dict[str, Any]],
    hypoglycemia_history: Optional[bool] = False,
    recent_hypo_min: Optional[float] = None,
) -> Tuple[float, str]:
    """
    Computes an explainable, weighted metabolic risk score [0, 100].
    
    Weights:
      - W_HBA1C   = 0.30: Sub-score based on glycemic control (HbA1c).
      - W_TIR     = 0.25: Sub-score based on glucose stability (1.0 - TIR).
      - W_ALERTS  = 0.25: Sub-score based on active open alerts severity.
      - W_HYPO    = 0.20: Sub-score based on hypoglycemia vulnerability.
      
    Returns:
      (risk_score: float clamped [0, 100], risk_level: 'low' | 'moderate' | 'high' | 'critical')
    """
    # 1. HbA1c Sub-score (0-100)
    # 5.0% -> 0, 11.0%+ -> 100
    if hba1c_pct is not None:
        s_hba1c = max(0.0, min(100.0, (hba1c_pct - 5.0) / 6.0 * 100.0))
    else:
        s_hba1c = 35.0  # default moderate assumption if unknown

    # 2. Time-In-Range Sub-score (0-100)
    # TIR 100% -> 0, TIR 0% -> 100
    if time_in_range is not None:
        s_tir = max(0.0, min(100.0, (1.0 - time_in_range) * 100.0))
    else:
        s_tir = 40.0

    # 3. Active Open Alerts Sub-score (0-100)
    # Critical = 40 pts, Warning = 15 pts, Info = 5 pts
    alert_penalty = 0.0
    for a in open_alerts:
        sev = (a.get("severity") or "").lower()
        if sev == "critical":
            alert_penalty += 40.0
        elif sev == "warning":
            alert_penalty += 15.0
        else:
            alert_penalty += 5.0
    s_alerts = min(100.0, alert_penalty)

    # 4. Hypoglycemia Sub-score (0-100)
    if recent_hypo_min is not None and recent_hypo_min < 54.0:
        s_hypo = 100.0
    elif recent_hypo_min is not None and recent_hypo_min < 70.0:
        s_hypo = 75.0
    elif hypoglycemia_history is True:
        s_hypo = 60.0
    else:
        s_hypo = 10.0

    # Composite weighted score
    score = (0.30 * s_hba1c) + (0.25 * s_tir) + (0.25 * s_alerts) + (0.20 * s_hypo)
    score_clamped = round(max(0.0, min(100.0, score)), 1)

    if score_clamped >= 80.0:
        level = "critical"
    elif score_clamped >= 60.0:
        level = "high"
    elif score_clamped >= 35.0:
        level = "moderate"
    else:
        level = "low"

    return score_clamped, level
