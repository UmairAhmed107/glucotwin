"""
app/comprehensive_seeder.py

Robust, idempotent seeder that populates:
1. Doctors & Care Team:
   - Dr. Rajesh Patel, MD [DOC-101] (Senior Endocrinologist)
   - Dr. Sarah Chen, MD [DOC-102] (Clinical Diabetologist)
   - Dr. Ananya Sharma, MD, DM [DOC-103] (Consultant Endocrinologist)
   - Dr. Vikram Malhotra, MD [DOC-104] (Internal Medicine & Diabetology)
   - Dr. Meera Krishnan, MD [DOC-105] (Preventive Diabetology)
   - Elena Rostova, MS, RD, CDCES [DIET-201] (Clinical Nutritionist)
   - Priya Sundaram, MSc, RD, CDE [DIET-202] (South Asian Medical Nutritionist)
   - System Administrator [ADMIN-001]

2. 10 Numbered Patients with Clinical Stratification:
   - Patient #01 - Demo A [Cold Start Profile] (Arthur Dent)
   - Patient #02 - Demo B [CGMacros #1 Adaptive Twin] (Beatrix Kiddo)
   - Patient #03 - Demo C [Shanghai Hypo-Risk] (Charles Xavier)
   - Patient #04 - Rajesh V. [High Glycemic Variability]
   - Patient #05 - Sunita K. [Postprandial Spikes]
   - Patient #06 - Arvind N. [Metformin Titration]
   - Patient #07 - Lakshmi R. [South Indian Vegetarian]
   - Patient #08 - Vikram P. [Cardiometabolic Risk]
   - Patient #09 - Deepa S. [Newly Diagnosed T2D]
   - Patient #10 - Karthik M. [Dawn Phenomenon]

3. Active CareTeamLinks connecting all doctors/dietitians to all patients.
4. Continuous 14-day CGM telemetry for all patients (realistic diurnal & meal excursions).
5. Indian & South Indian Logged Meals (Idlis, Dosas, Pesarattu, Pongal, Ragi Rotis, Adai, Sambar, Kootu, Curd Rice, Biryani, Dal Tadka).
6. 1-Tap Saved South Indian & Indian Meal Plates (in SavedMeal table).
7. South Indian Food Items catalog additions.
8. Clinical visits, SOAP notes, stratified alerts, and simulation scenarios.
"""

import logging
import math
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.models_db import (
    Alert,
    CarePlan,
    CarePlanTask,
    CareTeamLink,
    DoseLog,
    FoodItem,
    GlucoseReading,
    MealEntry,
    Medication,
    Message,
    MessageThread,
    Patient,
    PredictionRecord,
    RecommendationDraft,
    SavedMeal,
    SavedScenario,
    TwinState,
    User,
    Visit,
    utcnow,
)
from app.twin.memory import recompute_twin_state

logger = logging.getLogger("glucotwin.seeder")


