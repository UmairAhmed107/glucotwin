"""
Twin what-if lifestyle simulation module.

Simulates carb reduction (0-50%) and post-meal activity (walk to 75th percentile activity).
Recomputes calories at 4 kcal/g carbs/protein and 9 kcal/g fat.
Evaluates 15-member ensemble gains, pessimistic gain (p10), and supported/not_supported label.
"""

import logging
from typing import Any, Dict, Optional
import numpy as np

logger = logging.getLogger("glucotwin.twin.whatif")

DEFAULT_MARGIN = 15.0  # mg/dL threshold for supported intervention from recommender


def evaluate_whatif(
    rec: Any,
    baseline_meal: Dict[str, Any],
    carb_reduction_pct: float = 0.0,
    post_meal_walk: bool = False,
    margin: float = DEFAULT_MARGIN,
) -> Dict[str, Any]:
    """
    Simulate what-if intervention on a baseline meal row.

    Returns:
        {
            "status": "evaluated" | "not_evaluated",
            "reason": str,
            "baseline": {"median": float, "p10": float, "p90": float, "min": float, "max": float},
            "intervention": {"median": float, "p10": float, "p90": float, "min": float, "max": float},
            "new_macros": {"carbs_g": float, "kcal": float, "post_act_60": float},
            "gains": {
                "per_member_gains": List[float],
                "median_gain": float,
                "mean_gain": float,
                "pessimistic_gain": float,
                "margin": float,
                "label": "supported" | "not_supported"
            }
        }
    """
    base_preds = rec._predict(baseline_meal)

    changes: Dict[str, Any] = {}
    if carb_reduction_pct > 0:
        mult_factor = 1.0 - (carb_reduction_pct / 100.0)
        changes["carbs_g"] = ("mult", mult_factor)

    if post_meal_walk:
        changes["post_act_60"] = ("to_p75", None)

    if not changes:
        # No intervention specified (identity comparison)
        new_meal = baseline_meal.copy()
        why = ""
    else:
        new_meal, why = rec._apply(baseline_meal, changes)

    if new_meal is None:
        return {
            "status": "not_evaluated",
            "reason": f"Intervention invalid: {why}",
            "baseline": {
                "median": round(float(np.median(base_preds)), 2),
                "p10": round(float(np.percentile(base_preds, 10)), 2),
                "p90": round(float(np.percentile(base_preds, 90)), 2),
                "min": round(float(np.min(base_preds)), 2),
                "max": round(float(np.max(base_preds)), 2),
            },
            "intervention": None,
            "new_macros": None,
            "gains": None,
        }

    interv_preds = rec._predict(new_meal)
    gains = base_preds - interv_preds
    pessimistic_gain = float(np.percentile(gains, 10))
    label = "supported" if pessimistic_gain >= margin else "not_supported"

    return {
        "status": "evaluated",
        "reason": "",
        "baseline": {
            "median": round(float(np.median(base_preds)), 2),
            "p10": round(float(np.percentile(base_preds, 10)), 2),
            "p90": round(float(np.percentile(base_preds, 90)), 2),
            "min": round(float(np.min(base_preds)), 2),
            "max": round(float(np.max(base_preds)), 2),
        },
        "intervention": {
            "median": round(float(np.median(interv_preds)), 2),
            "p10": round(float(np.percentile(interv_preds, 10)), 2),
            "p90": round(float(np.percentile(interv_preds, 90)), 2),
            "min": round(float(np.min(interv_preds)), 2),
            "max": round(float(np.max(interv_preds)), 2),
        },
        "new_macros": {
            "carbs_g": round(float(new_meal["carbs_g"]), 2),
            "kcal": round(float(new_meal["kcal"]), 1),
            "post_act_60": round(float(new_meal["post_act_60"]), 2),
        },
        "gains": {
            "per_member_gains": [round(float(g), 2) for g in gains],
            "median_gain": round(float(np.median(gains)), 2),
            "mean_gain": round(float(np.mean(gains)), 2),
            "pessimistic_gain": round(pessimistic_gain, 2),
            "margin": margin,
            "label": label,
        },
    }
