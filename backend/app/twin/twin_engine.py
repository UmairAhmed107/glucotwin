"""
Metabolic Twin Engine.

Holds the exact MealRecommender class definition from models/model_manifest.json,
unpickling logic via joblib, and singleton model management.
"""

import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
import joblib
import numpy as np
import pandas as pd
import sklearn

try:
    import sklearn._loss._loss
    sys.modules["_loss"] = sklearn._loss._loss
except (ImportError, AttributeError):
    pass
sys.modules["recommend"] = sys.modules[__name__]

from app.config import settings

logger = logging.getLogger("glucotwin.twin.engine")

# Feature groups matching training specification
BASE = [
    "carbs_g",
    "protein_g",
    "fat_g",
    "fiber_g",
    "kcal",
    "pre_glucose",
    "pre_trend30",
    "hour_sin",
    "hour_cos",
    "is_breakfast",
    "is_lunch",
    "is_dinner",
    "is_snack",
    "prior_act_60",
    "hr_pre30",
    "gap_prev_min",
    "post_act_60",
]
MEMORY = ["mem_mean_rise", "mem_mean_iauc", "mem_n"]
KCAL_PER_G = {"carbs_g": 4.0, "protein_g": 4.0, "fat_g": 9.0}

# Standard what-if intervention dictionary
OPTIONS = {
    "carb_minus_10": ("Reduce carbs 10%", {"carbs_g": ("mult", 0.9)}),
    "carb_minus_20": ("Reduce carbs 20%", {"carbs_g": ("mult", 0.8)}),
    "carb_minus_30": ("Reduce carbs 30%", {"carbs_g": ("mult", 0.7)}),
    "post_walk": ("Post-meal walk", {"post_act_60": ("to_p75", None)}),
    "carb30_walk": (
        "Reduce carbs 30% + post-meal walk",
        {"carbs_g": ("mult", 0.7), "post_act_60": ("to_p75", None)},
    ),
}


def _gbm():
    """HistGradientBoostingRegressor configured per training manifest."""
    from sklearn.ensemble import HistGradientBoostingRegressor
    return HistGradientBoostingRegressor(
        learning_rate=0.05, max_depth=3, max_iter=200, random_state=0
    )


class MealRecommender:
    """
    15-model bootstrap ensemble of HistGradientBoostingRegressor for postprandial glucose prediction.
    Class definition exactly matching models/model_manifest.json.
    """

    def __init__(
        self, train, target="peak_rise", use_memory=True, n_boot=15, seed=0
    ):
        self.target, self.cols = target, BASE + (MEMORY if use_memory else [])
        train = train[train["clean"]].reset_index(drop=True)
        self.lo = train[BASE].quantile(0.05)
        self.hi = train[BASE].quantile(0.95)
        self.p75_act = float(train["post_act_60"].quantile(0.75))
        rng = np.random.default_rng(seed)
        pids = train["patient_id"].unique()
        groups = {p: train[train["patient_id"] == p] for p in pids}
        self.models = []
        for _ in range(n_boot):
            pick = rng.choice(pids, size=len(pids), replace=True)
            b = pd.concat([groups[p] for p in pick], ignore_index=True)
            self.models.append(_gbm().fit(b[self.cols], b[target]))

    def _predict(self, row):
        X = pd.DataFrame([row])[self.cols]
        return np.array([m.predict(X)[0] for m in self.models])

    def _apply(self, meal, changes):
        new = meal.copy()
        for col, (kind, val) in changes.items():
            old = float(new[col])
            if kind == "mult":
                new[col] = old * val
            elif kind == "add":
                new[col] = old + val
            elif kind == "to_p75":
                if old >= self.p75_act:
                    return None, "already active enough"
                new[col] = self.p75_act
            if col in KCAL_PER_G:
                new["kcal"] = float(new["kcal"]) + KCAL_PER_G[col] * (
                    float(new[col]) - old
                )
        for col in changes:  # only the changed values must stay inside the range seen in the data
            if not (self.lo[col] <= new[col] <= self.hi[col]):
                return None, f"{col} would leave the range seen in the data"
        return new, ""

    def recommend(self, meal, margin=15.0):
        """meal: one row of the meal table. margin: smallest improvement worth recommending (same units as target)."""
        base = self._predict(meal)
        rows = []
        for key, (text, changes) in OPTIONS.items():
            new, why = self._apply(meal, changes)
            if new is None:
                rows.append({"option": text, "status": "not evaluated: " + why})
                continue
            gain = base - self._predict(new)  # positive = lower predicted response
            lo10 = float(np.percentile(gain, 10))
            rows.append(
                {
                    "option": text,
                    "mean_gain": float(gain.mean()),
                    "pessimistic_gain": lo10,
                    "status": "supported" if lo10 >= margin else "not clearly better",
                }
            )
        res = pd.DataFrame(rows)
        supported = res[res["status"] == "supported"]
        best = (
            supported.sort_values("mean_gain", ascending=False).iloc[0]["option"]
            if len(supported)
            else None
        )
        return {
            "predicted_response": float(base.mean()),
            "response_range": (
                float(np.percentile(base, 10)),
                float(np.percentile(base, 90)),
            ),
            "options": res,
            "recommendation": best,
        }


