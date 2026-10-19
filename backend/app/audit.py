import hashlib
import json
from datetime import datetime, timezone
from typing import Any, List, Optional
from sqlalchemy.orm import Session
from app.models_db import AuditLog


def hash_inputs(inputs: Any) -> str:
    """Compute deterministic SHA-256 hash of inputs."""
    try:
        serialized = json.dumps(inputs, sort_keys=True, default=str)
    except Exception:
        serialized = str(inputs)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def log_audit(
    db: Session,
    patient_id: Optional[int],
    endpoint: str,
    inputs: Any = None,
    inputs_hash: Optional[str] = None,
    model_version: Optional[str] = None,
    rules_triggered: Optional[List[str]] = None,
    gemini_used: bool = False,
    gemini_model: Optional[str] = None,
) -> AuditLog:
    """Log an audit entry with hashed inputs to the audit_log table."""
    final_hash = inputs_hash or hash_inputs(inputs)
    audit_entry = AuditLog(
        patient_id=patient_id,
        ts=datetime.now(timezone.utc),
        endpoint=endpoint,
        inputs_hash=final_hash,
        model_version=model_version,
        rules_triggered=rules_triggered or [],
        gemini_model=gemini_model,
        gemini_used=gemini_used,
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry


# Alias for compatibility
log_audit_event = log_audit
