"""
CGM Sensor Replay Router.

Streams continuous glucose monitor data from recorded clinical trial time series.
Enforces:
- 503 SERVICE_UNAVAILABLE when REPLAY_DATA_PATH is not configured or missing
- POST /replay/{participant_id}/start (initialises playback session)
- GET /replay/{participant_id}/stream (Server-Sent Events text/event-stream)
- Replay speed control (1x, 10x, 60x)
- Meal event detection with metabolic twin predicted response
"""

import asyncio
import json
import logging
import math
from typing import Any, AsyncGenerator, Dict, List, Optional
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.errors import AppException, ServiceUnavailableException
from app.twin.memory import get_population_baseline
from app.twin.twin_engine import get_twin_model, predict_meal

logger = logging.getLogger("glucotwin.routers.replay")

router = APIRouter(prefix="/replay", tags=["CGM Replay"])


class ReplayStartRequest(BaseModel):
    speed: int = Field(default=1, description="Playback speed multiplier (1, 10, or 60)")


class ReplayStartResponse(BaseModel):
    status: str
    participant_id: int
    speed: int
    stream_url: str
    total_points: int
    message: str


def _get_replay_dataset(participant_id: int) -> pd.DataFrame:
    """
    Load replay time series for the given participant from configured dataset.
    Raises ServiceUnavailableException (503) if dataset is not found.
    """
    path = settings.resolve_replay_path()
    if path is None or not path.exists():
        raise ServiceUnavailableException(
            message="CGMacros glucose time series dataset is not available on this server.",
            details={
                "reason": "Missing or unconfigured CGM time series file.",
                "hint": "Set REPLAY_DATA_PATH in backend/.env pointing to a valid CGM time series CSV.",
            },
        )

    try:
        df = pd.read_csv(path)
    except Exception as e:
        raise AppException(
            code="INTERNAL_SERVER_ERROR",
            message=f"Failed to read CGM replay file: {e}",
            status_code=500,
        )

    # Check participant filtering
    if "participant_id" in df.columns:
        p_df = df[df["participant_id"] == participant_id]
        if p_df.empty:
            # Fallback to the first available participant in the dataset
            available = sorted(df["participant_id"].unique())
            if available:
                p_df = df[df["participant_id"] == available[0]]
            else:
                p_df = df
    else:
        p_df = df

    return p_df.sort_values("timestamp") if "timestamp" in p_df.columns else p_df


def _compute_twin_meal_prediction(
    row: pd.Series,
    pre_glucose: float,
) -> Dict[str, Any]:
    """Compute the twin's predicted postprandial curve for an arriving meal marker."""
    carbs = float(row.get("carbs_g") or 50.0)
    protein = float(row.get("protein_g") or 20.0)
    fat = float(row.get("fat_g") or 15.0)
    kcal = float(row.get("calories") or (carbs * 4 + protein * 4 + fat * 9))

    rec = get_twin_model()
    mem = get_population_baseline()

    probe = {
        "carbs_g": carbs,
        "protein_g": protein,
        "fat_g": fat,
        "fiber_g": 5.0,
        "kcal": kcal,
        "pre_glucose": pre_glucose,
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
    }

    pred_res = predict_meal(probe) if rec else None
    if pred_res and "median" in pred_res:
        peak_rise = float(pred_res["median"])
        p10 = float(pred_res.get("p10", peak_rise * 0.7))
        p90 = float(pred_res.get("p90", peak_rise * 1.3))
        iauc = round(peak_rise * 45.0, 1)
    else:
        # Fallback heuristic
        peak_rise = round(carbs * 0.5, 1)
        p10 = max(5.0, round(peak_rise * 0.7, 1))
        p90 = round(peak_rise * 1.3, 1)
        iauc = round(peak_rise * 45.0, 1)

    # Synthesize 120-minute post-meal trajectory points (every 5 min)
    curve = []
    for m in range(0, 125, 5):
        if m <= 50:
            factor = math.sin((m / 50.0) * (math.pi / 2))
        else:
            factor = math.cos(((m - 50.0) / 70.0) * (math.pi / 2))
        g_est = round(pre_glucose + peak_rise * factor, 1)
        g_p10 = round(pre_glucose + p10 * factor, 1)
        g_p90 = round(pre_glucose + p90 * factor, 1)
        curve.append({
            "minute": m,
            "glucose": g_est,
            "p10": g_p10,
            "p90": g_p90,
        })

    return {
        "peak_rise": peak_rise,
        "iauc_2h": iauc,
        "p10": p10,
        "p90": p90,
        "predicted_peak": round(pre_glucose + peak_rise, 1),
        "curve": curve,
    }


