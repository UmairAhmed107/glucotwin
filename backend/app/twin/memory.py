"""
Twin memory calculation and state recomputation module.

Computes running means mem_mean_rise, mem_mean_iauc, and count mem_n
from prior observed meals (excluding current meal), falling back to population
baseline when mem_n == 0, and seeding from CGMacros participant meals if linked.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional
import numpy as np
from sqlalchemy.orm import Session

from app.data_loader import data_loader
from app.models_db import MealEntry, Patient, TwinState

logger = logging.getLogger("glucotwin.twin.memory")

# Fallback population baseline means (from meals_db.pkl)
POP_MEAN_RISE_FALLBACK = 44.13
POP_MEAN_IAUC_FALLBACK = 46.75


def get_population_baseline() -> Dict[str, float]:
    """Retrieve population means computed from meals_db if available, else defaults."""
    if data_loader.meals_df is not None:
        rise_mean = data_loader.meals_df["peak_rise"].dropna().mean()
        iauc_mean = data_loader.meals_df["iauc_2h"].dropna().mean()
        return {
            "pop_mean_rise": float(rise_mean),
            "pop_mean_iauc": float(iauc_mean),
        }
    return {
        "pop_mean_rise": POP_MEAN_RISE_FALLBACK,
        "pop_mean_iauc": POP_MEAN_IAUC_FALLBACK,
    }


def compute_confidence_score(
    mem_n: int, band_width: Optional[float] = None
) -> Dict[str, Any]:
    """
    Confidence score formula:
    0.6 * (1 - exp(-mem_n/5)) + 0.4 * (1 - normalised_band_width), clipped to [0, 1].
    Normalised band width scales by nominal 30.0 mg/dL spread (clipped [0, 1]).
    If band_width is not provided, defaults to 0.5 (medium spread).
    """
    comp_memory = 1.0 - float(np.exp(-mem_n / 5.0))

    if band_width is not None and band_width >= 0:
        norm_band = float(np.clip(band_width / 30.0, 0.0, 1.0))
    else:
        norm_band = 0.5

    comp_spread = 1.0 - norm_band
    score = float(np.clip(0.6 * comp_memory + 0.4 * comp_spread, 0.0, 1.0))

    return {
        "confidence_score": round(score, 3),
        "components": {
            "memory_component": round(comp_memory, 3),
            "spread_component": round(comp_spread, 3),
            "normalised_band_width": round(norm_band, 3),
            "mem_n": mem_n,
            "formula": "0.6 * (1 - exp(-mem_n/5)) + 0.4 * (1 - normalised_band_width)",
        },
    }


def compute_memory(
    patient_id: int,
    db: Session,
    before_time: Optional[datetime] = None,
    exclude_meal_id: Optional[int] = None,
    band_width: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Compute running memory for a patient from prior observed meals.
    - Excludes the current meal (via before_time or exclude_meal_id)
    - If linked to CGMacros, seeds from participant's meals in meals_db
    - If mem_n == 0, falls back to population baseline with baseline_used=True
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        pop = get_population_baseline()
        conf = compute_confidence_score(0, band_width)
        return {
            "mem_mean_rise": pop["pop_mean_rise"],
            "mem_mean_iauc": pop["pop_mean_iauc"],
            "mem_n": 0,
            "confidence_score": conf["confidence_score"],
            "confidence_components": conf["components"],
            "baseline_used": True,
        }

    seeded_rises: list[float] = []
    seeded_iaucs: list[float] = []

    # 1. Seed from CGMacros participant meals if linked
    if patient.cgmacros_participant_id is not None and data_loader.meals_df is not None:
        sub = data_loader.meals_df[
            data_loader.meals_df["patient_id"] == patient.cgmacros_participant_id
        ]
        valid_sub = sub.dropna(subset=["peak_rise", "iauc_2h"])
        seeded_rises = [float(x) for x in valid_sub["peak_rise"].tolist()]
        seeded_iaucs = [float(x) for x in valid_sub["iauc_2h"].tolist()]

    # 2. Get user-logged prior meals with observed outcomes
    query = db.query(MealEntry).filter(
        MealEntry.patient_id == patient_id,
        MealEntry.observed_peak_rise.isnot(None),
        MealEntry.observed_iauc_2h.isnot(None),
    )
    if exclude_meal_id is not None:
        query = query.filter(MealEntry.id != exclude_meal_id)
    if before_time is not None:
        query = query.filter(MealEntry.logged_at < before_time)

    logged_meals = query.all()
    logged_rises = [float(m.observed_peak_rise) for m in logged_meals]
    logged_iaucs = [float(m.observed_iauc_2h) for m in logged_meals]

    all_rises = seeded_rises + logged_rises
    all_iaucs = seeded_iaucs + logged_iaucs
    mem_n = len(all_rises)

    if mem_n > 0:
        mem_mean_rise = float(np.mean(all_rises))
        mem_mean_iauc = float(np.mean(all_iaucs))
        baseline_used = False
    else:
        pop = get_population_baseline()
        mem_mean_rise = pop["pop_mean_rise"]
        mem_mean_iauc = pop["pop_mean_iauc"]
        baseline_used = True

    conf = compute_confidence_score(mem_n, band_width)

    return {
        "mem_mean_rise": round(mem_mean_rise, 2),
        "mem_mean_iauc": round(mem_mean_iauc, 2),
        "mem_n": mem_n,
        "confidence_score": conf["confidence_score"],
        "confidence_components": conf["components"],
        "baseline_used": baseline_used,
    }


def recompute_twin_state(
    patient_id: int, db: Optional[Session] = None
) -> Optional[TwinState]:
    """
    Recompute and persist current twin_state for patient_id.
    Called on patient creation and after logging meals.
    """
    if db is None:
        logger.warning("recompute_twin_state called without db session.")
        return None

    mem = compute_memory(patient_id=patient_id, db=db)

    twin_state = db.query(TwinState).filter(TwinState.patient_id == patient_id).first()
    if not twin_state:
        twin_state = TwinState(
            patient_id=patient_id,
            mem_mean_rise=mem["mem_mean_rise"],
            mem_mean_iauc=mem["mem_mean_iauc"],
            mem_n=mem["mem_n"],
            confidence_score=mem["confidence_score"],
            updated_at=datetime.now(timezone.utc),
        )
        db.add(twin_state)
    else:
        twin_state.mem_mean_rise = mem["mem_mean_rise"]
        twin_state.mem_mean_iauc = mem["mem_mean_iauc"]
        twin_state.mem_n = mem["mem_n"]
        twin_state.confidence_score = mem["confidence_score"]
        twin_state.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(twin_state)
    return twin_state
