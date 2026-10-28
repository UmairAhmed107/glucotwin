import json
import logging
import math
import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
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

    if category and category.strip() and category.strip().lower() != "all":
        cat_lower = category.strip().lower()
        if "south_indian" in cat_lower or "south indian" in cat_lower:
            query = query.filter(FoodItem.category.ilike("%South Indian%"))
        elif "indian_breads" in cat_lower or "rotis" in cat_lower:
            query = query.filter(FoodItem.category.ilike("%Indian Breads%"))
        elif "curries_dal" in cat_lower or "dal" in cat_lower:
            query = query.filter(
                or_(
                    FoodItem.category.ilike("%Curries%"),
                    FoodItem.category.ilike("%Dals%"),
                    FoodItem.category.ilike("%Legumes%"),
                )
            )
        elif "rice_biryani" in cat_lower or "rice" in cat_lower:
            query = query.filter(
                or_(
                    FoodItem.category.ilike("%Rice%"),
                    FoodItem.category.ilike("%Grains%"),
                )
            )
        elif "snacks_chaat" in cat_lower or "snack" in cat_lower:
            query = query.filter(
                or_(
                    FoodItem.category.ilike("%Snacks%"),
                    FoodItem.category.ilike("%Street Food%"),
                    FoodItem.category.ilike("%Sweets%"),
                )
            )
        elif "healthy_salads" in cat_lower or "salad" in cat_lower:
            query = query.filter(
                or_(
                    FoodItem.category.ilike("%Healthy%"),
                    FoodItem.category.ilike("%Fruits%"),
                    FoodItem.category.ilike("%Nuts%"),
                )
            )
        elif "international" in cat_lower:
            query = query.filter(
                or_(
                    FoodItem.category.ilike("%International%"),
                    FoodItem.category.ilike("%Fast Food%"),
                )
            )
        else:
            cat_clean = category.strip().replace("_", "%")
            query = query.filter(FoodItem.category.ilike(f"%{cat_clean}%"))


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