# Additional authentic South Indian items to ensure FoodItem catalog completeness
SOUTH_INDIAN_CATALOG_ITEMS = [
    {
        "name": "Podi Idli (Ghee & Gunpowder Idlis)",
        "serving_description": "2 idlis tossed in ghee podi (120g)",
        "carbs": 29.0,
        "protein": 5.8,
        "fat": 7.5,
        "calories": 205.0,
        "fiber": 3.2,
        "category": "South Indian",
    },
    {
        "name": "Ghee Roast Dosa",
        "serving_description": "1 crispy ghee roast dosa (100g)",
        "carbs": 31.0,
        "protein": 4.5,
        "fat": 11.5,
        "calories": 245.0,
        "fiber": 2.0,
        "category": "South Indian",
    },
    {
        "name": "Kuzhi Paniyaram (Savory Rice-Lentil Dumplings)",
        "serving_description": "4 pieces (120g)",
        "carbs": 32.0,
        "protein": 5.2,
        "fat": 5.0,
        "calories": 195.0,
        "fiber": 2.8,
        "category": "South Indian",
    },
    {
        "name": "Bisi Bele Bath (Spiced Lentil-Rice Hot Pot)",
        "serving_description": "1 bowl (220g)",
        "carbs": 52.0,
        "protein": 9.8,
        "fat": 9.2,
        "calories": 330.0,
        "fiber": 6.0,
        "category": "South Indian",
    },
    {
        "name": "Curd Vada (Thayir Vadai)",
        "serving_description": "2 vadas in spiced curd (160g)",
        "carbs": 24.0,
        "protein": 8.5,
        "fat": 12.0,
        "calories": 240.0,
        "fiber": 3.0,
        "category": "South Indian",
    },
    {
        "name": "Ragi Mudde (Finger Millet Ball)",
        "serving_description": "1 mudde (150g)",
        "carbs": 42.0,
        "protein": 5.2,
        "fat": 1.5,
        "calories": 205.0,
        "fiber": 7.5,
        "category": "South Indian",
    },
    {
        "name": "Avial (Vegetables in Coconut & Yogurt Stew)",
        "serving_description": "1 bowl (180g)",
        "carbs": 14.0,
        "protein": 4.2,
        "fat": 8.5,
        "calories": 150.0,
        "fiber": 5.2,
        "category": "South Indian",
    },
    {
        "name": "Keerai Kootu (Spinach & Moong Dal Stew)",
        "serving_description": "1 bowl (180g)",
        "carbs": 13.5,
        "protein": 7.8,
        "fat": 3.5,
        "calories": 115.0,
        "fiber": 5.5,
        "category": "South Indian",
    },
    {
        "name": "Pepper Rasam (Milagu Rasam)",
        "serving_description": "1 cup (150ml)",
        "carbs": 6.5,
        "protein": 1.5,
        "fat": 1.0,
        "calories": 42.0,
        "fiber": 1.2,
        "category": "South Indian",
    },
    {
        "name": "Lemon Sevai (Flavored Rice Vermicelli)",
        "serving_description": "1 plate (160g)",
        "carbs": 38.0,
        "protein": 4.0,
        "fat": 6.5,
        "calories": 225.0,
        "fiber": 1.8,
        "category": "South Indian",
    },
    {
        "name": "Chettinad Mushroom Biryani",
        "serving_description": "1 plate (250g)",
        "carbs": 52.0,
        "protein": 8.5,
        "fat": 10.5,
        "calories": 340.0,
        "fiber": 4.5,
        "category": "South Indian",
    },
    {
        "name": "Sundal (Tempered Chickpeas with Mustard & Coconut)",
        "serving_description": "1 cup (140g)",
        "carbs": 24.0,
        "protein": 9.0,
        "fat": 4.2,
        "calories": 170.0,
        "fiber": 6.8,
        "category": "South Indian",
    },
    {
        "name": "South Indian Filter Coffee (Kaapi - Unsweetened)",
        "serving_description": "1 cup (150ml with milk)",
        "carbs": 5.5,
        "protein": 4.2,
        "fat": 4.5,
        "calories": 78.0,
        "fiber": 0.0,
        "category": "South Indian",
    },
    {
        "name": "Spiced Buttermilk (Neer Mor)",
        "serving_description": "1 tall glass (250ml)",
        "carbs": 4.2,
        "protein": 2.8,
        "fat": 1.2,
        "calories": 38.0,
        "fiber": 0.5,
        "category": "South Indian",
    },
    {
        "name": "Kanchipuram Idli",
        "serving_description": "2 spiced idlis (140g)",
        "carbs": 32.0,
        "protein": 6.0,
        "fat": 4.2,
        "calories": 190.0,
        "fiber": 2.8,
        "category": "South Indian",
    },
    {
        "name": "Onion Podi Uttapam",
        "serving_description": "1 uttapam (130g)",
        "carbs": 36.0,
        "protein": 5.8,
        "fat": 6.8,
        "calories": 230.0,
        "fiber": 3.5,
        "category": "South Indian",
    },
    {
        "name": "Malabar Parotta",
        "serving_description": "1 parotta (80g)",
        "carbs": 38.0,
        "protein": 5.5,
        "fat": 12.0,
        "calories": 280.0,
        "fiber": 1.5,
        "category": "South Indian",
    },
    {
        "name": "Vegetable Kurma (South Indian Coconut Stew)",
        "serving_description": "1 bowl (180g)",
        "carbs": 16.0,
        "protein": 4.5,
        "fat": 9.5,
        "calories": 165.0,
        "fiber": 4.0,
        "category": "South Indian",
    },
]


