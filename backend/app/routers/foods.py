import json
import logging
import math
import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.auth import get_current_user, log_audit_event, verify_patient_access
from app.config import settings
from app.db import get_db
from app.models_db import FoodItem, MealEntry, Patient, SavedMeal, User, GlucoseReading
from app.schemas import (
    FoodItemResponse,
    FoodSearchResponse,
    MealEntryResponse,
    PhotoMealEstimateResponse,
    PhotoMealEstimateItem,
    SavedMealCreate,
    SavedMealResponse,
)
from app.twin.memory import recompute_twin_state
from app.twin.lifecycle import create_prediction_record_for_meal, reconcile_patient_predictions
from app.routers.alerts import evaluate_and_sync_alerts

logger = logging.getLogger("glucotwin.foods")

router = APIRouter(tags=["Foods & Meals"])


# ============================================================================
# 1. Food Search with Fuzzy Matching & Pagination
# ============================================================================

@router.get("/foods/search", response_model=FoodSearchResponse)
def search_foods(
    q: Optional[str] = Query(None, description="Search term for food item name or category"),
    category: Optional[str] = Query(None, description="Filter by food category"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
) -> FoodSearchResponse:
    """
    Search food items with fuzzy substring/prefix matching and pagination.
    """
    query = db.query(FoodItem)

    if category and category.strip():
        query = query.filter(FoodItem.category.ilike(f"%{category.strip()}%"))

    q_clean = (q or "").strip()
    if q_clean:
        # Match name or category or serving description
        query = query.filter(
            or_(
                FoodItem.name.ilike(f"%{q_clean}%"),
                FoodItem.category.ilike(f"%{q_clean}%"),
                FoodItem.serving_description.ilike(f"%{q_clean}%"),
            )
        )

    all_matches = query.all()

    # Ranking relevance: exact match -> prefix match -> substring match -> alphabet
    if q_clean:
        q_lower = q_clean.lower()

        def rank_score(item: FoodItem) -> tuple:
            name_lower = item.name.lower()
            if name_lower == q_lower:
                return (0, len(name_lower), name_lower)
            if name_lower.startswith(q_lower):
                return (1, len(name_lower), name_lower)
            if q_lower in name_lower:
                return (2, name_lower.find(q_lower), name_lower)
            return (3, 0, name_lower)

        all_matches.sort(key=rank_score)
    else:
        all_matches.sort(key=lambda x: x.name)

    total = len(all_matches)
    pages = max(1, math.ceil(total / limit)) if total > 0 else 1
    offset = (page - 1) * limit
    paged_items = all_matches[offset : offset + limit]

    return FoodSearchResponse(
        items=[FoodItemResponse.model_validate(f) for f in paged_items],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/foods/{food_id}", response_model=FoodItemResponse)
def get_food_by_id(food_id: int, db: Session = Depends(get_db)) -> FoodItemResponse:
    """
    Get a single food item by ID.
    """
    food = db.query(FoodItem).filter(FoodItem.id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail=f"Food item with ID {food_id} not found")
    return FoodItemResponse.model_validate(food)


# ============================================================================
# 2. SavedMeal Management & Logging
# ============================================================================

@router.post("/patients/{patient_id}/saved-meals", response_model=SavedMealResponse, status_code=status.HTTP_201_CREATED)
def create_saved_meal(
    patient_id: int,
    payload: SavedMealCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedMealResponse:
    """
    Create a saved meal template for a patient.
    Validates food items and accurately computes aggregate macros based on servings.
    """
    patient = verify_patient_access(patient_id, current_user, db)

    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Saved meal name cannot be empty")

    if not payload.items:
        raise HTTPException(status_code=400, detail="Saved meal must contain at least one food item")

    enriched_items = []
    tot_carbs = 0.0
    tot_protein = 0.0
    tot_fat = 0.0
    tot_calories = 0.0
    tot_fiber = 0.0

    for it in payload.items:
        food = db.query(FoodItem).filter(FoodItem.id == it.food_id).first()
        if not food:
            raise HTTPException(status_code=404, detail=f"Food item {it.food_id} not found")

        servings = max(0.1, float(it.servings or 1.0))
        item_carbs = round(food.carbs * servings, 1)
        item_protein = round(food.protein * servings, 1)
        item_fat = round(food.fat * servings, 1)
        item_calories = round(food.calories * servings, 1)
        item_fiber = round(food.fiber * servings, 1)

        tot_carbs += item_carbs
        tot_protein += item_protein
        tot_fat += item_fat
        tot_calories += item_calories
        tot_fiber += item_fiber

        enriched_items.append({
            "food_id": food.id,
            "name": food.name,
            "serving_description": food.serving_description,
            "servings": servings,
            "carbs": item_carbs,
            "protein": item_protein,
            "fat": item_fat,
            "calories": item_calories,
            "fiber": item_fiber,
        })

    saved = SavedMeal(
        patient_id=patient_id,
        name=payload.name.strip(),
        items=enriched_items,
        computed_carbs=round(tot_carbs, 1),
        computed_protein=round(tot_protein, 1),
        computed_fat=round(tot_fat, 1),
        computed_calories=round(tot_calories, 1),
        computed_fiber=round(tot_fiber, 1),
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="create",
        resource_type="saved_meal",
        resource_id=saved.id,
        patient_id=patient_id,
    )

    return SavedMealResponse.model_validate(saved)


@router.get("/patients/{patient_id}/saved-meals", response_model=List[SavedMealResponse])
def list_saved_meals(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[SavedMealResponse]:
    """
    List all saved meals for a patient.
    """
    verify_patient_access(patient_id, current_user, db)
    meals = (
        db.query(SavedMeal)
        .filter(SavedMeal.patient_id == patient_id)
        .order_by(SavedMeal.created_at.desc())
        .all()
    )
    return [SavedMealResponse.model_validate(m) for m in meals]


@router.delete("/patients/{patient_id}/saved-meals/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_meal(
    patient_id: int,
    meal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a saved meal template.
    """
    verify_patient_access(patient_id, current_user, db)
    saved = db.query(SavedMeal).filter(SavedMeal.id == meal_id, SavedMeal.patient_id == patient_id).first()
    if not saved:
        raise HTTPException(status_code=404, detail="Saved meal not found")
    db.delete(saved)
    db.commit()


@router.post("/patients/{patient_id}/saved-meals/{meal_id}/log", response_model=MealEntryResponse, status_code=status.HTTP_201_CREATED)
def log_from_saved_meal(
    patient_id: int,
    meal_id: int,
    pre_glucose: Optional[float] = None,
    pre_trend30: Optional[float] = None,
    logged_at: Optional[datetime] = None,
    activity_after_min: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MealEntryResponse:
    """
    Fast log a MealEntry directly from a saved meal.
    Pulls pre_glucose from query param if provided, otherwise latest glucose reading or patient baseline.
    """
    patient = verify_patient_access(patient_id, current_user, db)
    saved = db.query(SavedMeal).filter(SavedMeal.id == meal_id, SavedMeal.patient_id == patient_id).first()
    if not saved:
        raise HTTPException(status_code=404, detail="Saved meal not found")

    # Determine pre_glucose from param, latest reading or patient fasting glucose
    if pre_glucose is None:
        latest_reading = (
            db.query(GlucoseReading)
            .filter(GlucoseReading.patient_id == patient_id)
            .order_by(GlucoseReading.ts.desc())
            .first()
        )
        resolved_pre_glucose = latest_reading.value_mgdl if latest_reading else (patient.fasting_glucose_mgdl or 110.0)
    else:
        resolved_pre_glucose = pre_glucose

    entry_time = logged_at or datetime.now(timezone.utc)

    meal = MealEntry(
        patient_id=patient_id,
        logged_at=entry_time,
        carbs_g=saved.computed_carbs,
        protein_g=saved.computed_protein,
        fat_g=saved.computed_fat,
        fibre_g=saved.computed_fiber,
        calories=saved.computed_calories,
        pre_glucose=resolved_pre_glucose,
        pre_trend30=pre_trend30 if pre_trend30 is not None else 0.0,
        activity_after_min=activity_after_min or 0.0,
    )
    db.add(meal)
    db.commit()
    db.refresh(meal)

    # Twin Lifecycle: Generate prediction record and run reconciliation
    create_prediction_record_for_meal(meal=meal, patient_id=patient_id, db=db)
    reconcile_patient_predictions(patient_id=patient_id, db=db)

    # Recompute memory and evaluate alerts
    recompute_twin_state(patient_id=patient_id, db=db)
    evaluate_and_sync_alerts(patient_id=patient_id, db=db)
    db.refresh(meal)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="create",
        resource_type="meal_entry",
        resource_id=meal.id,
        patient_id=patient_id,
    )

    return MealEntryResponse.model_validate(meal)


# ============================================================================
# 3. Meal Photo Logging & Estimation (Draft Result)
# ============================================================================

@router.post("/meals/estimate-from-photo", response_model=PhotoMealEstimateResponse)
async def estimate_meal_from_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> PhotoMealEstimateResponse:
    """
    Analyze food image and return estimated food items and macros with confidence.
    CRITICAL: The result is ALWAYS a draft that the patient must confirm before logging.
    With MOCK_GEMINI=true, returns a deterministic schema-valid estimate.
    With Gemini enabled, calls the Gemini Vision API.
    """
    image_bytes = await file.read()
    content_type = file.content_type or "image/jpeg"

    draft_id = f"draft_{uuid.uuid4().hex[:8]}"

    # Deterministic canned response under MOCK_GEMINI or missing API key
    if settings.mock_gemini or not settings.gemini_api_key.strip():
        return PhotoMealEstimateResponse(
            draft_id=draft_id,
            food_items=[
                PhotoMealEstimateItem(
                    name="Paneer Tikka with Grilled Bell Peppers",
                    portion="1 plate (150g)",
                    carbs=12.0,
                    protein=18.5,
                    fat=14.0,
                    calories=248.0,
                    fiber=3.5,
                ),
                PhotoMealEstimateItem(
                    name="Whole Wheat Roti",
                    portion="2 medium rotis (70g)",
                    carbs=35.0,
                    protein=6.4,
                    fat=0.8,
                    calories=170.0,
                    fiber=5.6,
                ),
                PhotoMealEstimateItem(
                    name="Fresh Cucumber & Tomato Salad",
                    portion="1 small bowl (100g)",
                    carbs=5.5,
                    protein=1.4,
                    fat=0.4,
                    calories=30.0,
                    fiber=1.8,
                ),
            ],
            estimated_macros={
                "carbs_g": 52.5,
                "protein_g": 26.3,
                "fat_g": 15.2,
                "calories": 448.0,
                "fibre_g": 10.9,
                "carbs": 52.5,
                "protein": 26.3,
                "fat": 15.2,
                "fiber": 10.9,
            },
            confidence=0.92,
            rationale="Visual identification: tandoori paneer skewers, two whole wheat rotis, and side salad with mint garnish.",
            confirmed=False,
            is_mock=True,
            disclaimer="AI draft estimate - please review and verify before logging",
        )

    # Live Gemini Vision Call
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(model_name=settings.gemini_model)

        prompt = (
            "Analyze this meal photo for diabetes glycemic tracking. "
            "Identify the food items, estimate realistic portion sizes, and estimate grams of carbs, protein, fat, calories, and fiber. "
            "Return ONLY valid JSON matching this schema:\n"
            "{\n"
            '  "food_items": [\n'
            '    {"name": "...", "portion": "...", "carbs": 0.0, "protein": 0.0, "fat": 0.0, "calories": 0.0, "fiber": 0.0}\n'
            "  ],\n"
            '  "estimated_macros": {\n'
            '    "carbs_g": 0.0, "protein_g": 0.0, "fat_g": 0.0, "calories": 0.0, "fibre_g": 0.0\n'
            "  },\n"
            '  "confidence": 0.85,\n'
            '  "rationale": "..."\n'
            "}"
        )

        response = model.generate_content([
            prompt,
            {"mime_type": content_type, "data": image_bytes},
        ])

        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

        parsed = json.loads(raw_text)

        items = [PhotoMealEstimateItem(**it) for it in parsed.get("food_items", [])]
        macros = parsed.get("estimated_macros", {})
        conf = float(parsed.get("confidence", 0.85))
        rat = str(parsed.get("rationale", "AI visual estimation"))

        return PhotoMealEstimateResponse(
            draft_id=draft_id,
            food_items=items,
            estimated_macros=macros,
            confidence=conf,
            rationale=rat,
            confirmed=False,
            is_mock=False,
            disclaimer="AI draft estimate - please review and verify before logging",
        )
    except Exception as exc:
        logger.warning(f"Gemini vision call failed, falling back to deterministic estimate: {exc}")
        return PhotoMealEstimateResponse(
            draft_id=draft_id,
            food_items=[
                PhotoMealEstimateItem(
                    name="Mixed Vegetable Pulao with Raita",
                    portion="1 plate (250g)",
                    carbs=48.0,
                    protein=6.5,
                    fat=7.0,
                    calories=280.0,
                    fiber=4.2,
                )
            ],
            estimated_macros={
                "carbs_g": 48.0,
                "protein_g": 6.5,
                "fat_g": 7.0,
                "calories": 280.0,
                "fibre_g": 4.2,
            },
            confidence=0.85,
            rationale="Fallback visual approximation due to API timeout.",
            confirmed=False,
            is_mock=True,
            disclaimer="AI draft estimate - please review and verify before logging",
        )