@router.post("/{participant_id}/start", response_model=ReplayStartResponse)
def start_replay(
    participant_id: int,
    payload: Optional[ReplayStartRequest] = None,
):
    """
    Initialize a CGM replay session.
    Verifies that the time series dataset is available, checks participant data,
    and returns initial stream parameters.
    """
    speed = payload.speed if payload and payload.speed in [1, 10, 60] else 1
    p_df = _get_replay_dataset(participant_id)

    total_pts = len(p_df)
    return ReplayStartResponse(
        status="ready",
        participant_id=participant_id,
        speed=speed,
        stream_url=f"/replay/{participant_id}/stream?speed={speed}",
        total_points=total_pts,
        message=f"Replay initialized for participant #{participant_id} ({total_pts} data points at {speed}x speed).",
    )


@router.get("/{participant_id}/stream")
async def stream_cgm_replay(
    participant_id: int,
    request: Request,
    speed: int = Query(1, description="Replay speed multiplier (1, 10, 60)"),
):
    """
    Server-Sent Events (SSE) stream of recorded glucose points.
    Returns 503 if dataset is unavailable.
    Streams recorded points with delays adjusted by playback speed (1x, 10x, 60x).
    Arriving meal markers include the twin's predicted glycemic response.
    """
    # Enforce speed choices
    if speed not in [1, 10, 60]:
        speed = 1 if speed < 5 else (10 if speed < 35 else 60)

    p_df = _get_replay_dataset(participant_id)

    # Base interval between readings: 0.6s at 1x, 0.06s at 10x, 0.01s at 60x
    base_delay = 0.6
    step_delay = max(0.01, base_delay / float(speed))

    async def event_generator() -> AsyncGenerator[str, None]:
        nonlocal p_df
        try:
            prev_glucose = 100.0
            for idx, (_, row) in enumerate(p_df.iterrows()):
                if await request.is_disconnected():
                    logger.info("Client disconnected from CGM replay stream")
                    break

                glucose_val = float(row.get("glucose") or 100.0)
                ts_str = str(row.get("timestamp") or "")
                meal_type = str(row.get("meal_type") or "").strip()

                has_meal = bool(meal_type and meal_type.lower() not in ["none", "nan", ""])

                event_payload: Dict[str, Any] = {
                    "type": "meal" if has_meal else "reading",
                    "participant_id": participant_id,
                    "index": idx,
                    "timestamp": ts_str,
                    "glucose": glucose_val,
                }

                if has_meal:
                    carbs = float(row.get("carbs_g") or 50.0)
                    protein = float(row.get("protein_g") or 20.0)
                    fat = float(row.get("fat_g") or 15.0)
                    kcal = float(row.get("calories") or (carbs * 4 + protein * 4 + fat * 9))

                    event_payload["meal"] = {
                        "meal_type": meal_type,
                        "carbs_g": carbs,
                        "protein_g": protein,
                        "fat_g": fat,
                        "calories": kcal,
                    }

                    # Attach metabolic twin prediction
                    event_payload["predicted_response"] = _compute_twin_meal_prediction(
                        row=row,
                        pre_glucose=glucose_val,
                    )

                prev_glucose = glucose_val

                # Format SSE event
                yield f"data: {json.dumps(event_payload)}\n\n"
                await asyncio.sleep(step_delay)

            # Signal stream completion
            completion_payload = {
                "type": "complete",
                "participant_id": participant_id,
                "message": "Replay stream ended: all recorded data transmitted.",
            }
            yield f"data: {json.dumps(completion_payload)}\n\n"

        except asyncio.CancelledError:
            logger.info("Replay stream cancelled by client.")
        except Exception as err:
            logger.error("Error in CGM replay stream: %s", err)
            yield f"data: {json.dumps({'type': 'error', 'message': str(err)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