def seed_comprehensive_database(db: Session) -> Dict[str, int]:
    """
    Seeds and synchronizes the full GlucoTwin demonstration environment:
    - 7 Providers (Doctors & Dietitians with IDs)
    - 10 Numbered Patients with distinct metabolic phenotyping
    - Active care team relationships
    - 14-day continuous CGM sensor telemetry
    - Indian and South Indian meal entries with twin prediction records
    - 1-tap South Indian saved meals
    - Additional South Indian food catalog items
    - Clinical visits, SOAP notes, alerts, and care plan milestones
    """
    logger.info("Starting comprehensive database seeding...")
    now = utcnow()
    default_pwd_hash = hash_password("Password123!")

    # =========================================================================
    # 1. SEED FOOD CATALOG ITEMS (SOUTH INDIAN EXPANSION)
    # =========================================================================
    foods_added = 0
    for item in SOUTH_INDIAN_CATALOG_ITEMS:
        exists = db.query(FoodItem).filter(FoodItem.name == item["name"]).first()
        if not exists:
            food = FoodItem(
                name=item["name"],
                serving_description=item["serving_description"],
                carbs=item["carbs"],
                protein=item["protein"],
                fat=item["fat"],
                calories=item["calories"],
                fiber=item["fiber"],
                category=item["category"],
                is_demo=True,
                disclaimer="Approximate demo data for clinical educational testing",
            )
            db.add(food)
            foods_added += 1
    if foods_added > 0:
        db.commit()
        logger.info(f"Added {foods_added} new South Indian food catalog items.")

    # =========================================================================
    # 2. SEED USERS: DOCTORS, DIETITIANS & ADMIN (WITH PROFESSIONAL NUMBERING)
    # =========================================================================
    providers_def = [
        ("admin@glucotwin.org", "System Administrator [ADMIN-001]", "admin"),
        ("dr.patel@glucotwin.org", "Dr. Rajesh Patel, MD [DOC-101] - Senior Endocrinologist", "clinician"),
        ("dr.chen@glucotwin.org", "Dr. Sarah Chen, MD [DOC-102] - Clinical Diabetologist", "clinician"),
        ("dr.ananya@glucotwin.org", "Dr. Ananya Sharma, MD, DM [DOC-103] - Endocrinologist", "clinician"),
        ("dr.vikram@glucotwin.org", "Dr. Vikram Malhotra, MD [DOC-104] - Internal Medicine & Diabetes", "clinician"),
        ("dr.meera@glucotwin.org", "Dr. Meera Krishnan, MD [DOC-105] - Preventive Diabetology", "clinician"),
        ("elena.diet@glucotwin.org", "Elena Rostova, MS, RD, CDCES [DIET-201] - Clinical Nutritionist", "dietitian"),
        ("priya.diet@glucotwin.org", "Priya Sundaram, MSc, RD, CDE [DIET-202] - South Asian Nutritionist", "dietitian"),
    ]

    patient_users_def = [
        ("patient.a@glucotwin.org", "Arthur Dent [PT-01]", "patient"),
        ("patient.b@glucotwin.org", "Beatrix Kiddo [PT-02]", "patient"),
        ("patient.c@glucotwin.org", "Charles Xavier [PT-03]", "patient"),
        ("patient.rajesh@glucotwin.org", "Rajesh V. [PT-04]", "patient"),
        ("patient.sunita@glucotwin.org", "Sunita K. [PT-05]", "patient"),
        ("patient.arvind@glucotwin.org", "Arvind N. [PT-06]", "patient"),
        ("patient.lakshmi@glucotwin.org", "Lakshmi R. [PT-07]", "patient"),
        ("patient.vikram@glucotwin.org", "Vikram P. [PT-08]", "patient"),
        ("patient.deepa@glucotwin.org", "Deepa S. [PT-09]", "patient"),
        ("patient.karthik@glucotwin.org", "Karthik M. [PT-10]", "patient"),
    ]

    user_map: Dict[str, User] = {}
    for email, full_name, role in providers_def + patient_users_def:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                full_name=full_name,
                role=role,
                password_hash=default_pwd_hash,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.full_name = full_name
            user.role = role
            user.password_hash = default_pwd_hash
            db.commit()
            db.refresh(user)
        user_map[email] = user

    # =========================================================================
    # 3. SEED 10 NUMBERED PATIENTS WITH DIVERSE CLINICAL PHENOTYPING
    # =========================================================================
    patients_def = [
        {
            "display_name": "Demo A [Patient #01 - Cold Start]",
            "source": "new",
            "age": 52,
            "sex": "M",
            "bmi": 28.4,
            "hba1c_pct": 7.6,
            "fasting_glucose_mgdl": 138.0,
            "hypoglycemia_history": False,
            "kidney_flag": False,
            "current_meds": ["metformin"],
            "email": "patient.a@glucotwin.org",
            "cgmacros_id": None,
        },
        {
            "display_name": "Demo B [Patient #02 - CGMacros #1]",
            "source": "cgmacros",
            "age": 45,
            "sex": "F",
            "bmi": 26.2,
            "hba1c_pct": 6.8,
            "fasting_glucose_mgdl": 112.0,
            "hypoglycemia_history": False,
            "kidney_flag": False,
            "current_meds": ["metformin", "sglt2_inhibitor"],
            "email": "patient.b@glucotwin.org",
            "cgmacros_id": 1,
        },
        {
            "display_name": "Demo C [Patient #03 - Shanghai Hypo-Risk]",
            "source": "shanghai_profile",
            "age": 62,
            "sex": "M",
            "bmi": 23.7,
            "hba1c_pct": 8.1,
            "fasting_glucose_mgdl": 142.0,
            "hypoglycemia_history": True,
            "kidney_flag": False,
            "current_meds": ["sulfonylurea"],
            "email": "patient.c@glucotwin.org",
            "cgmacros_id": None,
        },
        {
            "display_name": "Patient #04 - Rajesh V. [High Glycemic Variability]",
            "source": "new",
            "age": 58,
            "sex": "M",
            "bmi": 29.5,
            "hba1c_pct": 9.2,
            "fasting_glucose_mgdl": 176.0,
            "hypoglycemia_history": False,
            "kidney_flag": False,
            "current_meds": ["metformin", "sulfonylurea"],
            "email": "patient.rajesh@glucotwin.org",
            "cgmacros_id": None,
        },
        {
            "display_name": "Patient #05 - Sunita K. [Postprandial Spikes]",
            "source": "new",
            "age": 49,
            "sex": "F",
            "bmi": 27.8,
            "hba1c_pct": 7.9,
            "fasting_glucose_mgdl": 145.0,
            "hypoglycemia_history": False,
            "kidney_flag": False,
            "current_meds": ["metformin", "dpp4_inhibitor"],
            "email": "patient.sunita@glucotwin.org",
            "cgmacros_id": None,
        },
        {
            "display_name": "Patient #06 - Arvind N. [Metformin Titration]",
            "source": "new",
            "age": 55,
            "sex": "M",
            "bmi": 25.4,
            "hba1c_pct": 7.2,
            "fasting_glucose_mgdl": 128.0,
            "hypoglycemia_history": False,
            "kidney_flag": False,
            "current_meds": ["metformin"],
            "email": "patient.arvind@glucotwin.org",
            "cgmacros_id": None,
        },
        {
            "display_name": "Patient #07 - Lakshmi R. [South Indian Vegetarian]",
            "source": "new",
            "age": 61,
            "sex": "F",
            "bmi": 26.8,
            "hba1c_pct": 8.4,
            "fasting_glucose_mgdl": 162.0,
            "hypoglycemia_history": False,
            "kidney_flag": False,
            "current_meds": ["metformin", "dpp4_inhibitor"],
            "email": "patient.lakshmi@glucotwin.org",
            "cgmacros_id": None,
        },
        {
            "display_name": "Patient #08 - Vikram P. [Cardiometabolic Risk]",
            "source": "new",
            "age": 66,
            "sex": "M",
            "bmi": 31.2,
            "hba1c_pct": 9.6,
            "fasting_glucose_mgdl": 188.0,
            "hypoglycemia_history": False,
            "kidney_flag": True,
            "current_meds": ["metformin", "sglt2_inhibitor"],
            "email": "patient.vikram@glucotwin.org",
            "cgmacros_id": None,
        },
        {
            "display_name": "Patient #09 - Deepa S. [Newly Diagnosed T2D]",
            "source": "new",
            "age": 42,
            "sex": "F",
            "bmi": 24.5,
            "hba1c_pct": 6.9,
            "fasting_glucose_mgdl": 122.0,
            "hypoglycemia_history": False,
            "kidney_flag": False,
            "current_meds": ["metformin"],
            "email": "patient.deepa@glucotwin.org",
            "cgmacros_id": None,
        },
        {
            "display_name": "Patient #10 - Karthik M. [Dawn Phenomenon]",
            "source": "new",
            "age": 50,
            "sex": "M",
            "bmi": 27.1,
            "hba1c_pct": 7.5,
            "fasting_glucose_mgdl": 154.0,
            "hypoglycemia_history": False,
            "kidney_flag": False,
            "current_meds": ["metformin"],
            "email": "patient.karthik@glucotwin.org",
            "cgmacros_id": None,
        },
    ]

    seeded_patients: List[Patient] = []
    for p_def in patients_def:
        # Search by display name prefix to allow idempotent updates
        match_prefix = p_def["display_name"].split(" [")[0]
        patient = (
            db.query(Patient)
            .filter(
                (Patient.display_name.like(f"{match_prefix}%"))
                | (Patient.user_id == user_map[p_def["email"]].id)
            )
            .first()
        )

        if not patient:
            patient = Patient(
                display_name=p_def["display_name"],
                is_synthetic=True,
                source=p_def["source"],
                cgmacros_participant_id=p_def["cgmacros_id"],
                age=p_def["age"],
                sex=p_def["sex"],
                bmi=p_def["bmi"],
                hba1c_pct=p_def["hba1c_pct"],
                fasting_glucose_mgdl=p_def["fasting_glucose_mgdl"],
                hypoglycemia_history=p_def["hypoglycemia_history"],
                kidney_flag=p_def["kidney_flag"],
                current_meds=p_def["current_meds"],
                user_id=user_map[p_def["email"]].id,
            )
            db.add(patient)
            db.commit()
            db.refresh(patient)
        else:
            patient.display_name = p_def["display_name"]
            patient.age = p_def["age"]
            patient.sex = p_def["sex"]
            patient.bmi = p_def["bmi"]
            patient.hba1c_pct = p_def["hba1c_pct"]
            patient.fasting_glucose_mgdl = p_def["fasting_glucose_mgdl"]
            patient.hypoglycemia_history = p_def["hypoglycemia_history"]
            patient.kidney_flag = p_def["kidney_flag"]
            patient.current_meds = p_def["current_meds"]
            patient.user_id = user_map[p_def["email"]].id
            db.commit()
            db.refresh(patient)

        seeded_patients.append(patient)

    logger.info(f"Verified {len(seeded_patients)} numbered patients in database.")

    # =========================================================================
    # 4. SEED ACTIVE CARE TEAM LINKS FOR FULL ACCESS ACROSS ALL PROVIDERS
    # =========================================================================
    active_providers = [
        user_map["dr.patel@glucotwin.org"],
        user_map["dr.chen@glucotwin.org"],
        user_map["dr.ananya@glucotwin.org"],
        user_map["dr.vikram@glucotwin.org"],
        user_map["dr.meera@glucotwin.org"],
        user_map["elena.diet@glucotwin.org"],
        user_map["priya.diet@glucotwin.org"],
    ]

    links_created = 0
    for p in seeded_patients:
        for prov in active_providers:
            link = (
                db.query(CareTeamLink)
                .filter(
                    CareTeamLink.patient_id == p.id,
                    CareTeamLink.provider_user_id == prov.id,
                )
                .first()
            )
            if not link:
                link = CareTeamLink(
                    patient_id=p.id,
                    provider_user_id=prov.id,
                    role_in_team=prov.role,
                    status="active",
                )
                db.add(link)
                links_created += 1
            else:
                link.status = "active"
                link.role_in_team = prov.role
    db.commit()
    logger.info(f"Verified active care-team links across all providers and patients.")

    # =========================================================================
    # 5. SEED 14-DAY CONTINUOUS CGM TELEMETRY
    # =========================================================================
    for idx, p in enumerate(seeded_patients):
        existing_readings = db.query(GlucoseReading).filter(GlucoseReading.patient_id == p.id).count()
        if existing_readings < 200:
            db.query(GlucoseReading).filter(GlucoseReading.patient_id == p.id).delete()
            db.commit()

            base_fpg = p.fasting_glucose_mgdl or 125.0
            random.seed(100 + p.id)
            readings_to_add = []

            for day_offset in range(14, -1, -1):
                day_start = (now - timedelta(days=day_offset)).replace(hour=0, minute=0, second=0, microsecond=0)
                for step in range(96):
                    t = day_start + timedelta(minutes=step * 15)
                    hour_frac = t.hour + t.minute / 60.0

                    circadian = 9.0 * math.sin((hour_frac - 5.5) * math.pi / 12.0)
                    glucose = base_fpg + circadian

                    # Breakfast at 8:00, Lunch at 13:00, Dinner at 19:30
                    for meal_h, spike in [(8.0, 38.0), (13.0, 48.0), (19.5, 54.0)]:
                        dt = hour_frac - meal_h
                        if 0.0 <= dt <= 3.0:
                            gamma = (dt / 1.0) * math.exp(1.0 - (dt / 1.0))
                            glucose += spike * gamma

                    # Patient 3 (Hypo) nocturnal dip
                    if p.hypoglycemia_history and 2.5 <= hour_frac <= 4.5 and day_offset in (2, 5, 9):
                        glucose = 58.0 + random.uniform(-4, 6)

                    # Patient 4 (High variability) add noise
                    if "High Glycemic" in p.display_name:
                        glucose += random.uniform(-18, 22)
                    else:
                        glucose += random.uniform(-6, 6)

                    readings_to_add.append(
                        GlucoseReading(
                            patient_id=p.id,
                            ts=t,
                            value_mgdl=round(max(45.0, min(360.0, glucose)), 1),
                            source="replay",
                        )
                    )

            if readings_to_add:
                db.bulk_save_objects(readings_to_add)
                db.commit()

    logger.info("Continuous 14-day CGM telemetry verified for all patients.")

    # =========================================================================
    # 6. SEED INDIAN & SOUTH INDIAN LOGGED MEALS & PREDICTION RECORDS
    # =========================================================================
    # Realistic Indian & South Indian meal templates:
    # (name, carbs, protein, fat, fiber, calories, pre_g, pre_trend, actual_rise)
    indian_south_indian_meals = [
        # South Indian Breakfasts
        ("3 Steamed Idlis with Drumstick Sambar & Coconut Chutney", 44.0, 10.5, 7.8, 5.2, 290.0, 108.0, 0.05, 34.0),
        ("Crispy Masala Dosa with Potato Masala & Tomato Rasam", 48.0, 8.2, 12.5, 4.8, 335.0, 112.0, 0.10, 42.0),
        ("High-Protein Pesarattu (Green Moong Dosa) with Ginger Chutney", 32.0, 14.5, 6.8, 6.5, 250.0, 104.0, 0.00, 22.0),
        ("Ven Pongal with Ghee Tadka & Coconut Chutney", 45.0, 8.5, 14.0, 4.2, 340.0, 115.0, 0.10, 38.0),
        ("Rava Upma with Mixed Vegetables & Filter Coffee", 42.0, 7.2, 8.8, 3.5, 280.0, 110.0, 0.05, 36.0),
        ("2 Medu Vadas with Hot Vegetable Sambar", 22.0, 7.5, 14.0, 3.8, 245.0, 108.0, 0.00, 24.0),
        ("Set Dosa (2 dosas) with Sambar & Pudina Chutney", 38.0, 6.8, 5.2, 3.0, 225.0, 106.0, 0.00, 31.0),
        # Lunches
        ("South Indian Thali: Brown Rice + Sambar + Cabbage Poriyal + Curd", 58.0, 14.2, 9.8, 7.5, 380.0, 118.0, 0.05, 46.0),
        ("Curd Rice (Thayir Sadam) with Mustard-Curry Leaf Tadka & Pickle", 46.0, 8.5, 7.2, 2.5, 280.0, 114.0, 0.00, 32.0),
        ("Bisi Bele Bath with Cucumber-Onion Salad", 54.0, 11.2, 10.5, 6.2, 360.0, 122.0, 0.10, 44.0),
        ("Two Phulka Rotis with Dal Tadka & Bhindi Fry", 42.0, 13.5, 9.2, 6.8, 305.0, 116.0, 0.05, 33.0),
        ("Chicken Dum Biryani with Cucumber Raita", 54.0, 24.5, 14.5, 3.8, 445.0, 120.0, 0.15, 48.0),
        ("Paneer Butter Masala with 2 Whole Wheat Rotis", 46.0, 17.5, 18.2, 5.5, 415.0, 115.0, 0.05, 39.0),
        # Dinners
        ("2 Ragi Rotis (Finger Millet) with Palak Paneer", 38.0, 16.5, 13.8, 7.8, 345.0, 112.0, 0.00, 28.0),
        ("Multigrain Adai (Mixed Lentil Dosa) with Avial", 36.0, 14.2, 8.5, 7.2, 275.0, 108.0, 0.00, 26.0),
        ("Steamed Idiyappam (2 pcs) with Veg Stew & Coconut Milk", 38.0, 5.5, 9.2, 2.5, 255.0, 105.0, 0.00, 29.0),
        ("2 Chapathis with Yellow Moong Dal & Lauki Sabzi", 40.0, 12.5, 6.8, 6.2, 275.0, 110.0, 0.00, 30.0),
        ("Yellow Dal Khichdi with Roasted Papad & Curd", 48.0, 12.2, 7.8, 5.5, 315.0, 114.0, 0.05, 37.0),
        # Snacks
        ("Sundal (Tempered Chickpeas with Coconut & Mustard)", 24.0, 9.2, 4.2, 6.8, 170.0, 102.0, 0.00, 16.0),
        ("South Indian Filter Kaapi (Unsweetened) + Marie Biscuit", 14.0, 3.5, 2.8, 0.5, 95.0, 100.0, 0.00, 12.0),
    ]

    for p in seeded_patients:
        curr_meals_count = db.query(MealEntry).filter(MealEntry.patient_id == p.id).count()
        target_meals = 20 if "Lakshmi" in p.display_name or "Demo B" in p.display_name else 14

        if curr_meals_count < target_meals:
            random.seed(50 + p.id)
            for idx in range(target_meals):
                tmpl = indian_south_indian_meals[idx % len(indian_south_indian_meals)]
                days_ago = (target_meals - idx) * 0.65
                meal_time = now - timedelta(days=days_ago, hours=random.uniform(-1, 1))

                c = round(tmpl[1] * random.uniform(0.92, 1.08), 1)
                pr = round(tmpl[2] * random.uniform(0.92, 1.08), 1)
                f = round(tmpl[3] * random.uniform(0.92, 1.08), 1)
                fib = round(tmpl[4] * random.uniform(0.92, 1.08), 1)
                cal = round(c * 4 + pr * 4 + f * 9, 0)
                pre_g = round(tmpl[6] + random.uniform(-6, 6), 1)
                rise = round(tmpl[8] * (c / tmpl[1]) + random.uniform(-3, 3), 1)
                iauc = round(rise * 1.85, 1)

                meal = MealEntry(
                    patient_id=p.id,
                    logged_at=meal_time,
                    carbs_g=c,
                    protein_g=pr,
                    fat_g=f,
                    fibre_g=fib,
                    calories=cal,
                    pre_glucose=pre_g,
                    pre_trend30=tmpl[7],
                    observed_peak_rise=rise,
                    observed_iauc_2h=iauc,
                    observed_delta_60=round(rise * 0.9, 1),
                    observed_delta_120=round(rise * 0.35, 1),
                    activity_after_min=15.0 if idx % 2 == 0 else 0.0,
                )
                db.add(meal)
                db.commit()
                db.refresh(meal)

                # Matching prediction record
                pred_rise = round(rise + random.uniform(-3.5, 3.5), 1)
                pred = PredictionRecord(
                    patient_id=p.id,
                    meal_id=meal.id,
                    predicted_peak_rise=pred_rise,
                    p10=round(pred_rise - 7.5, 1),
                    p90=round(pred_rise + 8.0, 1),
                    model_version="15-ensemble-bootstrap",
                    created_at=meal_time - timedelta(minutes=5),
                    actual_peak_rise=rise,
                    actual_iauc_2h=iauc,
                    error=round(rise - pred_rise, 1),
                )
                db.add(pred)
            db.commit()

        # Recompute digital twin state to ensure memory count and confidence are active
        ts = recompute_twin_state(p.id, db)
        if "Cold Start" in p.display_name:
            ts.mem_n = 0
            ts.confidence_score = 0.0
            db.commit()
        elif ts.mem_n > 0 and ts.confidence_score < 0.6:
            ts.confidence_score = 0.82
            db.commit()

    logger.info("Indian & South Indian meal entries with twin prediction records verified.")

    # =========================================================================
    # 7. SEED 1-TAP SAVED SOUTH INDIAN & INDIAN MEALS
    # =========================================================================
    saved_south_indian_plates = [
        (
            "South Indian Breakfast: 2 Idlis + 1 Medu Vada + Sambar + Coconut Chutney",
            [
                {"name": "Steamed Idli (2 pcs)", "servings": 1, "carbs": 26.0, "protein": 4.8, "fat": 0.4, "calories": 128.0, "fiber": 2.2},
                {"name": "Medu Vada (1 pc)", "servings": 1, "carbs": 11.0, "protein": 3.4, "fat": 6.8, "calories": 118.0, "fiber": 1.8},
                {"name": "Vegetable Sambar", "servings": 1, "carbs": 9.0, "protein": 2.8, "fat": 1.6, "calories": 61.0, "fiber": 2.2},
                {"name": "Coconut Chutney", "servings": 1, "carbs": 2.0, "protein": 0.6, "fat": 5.0, "calories": 56.0, "fiber": 1.2},
            ],
            48.0, 11.6, 13.8, 363.0, 7.4,
        ),
        (
            "Crispy Masala Dosa + Tomato Onion Chutney",
            [
                {"name": "Masala Dosa with Potato Filling", "servings": 1, "carbs": 44.0, "protein": 6.5, "fat": 8.5, "calories": 275.0, "fiber": 4.2},
                {"name": "Tomato Onion Chutney", "servings": 1, "carbs": 4.5, "protein": 0.8, "fat": 2.2, "calories": 41.0, "fiber": 1.2},
            ],
            48.5, 7.3, 10.7, 316.0, 5.4,
        ),
        (
            "High-Protein Pesarattu (Green Moong Dosa) + Allam Pachadi",
            [
                {"name": "Pesarattu (Green Gram Dosa)", "servings": 1, "carbs": 24.0, "protein": 9.2, "fat": 3.5, "calories": 165.0, "fiber": 4.8},
                {"name": "Ginger Tomato Chutney", "servings": 1, "carbs": 4.5, "protein": 0.8, "fat": 2.2, "calories": 41.0, "fiber": 1.2},
            ],
            28.5, 10.0, 5.7, 206.0, 6.0,
        ),
        (
            "Comfort South Indian: Curd Rice (Thayir Sadam) + Vegetable Kootu",
            [
                {"name": "Curd Rice (Thayir Sadam)", "servings": 1, "carbs": 38.0, "protein": 5.8, "fat": 5.5, "calories": 225.0, "fiber": 1.2},
                {"name": "Kootu (Mixed Veg & Lentils)", "servings": 1, "carbs": 15.0, "protein": 6.2, "fat": 4.0, "calories": 120.0, "fiber": 4.2},
            ],
            53.0, 12.0, 9.5, 345.0, 5.4,
        ),
        (
            "Diabetic-Friendly: 2 Ragi Rotis + Palak Paneer + Salad",
            [
                {"name": "Ragi Roti (Finger Millet)", "servings": 2, "carbs": 42.0, "protein": 5.8, "fat": 2.4, "calories": 210.0, "fiber": 7.6},
                {"name": "Palak Paneer", "servings": 0.75, "carbs": 7.0, "protein": 10.8, "fat": 12.4, "calories": 184.0, "fiber": 3.4},
            ],
            49.0, 16.6, 14.8, 394.0, 11.0,
        ),
        (
            "Wholesome Thali: 2 Phulkas + Dal Tadka + Bhindi Fry",
            [
                {"name": "Roti (Whole Wheat Phulka)", "servings": 2, "carbs": 35.0, "protein": 6.4, "fat": 0.8, "calories": 170.0, "fiber": 5.6},
                {"name": "Yellow Dal Tadka", "servings": 1, "carbs": 22.0, "protein": 8.5, "fat": 4.5, "calories": 162.0, "fiber": 5.2},
            ],
            57.0, 14.9, 5.3, 332.0, 10.8,
        ),
        (
            "High-Fiber Adai (Mixed Lentil Dosa) + Mint Chutney",
            [
                {"name": "Adai (Mixed Lentil Dosa)", "servings": 1, "carbs": 28.0, "protein": 8.5, "fat": 4.2, "calories": 185.0, "fiber": 4.5},
                {"name": "Pudina Coconut Chutney", "servings": 1, "carbs": 3.2, "protein": 0.9, "fat": 3.5, "calories": 48.0, "fiber": 1.5},
            ],
            31.2, 9.4, 7.7, 233.0, 6.0,
        ),
    ]

    for p in seeded_patients:
        curr_saved = db.query(SavedMeal).filter(SavedMeal.patient_id == p.id).count()
        if curr_saved == 0:
            for title, items_list, c, pr, f, cal, fib in saved_south_indian_plates:
                sm = SavedMeal(
                    patient_id=p.id,
                    name=title,
                    items=items_list,
                    computed_carbs=c,
                    computed_protein=pr,
                    computed_fat=f,
                    computed_calories=cal,
                    computed_fiber=fib,
                )
                db.add(sm)
            db.commit()

    logger.info("Saved South Indian & Indian meal templates verified for all patients.")

    # =========================================================================
    # 8. SEED CLINICAL MEDICATIONS & DOSE LOGS
    # =========================================================================
    for p in seeded_patients:
        med_count = db.query(Medication).filter(Medication.patient_id == p.id).count()
        if med_count == 0:
            m1 = Medication(
                patient_id=p.id,
                name="Metformin Hydrochloride",
                dosage="500 mg" if "Titration" not in p.display_name else "1000 mg",
                schedule="morning",
                frequency_per_day=2,
                is_active=True,
            )
            m2 = Medication(
                patient_id=p.id,
                name="Empagliflozin (Jardiance)" if "CGMacros" in p.display_name else "Sitagliptin (Januvia)",
                dosage="10 mg" if "CGMacros" in p.display_name else "100 mg",
                schedule="morning",
                frequency_per_day=1,
                is_active=True,
            )
            db.add_all([m1, m2])
            db.commit()
            db.refresh(m1)
            db.refresh(m2)

            # Dose logs for past 7 days
            doses = []
            for d_off in range(7, -1, -1):
                d_time = now - timedelta(days=d_off)
                sched_am = d_time.replace(hour=8, minute=30, second=0, microsecond=0)
                sched_pm = d_time.replace(hour=20, minute=0, second=0, microsecond=0)

                doses.append(
                    DoseLog(
                        medication_id=m1.id,
                        patient_id=p.id,
                        dose=m1.dosage,
                        scheduled_time=sched_am,
                        taken_at=sched_am + timedelta(minutes=10) if d_off > 0 else (sched_am if now.hour >= 9 else None),
                        status="taken" if (d_off > 0 or now.hour >= 9) else "pending",
                        notes="Taken with breakfast",
                    )
                )
                doses.append(
                    DoseLog(
                        medication_id=m1.id,
                        patient_id=p.id,
                        dose=m1.dosage,
                        scheduled_time=sched_pm,
                        taken_at=sched_pm + timedelta(minutes=15) if d_off > 0 else (sched_pm if now.hour >= 20 else None),
                        status="taken" if (d_off > 0 or now.hour >= 20) else "pending",
                        notes="Taken with dinner",
                    )
                )
                doses.append(
                    DoseLog(
                        medication_id=m2.id,
                        patient_id=p.id,
                        dose=m2.dosage,
                        scheduled_time=sched_am,
                        taken_at=sched_am + timedelta(minutes=12) if d_off > 0 else (sched_am if now.hour >= 9 else None),
                        status="taken" if (d_off > 0 or now.hour >= 9) else "pending",
                        notes="Taken with water",
                    )
                )
            db.add_all(doses)
            db.commit()

    # =========================================================================
    # 9. SEED CLINICAL ALERTS ENGINE RULES & VISITS
    # =========================================================================
    from app.routers.alerts import evaluate_and_sync_alerts
    for p in seeded_patients:
        evaluate_and_sync_alerts(p.id, db)

        # Ensure completed past visit with SOAP notes
        past_v = db.query(Visit).filter(Visit.patient_id == p.id, Visit.status == "completed").first()
        if not past_v:
            v_date = now - timedelta(days=7)
            soap_text = (
                f"CLINICAL CONSULTATION SOAP NOTE\n"
                f"Date: {v_date.strftime('%Y-%m-%d')}\n"
                f"Attending Clinician: Dr. Rajesh Patel, MD [DOC-101] & Dr. Sarah Chen, MD [DOC-102]\n"
                f"Dietary Lead: Priya Sundaram, MSc, RD [DIET-202]\n\n"
                f"SUBJECTIVE:\n"
                f"Patient {p.display_name} reports good adherence to traditional balanced South Asian/South Indian meal "
                f"portions. Minimal symptomatic fatigue. Walking 15 minutes post-dinner has improved waking glucose.\n\n"
                f"OBJECTIVE:\n"
                f"- Fasting Blood Glucose: {p.fasting_glucose_mgdl} mg/dL\n"
                f"- Glycated Hemoglobin (HbA1c): {p.hba1c_pct}%\n"
                f"- Body Mass Index (BMI): {p.bmi} kg/m2\n"
                f"- 14-Day CGM Time-in-Range (70-180 mg/dL): {78.5 if p.hba1c_pct < 7.5 else (62.0 if p.hba1c_pct < 8.5 else 44.0)}%\n\n"
                f"ASSESSMENT:\n"
                f"Type 2 Diabetes Mellitus under active digital twin optimization. Glycemic excursions blunt significantly "
                f"when substituting refined rice with ragi, whole lentils (adai/pesarattu), and fiber preloads (kootu/salad).\n\n"
                f"PLAN:\n"
                f"1. Maintain current pharmacotherapy; evaluate SGLT2i or DPP-4i titration if HbA1c remains > 7.5%.\n"
                f"2. Continue 15-minute post-meal walks.\n"
                f"3. Priya (Dietitian) to follow up on South Indian carbohydrate swaps and protein distribution.\n"
                f"4. Next scheduled consult in 4 weeks."
            )
            v = Visit(
                patient_id=p.id,
                clinician_id=user_map["dr.patel@glucotwin.org"].id,
                scheduled_at=v_date,
                status="completed",
                notes=soap_text,
                pre_visit_summary={
                    "recent_mean_glucose": round(p.fasting_glucose_mgdl * 1.08, 1),
                    "tir_pct": 74.0 if p.hba1c_pct < 7.5 else 58.0,
                    "twin_confidence": 0.84,
                },
                final_plan={
                    "medication_decision": "Continue current regimen; review at next visit",
                    "lifestyle_targets": ["15m post-dinner walk", "Carbohydrate pacing"],
                },
                completed_at=v_date + timedelta(minutes=40),
            )
            db.add(v)
            db.commit()
            db.refresh(v)

            # Recommendation drafts
            db.add_all([
                RecommendationDraft(
                    visit_id=v.id,
                    patient_id=p.id,
                    category="lifestyle",
                    title="15-Minute Post-Dinner Walk Routine",
                    detail="Low-impact steady walk 20 minutes post-meal to activate non-insulin glucose uptake.",
                    status="approved",
                    payload={"walk_duration_min": 15},
                    clinician_comment="Endorsed by Dr. Patel based on digital twin simulation.",
                ),
                RecommendationDraft(
                    visit_id=v.id,
                    patient_id=p.id,
                    category="nutrition",
                    title="Carbohydrate Substitution: Ragi / Lentil Adai Swap",
                    detail="Replace refined white rice at dinner with high-fiber Ragi Roti or Green Gram Pesarattu.",
                    status="approved",
                    payload={"target_carbs_dinner": 35},
                    clinician_comment="Recommended by Priya Sundaram, RD [DIET-202].",
                ),
            ])
            db.commit()

        # Upcoming visit
        upcoming_v = db.query(Visit).filter(Visit.patient_id == p.id, Visit.status == "scheduled").first()
        if not upcoming_v:
            upcoming_v = Visit(
                patient_id=p.id,
                clinician_id=user_map["dr.chen@glucotwin.org"].id,
                scheduled_at=now + timedelta(days=12, hours=3),
                status="scheduled",
                notes="Upcoming comprehensive metabolic progress evaluation & twin memory review.",
                pre_visit_summary={"focus": "Review postprandial glucose curves and 4-week care plan adherence"},
            )
            db.add(upcoming_v)
            db.commit()

    logger.info("Clinical visits, SOAP notes, and alerts engine rules synchronized.")

    return {
        "patients": len(seeded_patients),
        "providers": len(providers_def),
        "foods_catalog": db.query(FoodItem).count(),
        "total_meals": db.query(MealEntry).count(),
        "total_readings": db.query(GlucoseReading).count(),
        "saved_meals": db.query(SavedMeal).count(),
    }
