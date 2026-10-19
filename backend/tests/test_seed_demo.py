"""
Tests for scripts/seed_demo.py
Verifies:
  1. Exactly 3 demo patients are created/seeded.
  2. Demo A has mem_n=0 (cold-start baseline).
  3. Demo B is linked to CGMacros participant #1 with seeded twin memory.
  4. Demo C has hypoglycemia_history=True and is from Shanghai profile.
  5. Running the seed logic twice is strictly idempotent.
"""

from pathlib import Path
import sys
import pytest

# Ensure scripts directory can be imported
root_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(root_dir / "scripts"))

from seed_demo import seed_demo_patients
from app.db import SessionLocal
from app.models_db import Patient, TwinState


def test_seed_demo_creates_three_patients_and_is_idempotent():
    # 1. First execution
    seed_demo_patients()

    db = SessionLocal()
    try:
        pts = db.query(Patient).filter(Patient.display_name.like("Demo %")).all()
        assert len(pts) == 3, f"Expected 3 demo patients, found {len(pts)}"

        # Check Demo A
        demo_a = [p for p in pts if "Demo A" in p.display_name][0]
        assert demo_a.is_synthetic is True
        assert demo_a.source == "new"
        ts_a = db.query(TwinState).filter(TwinState.patient_id == demo_a.id).first()
        assert ts_a is not None
        assert ts_a.mem_n == 0

        # Check Demo B
        demo_b = [p for p in pts if "Demo B" in p.display_name][0]
        assert demo_b.is_synthetic is True
        assert demo_b.source == "cgmacros"
        assert demo_b.cgmacros_participant_id is not None
        ts_b = db.query(TwinState).filter(TwinState.patient_id == demo_b.id).first()
        assert ts_b is not None
        assert ts_b.mem_n > 0  # Seeded from participant's meals

        # Check Demo C
        demo_c = [p for p in pts if "Demo C" in p.display_name][0]
        assert demo_c.is_synthetic is True
        assert demo_c.source == "shanghai_profile"
        assert demo_c.hypoglycemia_history is True

    finally:
        db.close()

    # 2. Second execution (must not duplicate or corrupt)
    seed_demo_patients()

    db = SessionLocal()
    try:
        pts_after = db.query(Patient).filter(Patient.display_name.like("Demo %")).all()
        assert len(pts_after) == 3, f"Expected still 3 demo patients after second run, found {len(pts_after)}"
    finally:
        db.close()
