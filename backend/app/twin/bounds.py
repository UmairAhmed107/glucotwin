"""
Twin bounds guard module.

Validates input features against the recommender's [lo, hi] boundaries (5th-95th quantiles).
If any feature is outside, returns a structured out_of_range result without predicting.
"""

import logging
from typing import Any, Dict, List, Optional
import pandas as pd

logger = logging.getLogger("glucotwin.twin.bounds")

# Primary user-modifiable meal and glucose features subject to training distribution guard
DEFAULT_CHECK_FEATURES = [
    "carbs_g",
    "protein_g",
    "fat_g",
    "fiber_g",
    "kcal",
    "pre_glucose",
    "pre_trend30",
]


def check_bounds(
    features: Dict[str, Any],
    lo: pd.Series,
    hi: pd.Series,
    features_to_check: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Check if features fall strictly within [lo, hi] bounds.

    Returns:
        {
            "is_valid": bool,
            "status": "ok" | "out_of_range",
            "offending_features": [
                {
                    "feature": str,
                    "value": float,
                    "allowed_range": [float, float],
                    "message": str
                }, ...
            ]
        }
    """
    cols = features_to_check or DEFAULT_CHECK_FEATURES
    offending: List[Dict[str, Any]] = []

    for col in cols:
        if col in features and col in lo.index and col in hi.index:
            try:
                val = float(features[col])
                min_val = float(lo[col])
                max_val = float(hi[col])

                # Check boundary with small epsilon for floating-point comparison
                if val < min_val - 1e-6 or val > max_val + 1e-6:
                    offending.append({
                        "feature": col,
                        "value": round(val, 2),
                        "allowed_range": [round(min_val, 2), round(max_val, 2)],
                        "message": (
                            f"Feature '{col}'={round(val, 2)} is outside allowed "
                            f"training range [{round(min_val, 2)}, {round(max_val, 2)}]."
                        ),
                    })
            except (ValueError, TypeError) as e:
                logger.warning(f"Error parsing feature {col} value {features[col]}: {e}")

    if offending:
        return {
            "is_valid": False,
            "status": "out_of_range",
            "offending_features": offending,
        }

    return {
        "is_valid": True,
        "status": "ok",
        "offending_features": [],
    }