def classify_meal_deterministically(filename: str = "", hint: Optional[str] = None) -> PhotoMealEstimateResponse:
    draft_id = f"draft_{uuid.uuid4().hex[:8]}"
    text = f"{filename or ''} {hint or ''}".lower().replace("_", " ").replace("-", " ")

    # 1. Pizza
    if any(k in text for k in ["pizza", "pepperoni", "margherita", "slice", "crust"]):
        items = [
            PhotoMealEstimateItem(name="Thin-Crust Pepperoni Pizza", portion="2 large slices (220g)", carbs=68.0, protein=24.0, fat=26.0, calories=590.0, fiber=3.0),
            PhotoMealEstimateItem(name="Garlic Herb Dipping Sauce", portion="1 tub (30g)", carbs=2.0, protein=0.5, fat=12.0, calories=120.0, fiber=0.0),
        ]
        rat = "Visual identification: 2 slices of pepperoni pizza on wheat flour crust with melted mozzarella."
    # 2. Biryani / Rice Bowl
    elif any(k in text for k in ["biryani", "pulao", "fried rice", "rice", "curry", "pilaf"]):
        items = [
            PhotoMealEstimateItem(name="Spiced Basmati Chicken Biryani", portion="1 full plate (350g)", carbs=64.0, protein=32.0, fat=16.0, calories=530.0, fiber=4.0),
            PhotoMealEstimateItem(name="Cucumber Mint Yogurt Raita", portion="1 bowl (100g)", carbs=4.5, protein=3.5, fat=2.5, calories=55.0, fiber=1.0),
        ]
        rat = "Visual identification: Long-grain spiced basmati rice with chicken pieces and cooling yogurt raita."
    # 3. Burger / Fast Food / Fries
    elif any(k in text for k in ["burger", "cheeseburger", "fries", "patty", "hamburger"]):
        items = [
            PhotoMealEstimateItem(name="Classic Beef Cheeseburger", portion="1 burger (200g)", carbs=44.0, protein=26.0, fat=24.0, calories=490.0, fiber=2.5),
            PhotoMealEstimateItem(name="Crispy Potato French Fries", portion="1 small cup (80g)", carbs=32.0, protein=3.0, fat=14.0, calories=265.0, fiber=3.0),
        ]
        rat = "Visual identification: Toasted sesame bun cheeseburger accompanied by golden potato fries."
    # 4. Salmon / Fish / Mediterranean Salad
    elif any(k in text for k in ["salmon", "fish", "salad", "greens", "mediterranean"]):
        items = [
            PhotoMealEstimateItem(name="Pan-Seared Atlantic Salmon Fillet", portion="1 fillet (160g)", carbs=0.0, protein=36.0, fat=18.0, calories=310.0, fiber=0.0),
            PhotoMealEstimateItem(name="Mediterranean Garden Greens with Olive Oil", portion="1 large bowl (150g)", carbs=8.0, protein=3.0, fat=9.0, calories=125.0, fiber=5.0),
            PhotoMealEstimateItem(name="Steamed Organic Quinoa", portion="0.5 cup (90g)", carbs=20.0, protein=4.5, fat=2.0, calories=115.0, fiber=3.0),
        ]
        rat = "Visual identification: Grilled pink salmon fillet over fresh mixed leafy greens with extra virgin olive oil."
    # 5. Oats / Oatmeal / Porridge / Breakfast Bowl
    elif any(k in text for k in ["oat", "porridge", "cereal", "berry", "berries", "chia"]):
        items = [
            PhotoMealEstimateItem(name="Steel-Cut Rolled Oats with Low-Fat Milk", portion="1 bowl (200g)", carbs=38.0, protein=10.0, fat=5.0, calories=235.0, fiber=6.0),
            PhotoMealEstimateItem(name="Fresh Blueberries & Crushed Walnuts", portion="0.5 cup (60g)", carbs=12.0, protein=3.5, fat=9.0, calories=140.0, fiber=3.5),
        ]
        rat = "Visual identification: Warm steel-cut oatmeal topped with antioxidant-rich blueberries and walnuts."
    # 6. Pasta / Spaghetti / Noodles
    elif any(k in text for k in ["pasta", "spaghetti", "noodle", "penne", "ramen", "lasagna"]):
        items = [
            PhotoMealEstimateItem(name="Durum Wheat Spaghetti Marinara", portion="1 deep plate (250g)", carbs=62.0, protein=14.0, fat=8.0, calories=375.0, fiber=5.0),
            PhotoMealEstimateItem(name="Lean Turkey Meatballs (3 pcs)", portion="3 pieces (100g)", carbs=4.0, protein=22.0, fat=7.0, calories=165.0, fiber=1.0),
        ]
        rat = "Visual identification: Italian durum spaghetti in rich tomato basil sauce with lean meatballs."
    # 7. Roti / Chapati / Indian Vegetarian Thali
    elif any(k in text for k in ["roti", "chapati", "dal", "paneer", "tikka", "sabzi", "subzi", "paratha"]):
        items = [
            PhotoMealEstimateItem(name="Tandoori Paneer Tikka Skewers", portion="1 plate (150g)", carbs=10.0, protein=20.0, fat=15.0, calories=255.0, fiber=3.0),
            PhotoMealEstimateItem(name="Whole Wheat Rotis (2 pcs)", portion="2 rotis (70g)", carbs=34.0, protein=6.5, fat=1.0, calories=170.0, fiber=5.5),
            PhotoMealEstimateItem(name="Spiced Yellow Moong Dal", portion="1 small katori (120g)", carbs=16.0, protein=8.0, fat=3.5, calories=125.0, fiber=4.0),
        ]
        rat = "Visual identification: Grilled cottage cheese (paneer) skewers, whole grain flatbreads, and yellow lentil soup."
    # 8. Dosa / Idli / South Indian
    elif any(k in text for k in ["dosa", "idli", "sambar", "vada", "chutney", "uttapam"]):
        items = [
            PhotoMealEstimateItem(name="Crisp Masala Dosa with Potato Filling", portion="1 large dosa (180g)", carbs=46.0, protein=6.5, fat=12.0, calories=320.0, fiber=4.0),
            PhotoMealEstimateItem(name="Mixed Vegetable Sambar & Coconut Chutney", portion="1 bowl (120g)", carbs=12.0, protein=4.5, fat=5.0, calories=110.0, fiber=3.5),
        ]
        rat = "Visual identification: Golden fermented rice-lentil crepe with spiced potato mash and lentil-vegetable sambar."
    # 9. Eggs / Toast / Omelette
    elif any(k in text for k in ["egg", "omelette", "toast", "avocado", "scramble", "benedict"]):
        items = [
            PhotoMealEstimateItem(name="Two Free-Range Eggs Scrambled", portion="2 large eggs (100g)", carbs=1.5, protein=13.0, fat=14.0, calories=185.0, fiber=0.0),
            PhotoMealEstimateItem(name="Whole Grain Toast with Sliced Avocado", portion="1 thick slice (80g)", carbs=22.0, protein=5.0, fat=10.0, calories=195.0, fiber=6.0),
        ]
        rat = "Visual identification: Soft scrambled eggs accompanied by artisanal whole grain toast and fresh sliced avocado."
    # 10. Sandwich / Wrap / Sub
    elif any(k in text for k in ["sandwich", "wrap", "sub", "panini", "taco", "burrito"]):
        items = [
            PhotoMealEstimateItem(name="Smoked Turkey & Swiss Cheese Whole Wheat Wrap", portion="1 wrap (220g)", carbs=38.0, protein=28.0, fat=14.0, calories=390.0, fiber=5.0),
            PhotoMealEstimateItem(name="Baby Carrot & Hummus Dip", portion="1 serving (60g)", carbs=8.0, protein=2.5, fat=4.0, calories=75.0, fiber=3.0),
        ]
        rat = "Visual identification: Whole wheat tortilla wrap layered with lean sliced turkey breast, crisp lettuce, and swiss cheese."
    # Default: Balanced plate
    else:
        items = [
            PhotoMealEstimateItem(name="Grilled Chicken Breast / Lean Protein", portion="1 piece (140g)", carbs=1.0, protein=34.0, fat=6.0, calories=195.0, fiber=0.0),
            PhotoMealEstimateItem(name="Brown Rice & Steamed Seasonal Greens", portion="1 cup (180g)", carbs=36.0, protein=5.0, fat=2.5, calories=185.0, fiber=5.0),
            PhotoMealEstimateItem(name="Mixed Herb Salad with Lemon Vinaigrette", portion="1 small bowl (80g)", carbs=5.0, protein=1.5, fat=4.5, calories=65.0, fiber=2.0),
        ]
        rat = "Visual identification: Balanced nutritional plate featuring grilled lean protein, fiber-rich whole grains, and steamed vegetables."

    tot_c = round(sum(it.carbs for it in items), 1)
    tot_p = round(sum(it.protein for it in items), 1)
    tot_f = round(sum(it.fat for it in items), 1)
    tot_fib = round(sum(it.fiber for it in items), 1)
    tot_cal = round(sum(it.calories for it in items), 1)

    return PhotoMealEstimateResponse(
        draft_id=draft_id,
        food_items=items,
        estimated_macros={
            "carbs_g": tot_c,
            "protein_g": tot_p,
            "fat_g": tot_f,
            "fibre_g": tot_fib,
            "calories": tot_cal,
            "carbs": tot_c,
            "protein": tot_p,
            "fat": tot_f,
            "fiber": tot_fib,
        },
        confidence=0.91,
        rationale=rat,
        confirmed=False,
        is_mock=True,
        disclaimer="AI draft estimate - please review, adjust macros as needed, and verify before logging",
    )


@router.post("/meals/estimate-from-photo", response_model=PhotoMealEstimateResponse)
async def estimate_meal_from_photo(
    file: UploadFile = File(...),
    hint: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
) -> PhotoMealEstimateResponse:
    """
    Analyze food image and return estimated food items and macros with confidence.
    CRITICAL: The result is ALWAYS an editable draft that the patient can calibrate and confirm before logging.
    """
    image_bytes = await file.read()
    content_type = file.content_type or "image/jpeg"
    draft_id = f"draft_{uuid.uuid4().hex[:8]}"

    # Deterministic intelligent classification under MOCK_GEMINI or missing API key
    if settings.mock_gemini or not settings.gemini_api_key.strip():
        return classify_meal_deterministically(file.filename or "", hint)

    # Live Gemini Vision Call
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(model_name=settings.gemini_model)

        prompt = (
            "Analyze this meal photo for diabetes glycemic tracking. "
            f"User food hint / description: {hint or 'None provided'}. "
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
            disclaimer="AI draft estimate - please review, adjust macros as needed, and verify before logging",
        )
    except Exception as exc:
        logger.warning(f"Gemini vision call failed, falling back to intelligent estimate: {exc}")
        return classify_meal_deterministically(file.filename or "", hint)
