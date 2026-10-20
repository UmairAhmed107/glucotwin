#!/usr/bin/env python3
"""
scripts/seed_comprehensive_demo.py

Comprehensive Demonstration Seeder for GlucoTwin.
Seeds all tables with rich, realistic, clinically-grounded data so the user can
immediately give an end-to-end presentation to their professor without encountering
any permissions errors or empty states.

Key additions:
1. CareTeamLink: Links all clinicians (Dr. Chen, Dr. Patel) and dietitian (Elena)
   with 'active' status to all demo patients (Patients 3, 4, 5 and beyond).
2. GlucoseReadings: Continuous 14-day CGM telemetry for Patients 3, 4, 5 (700+ readings each)
   with realistic postprandial curves and circadian diurnal rhythms.
3. MealEntries & Predictions: Realistic breakfast, lunch, dinner entries with macronutrient
   profiles, observed peak rises, and corresponding model prediction records.
4. TwinState: Memory metrics (mem_n, mem_mean_rise, mem_mean_iauc, confidence) properly set.
5. WearableDaily: 14 days of step counts and sleep durations.
6. Medications & DoseLogs: Active T2D medications with 14 days of logged doses.
7. CarePlans & CarePlanTasks: Active 4-week metabolic care plans with milestone tasks.
8. Visits & RecommendationDrafts: Past completed consults with full SOAP notes and upcoming visits.
9. Alerts: Clinically-stratified alerts (hypoglycemia risk for Demo C, postprandial spikes for Demo A).
10. Messaging: Active care-team chat threads between patients, clinicians, and dietitians.
11. SavedScenarios & SavedMeals: Ready-to-compare what-if scenarios in the Simulation Lab.
"""

import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.db import SessionLocal, init_db
from app.auth import hash_password
from app.data_loader import data_loader
from app.models_db import (
    Alert,
    CarePlan,
    CarePlanTask,
    CareTeamLink,
    DoseLog,
    GlucoseReading,
    MealEntry,
    Medication,
    Message,
    MessageThread,
    Patient,
    PredictionRecord,
    Recommendation,
    RecommendationDraft,
    SavedMeal,
    SavedScenario,
    TwinState,
    User,
    Visit,
    WearableDaily,
    utcnow,
)
from app.twin.memory import recompute_twin_state, compute_confidence_score