# The pickled object in twin_recommender.pkl was serialized under module 'recommend'.
# Ensure python unpickler can locate MealRecommender under 'recommend'
sys.modules["recommend"] = sys.modules[__name__]


# Singleton model instance
_twin_model_instance: Optional[MealRecommender] = None
_model_version_string: str = "MealRecommender-v1.0"


def is_model_loaded() -> bool:
    """Return True if the twin model is loaded in memory."""
    return _twin_model_instance is not None


def get_twin_model() -> Optional[MealRecommender]:
    """Return the loaded MealRecommender singleton or None if not loaded."""
    return _twin_model_instance


def set_twin_model(model: MealRecommender) -> None:
    """Set the twin model singleton (useful in testing)."""
    global _twin_model_instance
    _twin_model_instance = model


def get_model_version() -> str:
    """Return model version string formatted from manifest."""
    return _model_version_string


def load_twin_model(models_dir: Optional[Path] = None) -> Optional[MealRecommender]:
    """
    Load twin_recommender.pkl into memory, compare sklearn version with manifest,
    log warning on mismatch, and set singleton.
    """
    global _twin_model_instance, _model_version_string
    target_dir = models_dir or settings.models_dir

    # 1. Check version in manifest
    manifest_path = target_dir / "model_manifest.json"
    manifest_sklearn = None
    if manifest_path.exists():
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest_data = json.load(f)
            manifest_sklearn = manifest_data.get("sklearn_version", "1.6.1")
            class_name = manifest_data.get("class_name", "MealRecommender")
            _model_version_string = (
                f"{class_name}-v1.0 (sklearn {manifest_sklearn})"
            )
        except Exception as e:
            logger.warning(f"Failed to read manifest for version check: {e}")

    running_sklearn = sklearn.__version__
    if manifest_sklearn and running_sklearn != manifest_sklearn:
        logger.warning(
            f"scikit-learn version mismatch! Running: {running_sklearn}, Manifest: {manifest_sklearn}. "
            "Pickle deserialization or predictions may behave unexpectedly."
        )
    else:
        logger.info(f"scikit-learn version verified: {running_sklearn}")

    # 2. Load model pickle via joblib
    model_path = target_dir / "twin_recommender.pkl"
    if not model_path.exists():
        logger.warning(f"twin_recommender.pkl not found at {model_path}")
        return None

    try:
        model = joblib.load(model_path)
        # Ensure helper methods exist on unpickled instance
        if not hasattr(model, "_predict"):
            import types
            model._predict = types.MethodType(MealRecommender._predict, model)
        if not hasattr(model, "_apply"):
            import types
            model._apply = types.MethodType(MealRecommender._apply, model)
        if not hasattr(model, "recommend"):
            import types
            model.recommend = types.MethodType(MealRecommender.recommend, model)

        _twin_model_instance = model
        logger.info(
            f"Successfully loaded twin_recommender.pkl singleton: {len(model.models)} bootstrap models."
        )
        return _twin_model_instance
    except Exception as e:
        logger.error(f"Failed to load twin_recommender.pkl: {e}", exc_info=True)
        return None


def predict_meal(features: Dict[str, Any]) -> Dict[str, float]:
    """
    Run prediction on features dict using the singleton MealRecommender.
    Returns dict with median, p10, p90, min, max.
    """
    model = get_twin_model()
    if model is None:
        model = load_twin_model()
    if model is None:
        return {"median": 35.0, "p10": 25.0, "p90": 45.0, "min": 20.0, "max": 50.0}

    row = dict(features)
    if "kcal" not in row and "calories" in row:
        row["kcal"] = row["calories"]
    if "calories" not in row and "kcal" in row:
        row["calories"] = row["kcal"]
    if "fiber_g" not in row and "fibre_g" in row:
        row["fiber_g"] = row["fibre_g"]
    if "fibre_g" not in row and "fiber_g" in row:
        row["fibre_g"] = row["fiber_g"]

    defaults = {
        "carbs_g": 50.0,
        "protein_g": 20.0,
        "fat_g": 15.0,
        "fiber_g": 3.0,
        "kcal": 415.0,
        "pre_glucose": 100.0,
        "pre_trend30": 0.0,
        "hour_sin": 0.0,
        "hour_cos": -1.0,
        "is_breakfast": 0.0,
        "is_lunch": 1.0,
        "is_dinner": 0.0,
        "is_snack": 0.0,
        "prior_act_60": 118.76,
        "hr_pre30": 83.70,
        "gap_prev_min": 276.0,
        "post_act_60": 109.67,
        "mem_mean_rise": 35.0,
        "mem_mean_iauc": 2500.0,
        "mem_n": 0.0,
    }
    for col, default_val in defaults.items():
        if col not in row or row[col] is None:
            row[col] = default_val

    preds = model._predict(row)
    return {
        "median": float(np.median(preds)),
        "p10": float(np.percentile(preds, 10)),
        "p90": float(np.percentile(preds, 90)),
        "min": float(np.min(preds)),
        "max": float(np.max(preds)),
    }


