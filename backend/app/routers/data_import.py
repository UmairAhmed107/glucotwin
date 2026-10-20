"""
Data Import Router for CGM and Wearable CSV Exports.
Supports:
- POST /import/cgm: Generic timestamp,glucose and Abbott Libre-style export formats.
  Validates, de-duplicates by timestamp, detects and unit-converts mmol/L to mg/dL,
  inserts readings, and triggers alert evaluation and prediction reconciliation.
- POST /import/wearables: Daily steps and sleep hours CSV import, stored per day
  and exposed as optional context features for display only (never fed to twin model).
- GET /patients/{patient_id}/wearables: Retrieval of daily wearable context.
"""

import csv
from datetime import datetime, timezone
import io
import re
from typing import List, Optional, Set, Tuple
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, log_audit_event, verify_patient_access
from app.db import get_db
from app.models_db import GlucoseReading, Patient, User, WearableDaily, utcnow
from app.routers.alerts import evaluate_and_sync_alerts
from app.schemas import (
    CGMImportReport,
    WearableDailyItem,
    WearableImportReport,
)
from app.twin.lifecycle import reconcile_patient_predictions

router = APIRouter(prefix="/import", tags=["Data Import"])


def _parse_timestamp(ts_str: str) -> Optional[datetime]:
    """Parse a date/time string with multiple format fallbacks into a UTC datetime."""
    s = ts_str.strip()
    if not s:
        return None

    # Handle standard ISO formats
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        pass

    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y %I:%M %p",
        "%m/%d/%Y %I:%M:%S %p",
        "%d-%m-%Y %I:%M %p",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None


def _find_cgm_header_row(rows: List[List[str]]) -> Tuple[int, int, int, bool]:
    """
    Search rows for the CGM header.
    Returns: (header_row_index, timestamp_col_index, glucose_col_index, is_explicit_mmol)
    """
    for idx, row in enumerate(rows):
        if not row:
            continue
        cleaned = [c.strip().lower() for c in row]

        ts_col = -1
        glu_col = -1
        is_mmol = False

        # First pass: Look for known Abbott Libre or standard headers
        for c_idx, cell in enumerate(cleaned):
            if cell in (
                "meter timestamp",
                "device timestamp",
                "timestamp",
                "time",
                "date",
                "ts",
                "datetime",
            ):
                if ts_col == -1:
                    ts_col = c_idx

            if "historic glucose" in cell or "scan glucose" in cell or cell in ("glucose", "value", "reading", "glucose_mgdl"):
                if glu_col == -1 or "historic" in cell:
                    glu_col = c_idx
                if "mmol" in cell:
                    is_mmol = True

        # Fallback pass: check substring matches
        if ts_col == -1 or glu_col == -1:
            for c_idx, cell in enumerate(cleaned):
                if ts_col == -1 and ("time" in cell or "date" in cell or "timestamp" in cell):
                    ts_col = c_idx
                if glu_col == -1 and ("gluc" in cell or "value" in cell):
                    glu_col = c_idx
                    if "mmol" in cell:
                        is_mmol = True

        if ts_col != -1 and glu_col != -1:
            return idx, ts_col, glu_col, is_mmol

    return -1, -1, -1, False