def run_comprehensive_seeder():
    print("=" * 75)
    print("  GlucoTwin - Comprehensive Demo Data & Permissions Seeder")
    print("=" * 75)

    init_db()
    data_loader.load_all()
    db = SessionLocal()

    try:
        now = utcnow()
        default_pwd_hash = hash_password("Password123!")

        # ---------------------------------------------------------------------
        # 1. Ensure Core Users Exist
        # ---------------------------------------------------------------------
        users_def = [
            ("admin@glucotwin.org", "System Administrator", "admin"),
            ("dr.chen@glucotwin.org", "Dr. Sarah Chen, MD (Endocrinology)", "clinician"),
            ("dr.patel@glucotwin.org", "Dr. Rajesh Patel, MD (Internal Med)", "clinician"),
            ("elena.diet@glucotwin.org", "Elena Rostova, MS, RD, CDCES", "dietitian"),
            ("patient.a@glucotwin.org", "Arthur Dent (Demo A - Cold Start)", "patient"),
            ("patient.b@glucotwin.org", "Beatrix Kiddo (Demo B - Adapted Twin)", "patient"),
            ("patient.c@glucotwin.org", "Charles Xavier (Demo C - Shanghai Hypo)", "patient"),
        ]

        user_map = {}
        for email, full_name, role in users_def:
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(email=email, full_name=full_name, role=role, password_hash=default_pwd_hash)
                db.add(u)
                db.commit()
                db.refresh(u)
            else:
                u.full_name = full_name
                u.role = role
                u.password_hash = default_pwd_hash
                db.commit()
                db.refresh(u)
            user_map[email] = u
        print(f"[+] Verified {len(user_map)} core platform users.")

        # ---------------------------------------------------------------------
        # 2. Ensure Demo Patients Exist (IDs 3, 4, 5)
        # ---------------------------------------------------------------------
        # Demo A
        demo_a = db.query(Patient).filter(Patient.display_name.like("Demo A%")).first()
        if not demo_a:
            demo_a = Patient(
                display_name="Demo A [Cold Start]",
                is_synthetic=True,
                source="new",
                age=52,
                sex="M",
                bmi=28.4,
                hba1c_pct=7.6,
                fasting_glucose_mgdl=138.0,
                hypoglycemia_history=False,
                kidney_flag=False,
                current_meds=["metformin"],
                user_id=user_map["patient.a@glucotwin.org"].id,
            )
            db.add(demo_a)
            db.commit()
            db.refresh(demo_a)
        else:
            demo_a.user_id = user_map["patient.a@glucotwin.org"].id
            db.commit()

        # Demo B
        demo_b = db.query(Patient).filter(Patient.display_name.like("Demo B%")).first()
        if not demo_b:
            demo_b = Patient(
                display_name="Demo B [CGMacros #1]",
                is_synthetic=True,
                source="cgmacros",
                cgmacros_participant_id=1,
                age=45,
                sex="Female",
                bmi=26.2,
                hba1c_pct=6.8,
                fasting_glucose_mgdl=112.0,
                hypoglycemia_history=False,
                kidney_flag=False,
                current_meds=["metformin", "sglt2_inhibitor"],
                user_id=user_map["patient.b@glucotwin.org"].id,
            )
            db.add(demo_b)
            db.commit()
            db.refresh(demo_b)
        else:
            demo_b.user_id = user_map["patient.b@glucotwin.org"].id
            db.commit()

        # Demo C
        demo_c = db.query(Patient).filter(Patient.display_name.like("Demo C%")).first()
        if not demo_c:
            demo_c = Patient(
                display_name="Demo C [Shanghai Hypo]",
                is_synthetic=True,
                source="shanghai_profile",
                age=62,
                sex="Male",
                bmi=23.7,
                hba1c_pct=8.1,
                fasting_glucose_mgdl=142.0,
                hypoglycemia_history=True,  # Crucial for Safety Governor Rule R4
                kidney_flag=False,
                current_meds=["sulfonylurea"],
                user_id=user_map["patient.c@glucotwin.org"].id,
            )
            db.add(demo_c)
            db.commit()
            db.refresh(demo_c)
        else:
            demo_c.user_id = user_map["patient.c@glucotwin.org"].id
            demo_c.hypoglycemia_history = True
            db.commit()

        demo_patients = [demo_a, demo_b, demo_c]
        all_patients = db.query(Patient).all()
        print(f"[+] Verified Demo Patients: Demo A (ID: {demo_a.id}), Demo B (ID: {demo_b.id}), Demo C (ID: {demo_c.id}). Total in DB: {len(all_patients)}")

        # ---------------------------------------------------------------------
        # 3. FIX ALL CARE TEAM PERMISSIONS (No more 403 Forbidden!)
        # ---------------------------------------------------------------------
        providers = [
            (user_map["dr.chen@glucotwin.org"], "clinician"),
            (user_map["dr.patel@glucotwin.org"], "clinician"),
            (user_map["elena.diet@glucotwin.org"], "dietitian"),
        ]

        active_links_count = 0
        for patient in all_patients:
            for prov_user, role_in_team in providers:
                link = db.query(CareTeamLink).filter(
                    CareTeamLink.patient_id == patient.id,
                    CareTeamLink.provider_user_id == prov_user.id,
                ).first()
                if not link:
                    link = CareTeamLink(
                        patient_id=patient.id,
                        provider_user_id=prov_user.id,
                        role_in_team=role_in_team,
                        status="active",
                    )
                    db.add(link)
                else:
                    link.status = "active"
                    link.role_in_team = role_in_team
                active_links_count += 1
        db.commit()
        print(f"[+] Established {active_links_count} ACTIVE care-team links across all providers and patients.")

        # ---------------------------------------------------------------------
        # 4. Seed Continuous Glucose Telemetry (14 days of realistic CGM curves)
        # ---------------------------------------------------------------------
        for p in demo_patients:
            existing_readings_count = db.query(GlucoseReading).filter(GlucoseReading.patient_id == p.id).count()
            if existing_readings_count < 100:
                # Remove any sparse prior test readings to rebuild a smooth 14-day trace
                db.query(GlucoseReading).filter(GlucoseReading.patient_id == p.id).delete()
                db.commit()

                readings_to_add = []
                base_fasting = 100.0 if p.id == demo_b.id else (135.0 if p.id == demo_a.id else 138.0)
                random.seed(42 + p.id)

                for day_offset in range(14, -1, -1):
                    day_start = (now - timedelta(days=day_offset)).replace(hour=0, minute=0, second=0, microsecond=0)
                    # 96 readings per day (every 15 minutes)
                    for step in range(96):
                        t = day_start + timedelta(minutes=step * 15)
                        hour_frac = t.hour + t.minute / 60.0

                        # Circadian baseline fluctuation
                        circadian = 8.0 * math.sin((hour_frac - 6.0) * math.pi / 12.0)
                        glucose = base_fasting + circadian

                        # Postprandial rises: Breakfast (08:00), Lunch (12:30), Dinner (19:00)
                        for meal_hour, meal_spike in [(8.0, 42.0), (12.5, 36.0), (19.0, 52.0)]:
                            dt_hours = hour_frac - meal_hour
                            if 0.0 <= dt_hours <= 3.0:
                                # Skewed gamma-like curve reaching peak at 60 mins (1.0 hr)
                                rise = meal_spike * (dt_hours / 1.0) * math.exp(1.0 - (dt_hours / 1.0))
                                glucose += rise

                        # Add small physiological noise
                        glucose += random.uniform(-4.0, 4.0)

                        # For Demo C (Shanghai Hypoglycemia profile): inject 2 realistic nocturnal dips (< 70 mg/dL)
                        if p.id == demo_c.id and (day_offset in [1, 5]) and (2.5 <= hour_frac <= 4.0):
                            glucose = 62.0 + random.uniform(-4.0, 4.0)

                        glucose = max(52.0, min(340.0, glucose))

                        readings_to_add.append(
                            GlucoseReading(
                                patient_id=p.id,
                                ts=t,
                                value_mgdl=round(glucose, 1),
                                source="cgm_sensor",
                            )
                        )

                db.bulk_save_objects(readings_to_add)
                db.commit()
                print(f"[+] Seeded {len(readings_to_add)} CGM readings for {p.display_name} (14 days, 15-min intervals).")
            else:
                print(f"[OK] Patient {p.display_name} already has {existing_readings_count} CGM readings.")

        # ---------------------------------------------------------------------
        # 5. Seed Realistic Meals & Predictions
        # ---------------------------------------------------------------------
        sample_meals = [
            ("Steel-Cut Oatmeal with Blueberries & Chia", 44.0, 11.0, 9.0, 6.0, 310.0, 108.0, 0.15, 38.0, 36.0),
            ("Grilled Chicken, Quinoa & Avocado Bowl", 36.0, 38.0, 18.0, 8.0, 460.0, 114.0, 0.05, 28.0, 26.0),
            ("Wild Salmon with Brown Rice & Steamed Broccoli", 42.0, 34.0, 16.0, 5.0, 450.0, 118.0, -0.10, 34.0, 32.0),
            ("Greek Yogurt Parfait with Walnuts & Honey", 32.0, 20.0, 12.0, 3.0, 320.0, 102.0, 0.00, 25.0, 24.0),
            ("Turkey Whole Grain Wrap with Mixed Greens", 38.0, 26.0, 14.0, 6.0, 380.0, 115.0, 0.10, 31.0, 29.0),
            ("Tofu Vegetable Stir-Fry with Soba Noodles", 48.0, 22.0, 12.0, 7.0, 390.0, 116.0, 0.05, 39.0, 37.0),
            ("High-Carb Dinner: Rigatoni Bolognese with Garlic Bread", 88.0, 32.0, 26.0, 4.0, 720.0, 124.0, 0.20, 68.0, 65.0),
            ("Scrambled Eggs with Avocado & Sourdough Toast", 26.0, 22.0, 18.0, 4.0, 360.0, 106.0, -0.05, 22.0, 20.0),
            ("Lentil Soup with Whole Grain Pita", 52.0, 24.0, 8.0, 11.0, 380.0, 119.0, 0.10, 41.0, 40.0),
            ("Grilled Sirloin with Sweet Potato & Green Beans", 45.0, 42.0, 18.0, 6.0, 510.0, 115.0, 0.00, 35.0, 33.0),
        ]

        for p in demo_patients:
            if p.id == demo_a.id:
                # Keep Demo A strictly as cold-start patient (mem_n=0, wide uncertainty bands) per spec
                continue
            curr_meals = db.query(MealEntry).filter(MealEntry.patient_id == p.id).count()
            target_count = 25 if p.id == demo_b.id else 15

            if curr_meals < target_count:
                # Add meals distributed over the past 10 days
                added_meals = 0
                for day_idx in range(target_count):
                    m_template = sample_meals[day_idx % len(sample_meals)]
                    days_ago = (target_count - day_idx) * 0.4
                    meal_time = now - timedelta(days=days_ago)

                    # Macro perturbation
                    carbs = round(m_template[1] * random.uniform(0.9, 1.1), 1)
                    protein = round(m_template[2] * random.uniform(0.9, 1.1), 1)
                    fat = round(m_template[3] * random.uniform(0.9, 1.1), 1)
                    fiber = round(m_template[4] * random.uniform(0.9, 1.1), 1)
                    calories = round(carbs * 4 + protein * 4 + fat * 9, 0)
                    pre_g = round(m_template[6] + random.uniform(-6, 6), 1)
                    actual_rise = round(m_template[8] * (carbs / m_template[1]) + random.uniform(-3, 3), 1)
                    iauc = round(actual_rise * 1.8, 1)

                    meal = MealEntry(
                        patient_id=p.id,
                        logged_at=meal_time,
                        carbs_g=carbs,
                        protein_g=protein,
                        fat_g=fat,
                        fibre_g=fiber,
                        calories=calories,
                        pre_glucose=pre_g,
                        pre_trend30=m_template[7],
                        observed_peak_rise=actual_rise,
                        observed_iauc_2h=iauc,
                        observed_delta_60=round(actual_rise * 0.9, 1),
                        observed_delta_120=round(actual_rise * 0.3, 1),
                        activity_after_min=15.0 if day_idx % 2 == 0 else 0.0,
                    )
                    db.add(meal)
                    db.commit()
                    db.refresh(meal)

                    # Associated prediction record
                    pred_rise = round(actual_rise + random.uniform(-4, 4), 1)
                    p10 = round(pred_rise - 8.5, 1)
                    p90 = round(pred_rise + 9.2, 1)
                    pred = PredictionRecord(
                        patient_id=p.id,
                        meal_id=meal.id,
                        predicted_peak_rise=pred_rise,
                        p10=p10,
                        p90=p90,
                        model_version="15-ensemble-bootstrap",
                        created_at=meal_time - timedelta(minutes=5),
                        actual_peak_rise=actual_rise,
                        actual_iauc_2h=iauc,
                        error=round(actual_rise - pred_rise, 1),
                        in_range=(p10 <= actual_rise <= p90),
                        reconciled_at=meal_time + timedelta(hours=2),
                    )
                    db.add(pred)
                    added_meals += 1
                db.commit()
                print(f"[+] Added {added_meals} meals & predictions for {p.display_name}.")

        # ---------------------------------------------------------------------
        # 6. Recompute & Verify Twin States
        # ---------------------------------------------------------------------
        for p in demo_patients:
            ts = recompute_twin_state(p.id, db)
            print(f"[+] Twin state updated for {p.display_name}: mem_n={ts.mem_n}, conf={ts.confidence_score:.2f}, mem_rise={ts.mem_mean_rise}")

        # ---------------------------------------------------------------------
        # 7. Seed Daily Wearables Data (14 days of steps and sleep)
        # ---------------------------------------------------------------------
        for p in demo_patients:
            curr_wearables = db.query(WearableDaily).filter(WearableDaily.patient_id == p.id).count()
            if curr_wearables < 14:
                db.query(WearableDaily).filter(WearableDaily.patient_id == p.id).delete()
                db.commit()

                wearables_list = []
                for day_offset in range(14, 0, -1):
                    day_str = (now - timedelta(days=day_offset)).strftime("%Y-%m-%d")
                    # Realistic active days vs rest days
                    steps = random.randint(7200, 11500) if day_offset % 3 != 0 else random.randint(5400, 7000)
                    sleep = round(random.uniform(6.8, 8.3), 1)
                    wearables_list.append(
                        WearableDaily(
                            patient_id=p.id,
                            date=day_str,
                            steps=steps,
                            sleep_hours=sleep,
                            source="fitbit_health",
                        )
                    )
                db.bulk_save_objects(wearables_list)
                db.commit()
                print(f"[+] Seeded 14 daily wearable records for {p.display_name}.")

        # ---------------------------------------------------------------------
        # 8. Seed Medications & 14-Day Dose Logs (Adherence tracking)
        # ---------------------------------------------------------------------
        med_configs = {
            demo_a.id: [
                ("Metformin Hydrochloride", "500 mg", "morning", 2),
            ],
            demo_b.id: [
                ("Metformin Extended-Release", "1000 mg", "evening", 1),
                ("Empagliflozin (Jardiance)", "10 mg", "morning", 1),
            ],
            demo_c.id: [
                ("Glipizide (Glucotrol)", "5 mg", "morning", 1),
                ("Metformin Hydrochloride", "850 mg", "morning", 2),
            ],
        }

        for p in demo_patients:
            existing_meds = db.query(Medication).filter(Medication.patient_id == p.id).all()
            if not existing_meds:
                for name, dose, sched, freq in med_configs[p.id]:
                    med = Medication(
                        patient_id=p.id,
                        name=name,
                        dosage=dose,
                        schedule=sched,
                        frequency_per_day=freq,
                        is_active=True,
                    )
                    db.add(med)
                    db.commit()
                    db.refresh(med)

                    # 14 days of dose logs (95% adherence)
                    for day_offset in range(14, 0, -1):
                        d_time = (now - timedelta(days=day_offset)).replace(hour=8, minute=30, second=0)
                        status_choice = "taken" if random.random() > 0.08 else "skipped"
                        taken_time = d_time + timedelta(minutes=random.randint(5, 45)) if status_choice == "taken" else None
                        dl = DoseLog(
                            medication_id=med.id,
                            patient_id=p.id,
                            dose=dose,
                            scheduled_time=d_time,
                            taken_at=taken_time,
                            status=status_choice,
                            notes="Taken with breakfast" if status_choice == "taken" else "Forgot dose on travel",
                        )
                        db.add(dl)
                db.commit()
                print(f"[+] Seeded active medications and dose logs for {p.display_name}.")

        # ---------------------------------------------------------------------
        # 9. Seed 4-Week Care Plans & Tasks
        # ---------------------------------------------------------------------
        for p in demo_patients:
            active_plan = db.query(CarePlan).filter(CarePlan.patient_id == p.id, CarePlan.status == "active").first()
            if not active_plan:
                plan_title = f"4-Week Metabolic Optimization & Postprandial Blunting Plan"
                active_plan = CarePlan(
                    patient_id=p.id,
                    title=plan_title,
                    status="active",
                )
                db.add(active_plan)
                db.commit()
                db.refresh(active_plan)

                tasks_def = [
                    ("Log 3 Main Meals Daily", "Record macronutrients and pre-meal glucose before eating", -7, "monitoring", "completed"),
                    ("Pre-Meal Fiber Preload", "Consume raw salad greens or chia water 10 mins before high-carb dinners", -4, "lifestyle", "completed"),
                    ("15-Minute Post-Dinner Walk", "Take a light brisk walk within 30 minutes following dinner to activate GLUT4", -2, "lifestyle", "completed"),
                    ("Target 8,500 Daily Steps", "Maintain daily step average above 8,500 using wearable tracker", 2, "lifestyle", "in_progress"),
                    ("Carbohydrate Swap Practice", "Substitute white grains with quinoa or legumes twice this week", 5, "lifestyle", "in_progress"),
                    ("Continuous CGM Sensor Rotation", "Rotate continuous glucose monitoring sensor to alternate arm", 9, "monitoring", "pending"),
                    ("Follow-Up Clinical Encounter", "Review 14-day TIR report and medication tolerance with Dr. Chen", 14, "visit", "pending"),
                ]

                for t_title, t_desc, day_shift, cat, t_stat in tasks_def:
                    due = now + timedelta(days=day_shift)
                    comp_time = due if t_stat == "completed" else None
                    task = CarePlanTask(
                        care_plan_id=active_plan.id,
                        patient_id=p.id,
                        title=t_title,
                        description=t_desc,
                        due_date=due,
                        category=cat,
                        assigned_to="patient",
                        status=t_stat,
                        completed_at=comp_time,
                    )
                    db.add(task)
                db.commit()
                print(f"[+] Seeded 4-week care plan & tasks for {p.display_name}.")

        # ---------------------------------------------------------------------
        # 10. Seed Clinical Visits (Encounters) & SOAP Notes
        # ---------------------------------------------------------------------
        for p in demo_patients:
            past_visit = db.query(Visit).filter(Visit.patient_id == p.id, Visit.status == "completed").first()
            if not past_visit:
                past_date = now - timedelta(days=8)
                soap_notes = (
                    f"CLINICAL CONSULTATION SOAP NOTE\n"
                    f"Date: {past_date.strftime('%Y-%m-%d')}\n"
                    f"Clinician: Dr. Sarah Chen, MD (Endocrinology)\n\n"
                    f"SUBJECTIVE:\n"
                    f"Patient reports improved post-meal energy levels following introduction of 15-minute post-dinner walks. "
                    f"No symptoms of symptomatic hypoglycemia or palpitations.\n\n"
                    f"OBJECTIVE:\n"
                    f"- Fasting Blood Glucose: {p.fasting_glucose_mgdl} mg/dL\n"
                    f"- Baseline HbA1c: {p.hba1c_pct}%\n"
                    f"- 14-Day Time-in-Range (TIR 70-180 mg/dL): 78.4%\n"
                    f"- Mean CGM Glucose: 132 mg/dL, Glycemic Variability CV: 28.2%\n\n"
                    f"ASSESSMENT:\n"
                    f"Type 2 Diabetes Mellitus with promising response to metabolic twin lifestyle counterfactuals. "
                    f"Twin accuracy MAE is within 6.8 mg/dL across logged meals.\n\n"
                    f"PLAN:\n"
                    f"1. Continue current medication regimen.\n"
                    f"2. Maintain post-meal walking intervention.\n"
                    f"3. Elena (Dietitian) to review dinner carbohydrate substitutions.\n"
                    f"4. Follow-up consult in 3 weeks with updated CGM sensor report."
                )

                past_visit = Visit(
                    patient_id=p.id,
                    clinician_id=user_map["dr.chen@glucotwin.org"].id,
                    scheduled_at=past_date,
                    status="completed",
                    notes=soap_notes,
                    pre_visit_summary={
                        "recent_mean_glucose": 132.0,
                        "tir_pct": 78.4,
                        "twin_accuracy_mae": 6.8,
                        "confidence_score": 0.85,
                    },
                    final_plan={
                        "medication_decision": "Maintain Metformin + SGLT2i",
                        "lifestyle_targets": ["15m post-dinner walk", "8,500 steps daily"],
                    },
                    completed_at=past_date + timedelta(minutes=45),
                )
                db.add(past_visit)
                db.commit()
                db.refresh(past_visit)

                # Add recommendation drafts
                d1 = RecommendationDraft(
                    visit_id=past_visit.id,
                    patient_id=p.id,
                    category="lifestyle",
                    title="15-Minute Postprandial Walking Routine",
                    detail="Engage in low-to-moderate walking starting 20 minutes after largest meal to blunt glycemic excursion.",
                    status="approved",
                    payload={"walk_duration_min": 15, "intensity": "moderate"},
                    clinician_comment="Endorsed based on twin what-if simulation demonstrating -28 mg/dL spike reduction.",
                )
                d2 = RecommendationDraft(
                    visit_id=past_visit.id,
                    patient_id=p.id,
                    category="therapy",
                    title="Evaluate Second-Line SGLT2-Inhibitor Optimization",
                    detail="Consider SGLT2i for cardiorenal metabolic risk reduction and glycemic stabilization.",
                    status="approved",
                    payload={"drug_class": "sglt2_inhibitor"},
                    clinician_comment="Verified against renal function and safety governor checks.",
                )
                db.add_all([d1, d2])
                db.commit()

            # Upcoming visit
            upcoming_visit = db.query(Visit).filter(Visit.patient_id == p.id, Visit.status == "scheduled").first()
            if not upcoming_visit:
                upcoming_date = now + timedelta(days=6, hours=2)
                upcoming_visit = Visit(
                    patient_id=p.id,
                    clinician_id=user_map["dr.chen@glucotwin.org"].id,
                    scheduled_at=upcoming_date,
                    status="scheduled",
                    notes="Upcoming comprehensive metabolic progress evaluation & twin memory review.",
                    pre_visit_summary={
                        "focus": "Review 4-week care plan adherence and postprandial glucose curves",
                    },
                )
                db.add(upcoming_visit)
                db.commit()
                print(f"[+] Seeded clinical visits and SOAP documentation for {p.display_name}.")

        # ---------------------------------------------------------------------
        # 11. Seed Stratified Metabolic Alerts
        # ---------------------------------------------------------------------
        alerts_def = [
            # Demo C: Hypoglycemia Alert
            (
                demo_c.id,
                "R4_HYPOGLYCEMIA_EVENT",
                "critical",
                "Nocturnal hypoglycemia detected: CGM recorded 58 mg/dL at 03:15 AM. Patient is currently prescribed Sulfonylurea (Glipizide). Immediate care-team review recommended.",
                "open",
            ),
            # Demo A: Postprandial Spike
            (
                demo_a.id,
                "ELEVATED_POSTPRANDIAL_SPIKE",
                "warning",
                "Repeated postprandial spikes exceeding 200 mg/dL (+68 mg/dL peak rise) detected following high-glycemic dinners.",
                "acknowledged",
            ),
            # Demo B: Twin Milestone
            (
                demo_b.id,
                "TWIN_CALIBRATION_MILESTONE",
                "info",
                "Metabolic Twin calibrated with high confidence (85%). Prediction intervals have narrowed to ±8.5 mg/dL across standard meals.",
                "resolved",
            ),
        ]

        for pat_id, rule_k, sev, msg, stat in alerts_def:
            alert = db.query(Alert).filter(Alert.patient_id == pat_id, Alert.rule_key == rule_k).first()
            if not alert:
                alert = Alert(
                    patient_id=pat_id,
                    rule_key=rule_k,
                    severity=sev,
                    message=msg,
                    status=stat,
                    created_at=now - timedelta(days=1),
                    acknowledged_by=user_map["dr.chen@glucotwin.org"].id if stat != "open" else None,
                    acknowledged_at=now - timedelta(hours=6) if stat != "open" else None,
                )
                db.add(alert)
        db.commit()
        print("[+] Seeded stratified clinical alerts (critical, warning, info).")

        # ---------------------------------------------------------------------
        # 12. Seed Care Team Messaging Conversations
        # ---------------------------------------------------------------------
        msg_threads_data = [
            (
                demo_b.id,
                "Post-Dinner Walking Strategy & Spike Reduction",
                "scenario",
                user_map["patient.b@glucotwin.org"].id,
                [
                    (user_map["patient.b@glucotwin.org"].id, "Hi Dr. Chen & Elena, I tested the 15-minute post-dinner walk simulation after pasta last night. My peak rise only went up +26 mg/dL instead of the usual +65!"),
                    (user_map["elena.diet@glucotwin.org"].id, "That is fantastic Beatrix! Walking immediately after eating stimulates muscle GLUT4 translocation independent of insulin, which dramatically blunts the peak."),
                    (user_map["dr.chen@glucotwin.org"].id, "Excellent empirical result, Beatrix. The twin simulation predicted a 28 mg/dL reduction, so your metabolic response matched the ensemble closely. Keep this up as your routine."),
                ]
            ),
            (
                demo_c.id,
                "Hypoglycemia Precaution & Medication Adjustment",
                "alert",
                user_map["dr.patel@glucotwin.org"].id,
                [
                    (user_map["dr.patel@glucotwin.org"].id, "Marcus, I reviewed your continuous telemetry and saw a nocturnal dip to 58 mg/dL at 3 AM. If you feel dizzy or shaky, take 15g of fast carbs immediately. We will discuss tapering your Glipizide."),
                    (user_map["patient.c@glucotwin.org"].id, "Thank you Dr. Patel. I felt slightly clammy, drank 4 oz of juice and recovered to 110 mg/dL within 20 minutes."),
                    (user_map["elena.diet@glucotwin.org"].id, "I also recommend a small complex bedtime snack (e.g. 1 tablespoon almond butter on a whole grain cracker) to stabilize overnight glucose."),
                ]
            ),
            (
                demo_a.id,
                "Carbohydrate Swaps for Morning Breakfast",
                "general",
                user_map["patient.a@glucotwin.org"].id,
                [
                    (user_map["patient.a@glucotwin.org"].id, "Elena, my morning bagel causes a rapid rise to 185 mg/dL. What would be a satisfying lower-glycemic alternative?"),
                    (user_map["elena.diet@glucotwin.org"].id, "Hi Arthur! Try steel-cut oats with chia seeds and a handful of walnuts, or two eggs with half an avocado on seeded sourdough toast."),
                ]
            ),
        ]

        for pat_id, title, topic_type, creator_id, msgs in msg_threads_data:
            thread = db.query(MessageThread).filter(MessageThread.patient_id == pat_id, MessageThread.title == title).first()
            if not thread:
                thread = MessageThread(
                    patient_id=pat_id,
                    title=title,
                    topic_type=topic_type,
                    created_by=creator_id,
                    created_at=now - timedelta(days=2),
                )
                db.add(thread)
                db.commit()
                db.refresh(thread)

                for sender_id, text in msgs:
                    m = Message(
                        thread_id=thread.id,
                        sender_id=sender_id,
                        content=text,
                        read_by=[creator_id, user_map["dr.chen@glucotwin.org"].id, user_map["elena.diet@glucotwin.org"].id],
                        created_at=now - timedelta(hours=random.randint(1, 36)),
                    )
                    db.add(m)
                db.commit()
        print("[+] Seeded active multi-party care-team messaging threads.")

        # ---------------------------------------------------------------------
        # 13. Seed Saved Scenarios (Simulation Lab)
        # ---------------------------------------------------------------------
        for p in demo_patients:
            curr_scenarios = db.query(SavedScenario).filter(SavedScenario.patient_id == p.id).count()
            if curr_scenarios == 0:
                scen1 = SavedScenario(
                    patient_id=p.id,
                    name="Carb Reduction (25%) + 15m Post-Meal Walk",
                    description="Standard lunch with 25% carbohydrate curtailment plus 15 minutes of light-moderate walking.",
                    inputs={
                        "meal": {"carbs": 60.0, "protein": 25.0, "fat": 15.0, "pre_glucose": 110.0},
                        "interventions": {"carb_reduction_pct": 25.0, "post_meal_walk": True, "walk_duration_min": 15},
                    },
                    baseline_output={"median": 52.4, "p10": 42.1, "p90": 63.8},
                    intervention_output={"median": 26.8, "p10": 18.2, "p90": 34.5},
                )
                scen2 = SavedScenario(
                    patient_id=p.id,
                    name="Refined Pasta to Quinoa Swap + Veggies First",
                    description="Nutritional order modification: salad preload followed by protein and slow-digesting whole quinoa.",
                    inputs={
                        "meal": {"carbs": 45.0, "protein": 30.0, "fat": 12.0, "pre_glucose": 112.0},
                        "interventions": {"carb_reduction_pct": 15.0, "meal_order": "veggies_protein_first"},
                    },
                    baseline_output={"median": 48.0, "p10": 38.5, "p90": 58.2},
                    intervention_output={"median": 29.5, "p10": 21.0, "p90": 37.0},
                )
                db.add_all([scen1, scen2])
                db.commit()
                print(f"[+] Seeded Simulation Lab saved scenarios for {p.display_name}.")

        # ---------------------------------------------------------------------
        # 14. Seed Saved Favorite Meals
        # ---------------------------------------------------------------------
        fav_meals_def = [
            ("Mediterranean Grilled Chicken & Quinoa", 38.0, 36.0, 14.0, 420.0, 7.0),
            ("Baked Salmon with Steamed Greens & Sweet Potato", 42.0, 32.0, 16.0, 440.0, 6.0),
            ("Berry Chia Seed Oatmeal with Greek Yogurt", 36.0, 22.0, 8.0, 310.0, 8.0),
        ]
        for p in demo_patients:
            curr_favs = db.query(SavedMeal).filter(SavedMeal.patient_id == p.id).count()
            if curr_favs == 0:
                for m_name, c, pr, f, cal, fib in fav_meals_def:
                    sm = SavedMeal(
                        patient_id=p.id,
                        name=m_name,
                        items=[{"name": m_name, "servings": 1, "carbs": c, "protein": pr, "fat": f, "calories": cal, "fiber": fib}],
                        computed_carbs=c,
                        computed_protein=pr,
                        computed_fat=f,
                        computed_calories=cal,
                        computed_fiber=fib,
                    )
                    db.add(sm)
                db.commit()
                print(f"[+] Seeded favorite meal templates for {p.display_name}.")

        print("=" * 75)
        print("  ALL DEMO DATA SUCCESSFULLY SEEDED & VERIFIED!")
        print("=" * 75)

    finally:
        db.close()


if __name__ == "__main__":
    run_comprehensive_seeder()
