"""
Twin what-if lifestyle simulation module.

Simulates:
- Carb reduction (0-50%)
- Post-meal activity / walk (intensity: none, light, moderate, brisk; duration: 0-60 min)
- Meal timing shift (-4.0h to +4.0h)
- Meal order / food sequencing (standard, veggies_first, protein_first, veggies_protein_first)

Where the 15-model bootstrap ensemble cannot natively take a lever as an input,
it is implemented as a documented, physiologically bounded post-hoc adjustment
and flagged with is_estimated_adjustment=True in the response for honest UI presentation.
"""

import logging
from typing import Any, Dict, List, Optional
import numpy as np

logger = logging.getLogger("glucotwin.twin.whatif")

DEFAULT_MARGIN = 15.0  # mg/dL threshold for supported intervention from recommender

VALID_MEAL_ORDERS = {"standard", "veggies_first", "protein_first", "veggies_protein_first"}
VALID_WALK_INTENSITIES = {"none", "light", "moderate", "brisk"}


def evaluate_whatif(
    rec: Any,
    baseline_meal: Dict[str, Any],
    carb_reduction_pct: float = 0.0,
    post_meal_walk: bool = False,
    margin: float = DEFAULT_MARGIN,
    meal_order: str = "standard",
    walk_duration_min: float = 0.0,
    walk_intensity: str = "none",
    timing_shift_hours: float = 0.0,
) -> Dict[str, Any]:
    """
    Simulate what-if intervention on a baseline meal row.

    Args:
        rec: MealRecommender instance.
        baseline_meal: Feature dict of the baseline meal (20 features).
        carb_reduction_pct: Percentage carb cut (0.0 to 50.0).
        post_meal_walk: Legacy boolean flag; if True and walk_duration_min == 0, defaults to 15 min moderate walk.
        margin: Supported threshold in mg/dL.
        meal_order: "standard" | "veggies_first" | "protein_first" | "veggies_protein_first".
        walk_duration_min: Duration in minutes (0.0 to 60.0).
        walk_intensity: "none" | "light" | "moderate" | "brisk".
        timing_shift_hours: Shift in hours (-4.0 to +4.0).

    Returns:
        Structured evaluation dict with baseline, intervention, gains, new_macros,
        adjustments list, and is_estimated_adjustment flag.
    """
    # 1. Validate lever bounds
    if carb_reduction_pct < 0.0 or carb_reduction_pct > 50.0:
        raise ValueError(f"carb_reduction_pct must be between 0.0 and 50.0, got {carb_reduction_pct}")
    if walk_duration_min < 0.0 or walk_duration_min > 60.0:
        raise ValueError(f"walk_duration_min must be between 0.0 and 60.0, got {walk_duration_min}")
    if timing_shift_hours < -4.0 or timing_shift_hours > 4.0:
        raise ValueError(f"timing_shift_hours must be between -4.0 and 4.0, got {timing_shift_hours}")
    if meal_order not in VALID_MEAL_ORDERS:
        raise ValueError(f"Invalid meal_order '{meal_order}'. Must be one of {sorted(VALID_MEAL_ORDERS)}")
    if walk_intensity not in VALID_WALK_INTENSITIES:
        raise ValueError(f"Invalid walk_intensity '{walk_intensity}'. Must be one of {sorted(VALID_WALK_INTENSITIES)}")

    base_preds = rec._predict(baseline_meal)

    # Resolve walk parameters (supporting legacy post_meal_walk=True)
    effective_walk_dur = float(walk_duration_min)
    effective_walk_int = walk_intensity
    if post_meal_walk and effective_walk_dur == 0.0 and effective_walk_int == "none":
        effective_walk_dur = 15.0
        effective_walk_int = "moderate"
    elif effective_walk_dur > 0.0 and effective_walk_int == "none":
        effective_walk_int = "moderate"

    # 2. Native model transformations via changes dictionary
    changes: Dict[str, Any] = {}
    if carb_reduction_pct > 0.0:
        mult_factor = 1.0 - (carb_reduction_pct / 100.0)
        changes["carbs_g"] = ("mult", mult_factor)

    # Native walk representation on post_act_60
    if effective_walk_dur > 0.0 and effective_walk_int != "none":
        p75 = float(rec.p75_act)
        hi_act = float(rec.hi["post_act_60"])
        old_act = float(baseline_meal.get("post_act_60", 109.67))

        if effective_walk_int == "light":
            scaled_act = max(old_act, p75 * min(1.0, 0.70 + (effective_walk_dur / 60.0) * 0.30))
        elif effective_walk_int == "moderate":
            scaled_act = max(old_act, p75 * min(1.20, 0.90 + (effective_walk_dur / 30.0) * 0.20))
        else:  # brisk
            scaled_act = max(old_act, min(hi_act, p75 * (1.10 + (effective_walk_dur / 30.0) * 0.25)))

        # Ensure within data bounds
        scaled_act = min(hi_act, max(float(rec.lo["post_act_60"]), scaled_act))
        changes["post_act_60"] = ("add", scaled_act - old_act)

    if not changes:
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
            "adjustments": [],
            "is_estimated_adjustment": False,
        }

    # 3. Native meal timing shift on circadian features
    base_h = float(baseline_meal.get("time_of_day", 12.0))
    # If time_of_day is not directly in baseline_meal, derive it from hour_sin / hour_cos
    if "time_of_day" not in baseline_meal and "hour_sin" in baseline_meal and "hour_cos" in baseline_meal:
        rad = np.arctan2(float(baseline_meal["hour_sin"]), float(baseline_meal["hour_cos"]))
        if rad < 0:
            rad += 2.0 * np.pi
        base_h = float((rad * 24.0) / (2.0 * np.pi))

    shifted_h = (base_h + timing_shift_hours) % 24.0
    if timing_shift_hours != 0.0:
        new_meal["hour_sin"] = float(np.sin(2.0 * np.pi * shifted_h / 24.0))
        new_meal["hour_cos"] = float(np.cos(2.0 * np.pi * shifted_h / 24.0))
        new_meal["is_breakfast"] = 1.0 if (4.0 <= shifted_h < 11.0) else 0.0
        new_meal["is_lunch"] = 1.0 if (11.0 <= shifted_h < 16.0) else 0.0
        new_meal["is_dinner"] = 1.0 if (16.0 <= shifted_h < 22.0) else 0.0
        new_meal["is_snack"] = 1.0 if (shifted_h < 4.0 or shifted_h >= 22.0) else 0.0
        new_meal["time_of_day"] = shifted_h

    # 4. Predict raw intervention response from the 15-model ensemble
    raw_interv_preds = rec._predict(new_meal)
    unadjusted_median = float(np.median(raw_interv_preds))

    # 5. Documented, bounded post-hoc adjustments for non-native levers
    adjustments: List[Dict[str, Any]] = []

    # Lever A: Meal Order (Vegetables/Protein First)
    # Evidence: Shukla et al. (Diabetes Care 2015, 2017), Trico et al. (Diabetologia 2016)
    order_adj_pct = 0.0
    if meal_order == "veggies_first":
        order_adj_pct = -18.0
        adjustments.append({
            "lever": "meal_order",
            "name": "Food Sequencing: Vegetables First",
            "adjustment_pct": order_adj_pct,
            "applied_delta_mgdl": round(unadjusted_median * (order_adj_pct / 100.0), 2),
            "description": "Pre-meal fiber slows gastric emptying via incretin (GLP-1) release, flattening postprandial glucose absorption.",
            "citation": "Shukla et al., Diabetes Care 2017 (PMID: 28830947)",
        })
    elif meal_order == "protein_first":
        order_adj_pct = -12.0
        adjustments.append({
            "lever": "meal_order",
            "name": "Food Sequencing: Protein First",
            "adjustment_pct": order_adj_pct,
            "applied_delta_mgdl": round(unadjusted_median * (order_adj_pct / 100.0), 2),
            "description": "Pre-meal protein stimulates early phase insulin secretion and slows stomach emptying.",
            "citation": "Trico et al., Diabetologia 2016 (PMID: 27154244)",
        })
    elif meal_order == "veggies_protein_first":
        order_adj_pct = -24.0
        adjustments.append({
            "lever": "meal_order",
            "name": "Food Sequencing: Veggies & Protein First",
            "adjustment_pct": order_adj_pct,
            "applied_delta_mgdl": round(unadjusted_median * (order_adj_pct / 100.0), 2),
            "description": "Sequential consumption of fiber and protein before carbohydrates significantly suppresses 2-hour glucose excursion.",
            "citation": "Shukla et al., Diabetes Care 2015 (PMID: 26106234)",
        })

    # Lever B: Extended Walk Intensity & Duration beyond standard native 60m counts
    # Evidence: Reynolds et al. (Diabetologia 2016), Borror et al. (Sports Med 2018)
    walk_adj_pct = 0.0
    if effective_walk_dur > 0.0 and effective_walk_int != "none":
        if effective_walk_int == "brisk":
            # Brisk exercise promotes enhanced non-insulin mediated GLUT4 translocation
            walk_adj_pct = -8.0 - (0.20 * max(0.0, effective_walk_dur - 15.0))
            walk_adj_pct = max(-18.0, walk_adj_pct)  # bounded cap
            adjustments.append({
                "lever": "walk_intensity_duration",
                "name": f"Brisk Ambulation ({int(effective_walk_dur)} min)",
                "adjustment_pct": round(walk_adj_pct, 1),
                "applied_delta_mgdl": round(unadjusted_median * (walk_adj_pct / 100.0), 2),
                "description": "Brisk post-meal ambulation induces vigorous muscular GLUT4 translocation, enhancing non-insulin glucose disposal.",
                "citation": "Borror et al., Sports Med 2018 (PMID: 29470825)",
            })
        elif effective_walk_int == "moderate" and effective_walk_dur > 20.0:
            walk_adj_pct = -0.25 * (effective_walk_dur - 20.0)
            walk_adj_pct = max(-10.0, walk_adj_pct)
            adjustments.append({
                "lever": "walk_intensity_duration",
                "name": f"Extended Moderate Walk ({int(effective_walk_dur)} min)",
                "adjustment_pct": round(walk_adj_pct, 1),
                "applied_delta_mgdl": round(unadjusted_median * (walk_adj_pct / 100.0), 2),
                "description": "Sustained moderate ambulation extends metabolic clearance beyond the immediate post-meal period.",
                "citation": "Reynolds et al., Diabetologia 2016 (PMID: 27747394)",
            })
        elif effective_walk_int == "light" and effective_walk_dur > 30.0:
            walk_adj_pct = -0.10 * (effective_walk_dur - 30.0)
            walk_adj_pct = max(-5.0, walk_adj_pct)
            adjustments.append({
                "lever": "walk_intensity_duration",
                "name": f"Prolonged Light Walk ({int(effective_walk_dur)} min)",
                "adjustment_pct": round(walk_adj_pct, 1),
                "applied_delta_mgdl": round(unadjusted_median * (walk_adj_pct / 100.0), 2),
                "description": "Prolonged light activity prevents postprandial sedentary stagnation.",
                "citation": "Buffey et al., Sports Med 2022 (PMID: 35147903)",
            })

    # Lever C: Circadian Vulnerability Timing Shift
    # Evidence: Scheer et al. (PNAS 2009), Gu et al. (JCEM 2020)
    timing_adj_pct = 0.0
    if timing_shift_hours != 0.0:
        if (shifted_h >= 21.0 or shifted_h < 6.0) and not (base_h >= 21.0 or base_h < 6.0):
            # Shifted into nocturnal circadian vulnerability window
            timing_adj_pct = 10.0
            adjustments.append({
                "lever": "meal_timing_shift",
                "name": "Late Evening Circadian Penalty",
                "adjustment_pct": timing_adj_pct,
                "applied_delta_mgdl": round(unadjusted_median * (timing_adj_pct / 100.0), 2),
                "description": "Nocturnal melatonin levels blunt beta-cell insulin response, worsening postprandial glucose clearance.",
                "citation": "Gu et al., J Clin Endocrinol Metab 2020 (PMID: 32525527)",
            })
        elif (base_h >= 20.0 or base_h < 6.0) and (17.0 <= shifted_h < 20.0):
            # Shifted earlier out of late-night window into optimal evening
            timing_adj_pct = -6.0
            adjustments.append({
                "lever": "meal_timing_shift",
                "name": "Circadian Realignment (Early Dinner)",
                "adjustment_pct": timing_adj_pct,
                "applied_delta_mgdl": round(unadjusted_median * (timing_adj_pct / 100.0), 2),
                "description": "Consuming dinner earlier aligns carbohydrate intake with peak biological insulin sensitivity.",
                "citation": "Bandín et al., Int J Obes 2015 (PMID: 25236177)",
            })

    # Combined post-hoc factor
    total_mult = (1.0 + order_adj_pct / 100.0) * (1.0 + walk_adj_pct / 100.0) * (1.0 + timing_adj_pct / 100.0)
    # Physiological bounding clamps: cannot reduce peak rise by more than 60% or increase by > 50%
    total_mult = float(np.clip(total_mult, 0.40, 1.50))

    # Apply multiplier to all 15 bootstrap predictions, preserving ensemble variance
    interv_preds = raw_interv_preds * total_mult
    # Physiological floor: glucose spike cannot fall below 5.0 mg/dL
    interv_preds = np.maximum(5.0, interv_preds)

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
        "adjustments": adjustments,
        "is_estimated_adjustment": len(adjustments) > 0,
    }