@router.post("/cgm", response_model=CGMImportReport, status_code=status.HTTP_200_OK)
async def import_cgm_data(
    file: UploadFile = File(...),
    patient_id: Optional[int] = Form(None),
    patient_id_query: Optional[int] = Query(None, alias="patient_id"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CGMImportReport:
    """
    Accepts CSV exports (generic timestamp,glucose format or Abbott Libre format).
    - Validates rows and glucose bounds
    - De-duplicates by timestamp within file and against database
    - Unit-converts mmol/L to mg/dL (18.0182x) if detected
    - Automatically triggers alert evaluation and prediction reconciliation
    """
    target_pid = patient_id or patient_id_query
    if target_pid is None:
        if current_user.role == "patient":
            patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
            if not patient:
                raise HTTPException(status_code=404, detail="Patient profile not found")
            target_pid = patient.id
        else:
            raise HTTPException(status_code=400, detail="patient_id is required for clinician upload")

    patient = verify_patient_access(target_pid, current_user, db)

    # Read and decode CSV content
    content_bytes = await file.read()
    try:
        text_content = content_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text_content = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text_content = content_bytes.decode("latin-1")

    reader = csv.reader(io.StringIO(text_content))
    all_rows = list(reader)

    if not all_rows:
        raise HTTPException(status_code=422, detail="Uploaded CSV file is empty")

    header_idx, ts_col, glu_col, explicit_mmol = _find_cgm_header_row(all_rows)
    if header_idx == -1:
        raise HTTPException(
            status_code=422,
            detail="Unable to find valid timestamp and glucose header columns. Please check CSV format.",
        )

    data_rows = all_rows[header_idx + 1 :]
    if not data_rows:
        return CGMImportReport(
            patient_id=patient.id,
            rows_accepted=0,
            rows_skipped=0,
            errors=["File contains header but no data rows"],
            units_detected="unknown",
            alerts_evaluated=0,
            predictions_reconciled=0,
            message="No data rows processed.",
        )

    # Sample non-empty values to confirm unit (mmol/L vs mg/dL)
    sampled_values: List[float] = []
    parsed_candidates: List[Tuple[int, datetime, float]] = []
    errors: List[str] = []
    rows_skipped = 0

    seen_timestamps: Set[datetime] = set()

    for row_num, row in enumerate(data_rows, start=header_idx + 2):
        if not row or len(row) <= max(ts_col, glu_col):
            continue

        raw_ts = row[ts_col].strip()
        raw_val = row[glu_col].strip()

        # If glucose is empty in primary column (e.g. Scan glucose), check other columns
        if not raw_val and len(row) > glu_col + 1:
            for alt_val in row:
                if alt_val.strip() and alt_val.strip().replace(".", "", 1).isdigit():
                    raw_val = alt_val.strip()
                    break

        if not raw_ts or not raw_val:
            rows_skipped += 1
            continue

        ts = _parse_timestamp(raw_ts)
        if not ts:
            errors.append(f"Row {row_num}: Invalid timestamp '{raw_ts}'")
            rows_skipped += 1
            continue

        try:
            val = float(raw_val)
        except ValueError:
            errors.append(f"Row {row_num}: Non-numeric glucose value '{raw_val}'")
            rows_skipped += 1
            continue

        if val <= 0 or val > 1000:
            errors.append(f"Row {row_num}: Glucose value {val} out of physiological bounds")
            rows_skipped += 1
            continue

        if ts in seen_timestamps:
            # Duplicate timestamp within file
            rows_skipped += 1
            continue

        seen_timestamps.add(ts)
        sampled_values.append(val)
        parsed_candidates.append((row_num, ts, val))

    # Detect units: if explicit header has mmol/L OR if values look like mmol/L (all < 35.0)
    is_mmol = explicit_mmol
    if not is_mmol and sampled_values:
        max_val = max(sampled_values)
        avg_val = sum(sampled_values) / len(sampled_values)
        if max_val <= 33.3 and avg_val < 20.0:
            is_mmol = True

    units_detected = "mmol/L (converted to mg/dL)" if is_mmol else "mg/dL"

    def _to_key(dt_val: Any) -> Optional[str]:
        if dt_val is None:
            return None
        if isinstance(dt_val, str):
            parsed = _parse_timestamp(dt_val)
            if parsed:
                return parsed.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            return dt_val.strip()
        if isinstance(dt_val, datetime):
            if dt_val.tzinfo is not None:
                return dt_val.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            return dt_val.strftime("%Y-%m-%d %H:%M:%S")
        return str(dt_val)

    # Pre-fetch existing timestamps for this patient to prevent DB duplicates
    existing_readings = (
        db.query(GlucoseReading.ts)
        .filter(GlucoseReading.patient_id == patient.id)
        .all()
    )
    existing_ts_set: Set[str] = set()
    for r in existing_readings:
        k = _to_key(r[0])
        if k:
            existing_ts_set.add(k)

    # Insert accepted readings
    rows_accepted = 0
    readings_to_add: List[GlucoseReading] = []

    for row_num, ts, raw_val in parsed_candidates:
        ts_k = _to_key(ts)
        if ts_k in existing_ts_set:
            rows_skipped += 1
            continue

        final_mgdl = round(raw_val * 18.0182, 1) if is_mmol else round(raw_val, 1)

        readings_to_add.append(
            GlucoseReading(
                patient_id=patient.id,
                ts=ts,
                value_mgdl=final_mgdl,
                source="cgm_import",
            )
        )
        existing_ts_set.add(ts)
        rows_accepted += 1

    if readings_to_add:
        db.add_all(readings_to_add)
        db.commit()

    # Trigger alert evaluation and prediction reconciliation
    alerts_count = 0
    reconciled_count = 0
    if rows_accepted > 0:
        try:
            alerts = evaluate_and_sync_alerts(patient_id=patient.id, db=db)
            alerts_count = len(alerts)
        except Exception as e:
            errors.append(f"Alert evaluation note: {str(e)}")

        try:
            reconciled_count = reconcile_patient_predictions(patient_id=patient.id, db=db)
        except Exception as e:
            errors.append(f"Prediction reconciliation note: {str(e)}")

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="import_cgm",
        resource_type="glucose_readings",
        resource_id=f"accepted_{rows_accepted}",
        patient_id=patient.id,
    )

    msg = (
        f"CGM import complete: {rows_accepted} readings imported ({units_detected}), "
        f"{rows_skipped} skipped, {reconciled_count} predictions reconciled."
    )

    return CGMImportReport(
        patient_id=patient.id,
        rows_accepted=rows_accepted,
        rows_skipped=rows_skipped,
        errors=errors[:20],  # cap error strings
        units_detected=units_detected,
        alerts_evaluated=alerts_count,
        predictions_reconciled=reconciled_count,
        message=msg,
    )


@router.post("/wearables", response_model=WearableImportReport, status_code=status.HTTP_200_OK)
@router.post("/wearable", response_model=WearableImportReport, status_code=status.HTTP_200_OK)
async def import_wearables_data(
    file: UploadFile = File(...),
    patient_id: Optional[int] = Form(None),
    patient_id_query: Optional[int] = Query(None, alias="patient_id"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WearableImportReport:
    """
    Accepts CSV upload for daily steps and sleep hours.
    Stored per day and exposed as optional context features for display only.
    (Do not feed them into the ML twin model).
    """
    target_pid = patient_id or patient_id_query
    if target_pid is None:
        if current_user.role == "patient":
            patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
            if not patient:
                raise HTTPException(status_code=404, detail="Patient profile not found")
            target_pid = patient.id
        else:
            raise HTTPException(status_code=400, detail="patient_id is required")

    patient = verify_patient_access(target_pid, current_user, db)

    content_bytes = await file.read()
    try:
        text_content = content_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text_content = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text_content = content_bytes.decode("latin-1")

    reader = csv.reader(io.StringIO(text_content))
    rows = list(reader)

    if not rows:
        raise HTTPException(status_code=422, detail="Uploaded CSV file is empty")

    # Locate headers: date, steps, sleep
    date_col = -1
    steps_col = -1
    sleep_col = -1
    header_idx = -1

    for idx, row in enumerate(rows):
        cleaned = [c.strip().lower() for c in row]
        for c_idx, cell in enumerate(cleaned):
            if cell in ("date", "day", "timestamp", "time"):
                date_col = c_idx
            elif "step" in cell:
                steps_col = c_idx
            elif "sleep" in cell:
                sleep_col = c_idx

        if date_col != -1 and (steps_col != -1 or sleep_col != -1):
            header_idx = idx
            break

    if header_idx == -1:
        raise HTTPException(
            status_code=422,
            detail="Header must contain Date and at least Steps or Sleep Hours column.",
        )

    data_rows = rows[header_idx + 1 :]
    rows_accepted = 0
    rows_skipped = 0
    errors: List[str] = []

    for row_num, row in enumerate(data_rows, start=header_idx + 2):
        if not row or len(row) <= date_col:
            continue

        raw_date = row[date_col].strip()
        if not raw_date:
            rows_skipped += 1
            continue

        # Parse date to YYYY-MM-DD
        dt = _parse_timestamp(raw_date)
        if not dt:
            # Try YYYY-MM-DD simple regex
            match = re.search(r"\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b", raw_date)
            if match:
                date_str = match.group(1).replace("/", "-")
            else:
                errors.append(f"Row {row_num}: Invalid date '{raw_date}'")
                rows_skipped += 1
                continue
        else:
            date_str = dt.strftime("%Y-%m-%d")

        # Steps
        steps = 0
        if steps_col != -1 and len(row) > steps_col and row[steps_col].strip():
            try:
                steps = max(0, int(float(row[steps_col].strip().replace(",", ""))))
            except ValueError:
                errors.append(f"Row {row_num}: Invalid steps '{row[steps_col]}'")

        # Sleep hours
        sleep_hours = 0.0
        if sleep_col != -1 and len(row) > sleep_col and row[sleep_col].strip():
            try:
                sleep_hours = max(0.0, min(24.0, float(row[sleep_col].strip())))
            except ValueError:
                errors.append(f"Row {row_num}: Invalid sleep hours '{row[sleep_col]}'")

        # Upsert daily wearable record
        existing = (
            db.query(WearableDaily)
            .filter(
                WearableDaily.patient_id == patient.id,
                WearableDaily.date == date_str,
            )
            .first()
        )

        if existing:
            if steps > 0:
                existing.steps = steps
            if sleep_hours > 0.0:
                existing.sleep_hours = sleep_hours
        else:
            new_item = WearableDaily(
                patient_id=patient.id,
                date=date_str,
                steps=steps,
                sleep_hours=sleep_hours,
                source="csv_upload",
            )
            db.add(new_item)

        rows_accepted += 1

    db.commit()

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="import_wearables",
        resource_type="wearable_daily",
        resource_id=f"accepted_{rows_accepted}",
        patient_id=patient.id,
    )

    return WearableImportReport(
        patient_id=patient.id,
        rows_accepted=rows_accepted,
        rows_skipped=rows_skipped,
        errors=errors[:20],
        message=f"Wearables import complete: {rows_accepted} daily records stored/updated, {rows_skipped} skipped.",
    )


@router.get("/patients/{patient_id}/wearables", response_model=List[WearableDailyItem])
def get_patient_wearables(
    patient_id: int,
    limit: int = Query(30, ge=1, le=180),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[WearableDailyItem]:
    """Retrieve daily wearable records (steps, sleep) for twin display context only."""
    patient = verify_patient_access(patient_id, current_user, db)
    items = (
        db.query(WearableDaily)
        .filter(WearableDaily.patient_id == patient.id)
        .order_by(WearableDaily.date.desc())
        .limit(limit)
        .all()
    )
    return items
