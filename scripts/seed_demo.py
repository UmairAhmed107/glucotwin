#!/usr/bin/env python3
"""
scripts/seed_demo.py

Seeds the GlucoTwin database with 3 labelled synthetic demo patients:
  (a) "Demo A" - Brand-new patient with cold-start twin state (mem_n=0, wide uncertainty bands).
  (b) "Demo B" - Synthetic patient linked to a CGMacros participant (#1), seeded with 30+ meals.
  (c) "Demo C" - Synthetic patient from a Shanghai-style clinical profile with hypoglycemia history = True.

IDEMPOTENT: Running this script multiple times updates or verifies the existing demo patients
without creating duplicates.
"""

import os
import sys
from pathlib import Path

# Add backend directory to path so app modules can be imported directly
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.data_loader import data_loader
from app.db import SessionLocal, init_db
from app.models_db import CareTeamLink, Patient, TwinState, User
from app.auth import hash_password
from app.twin.memory import recompute_twin_state


def seed_demo_patients():
    print("=" * 70)
    print("  GlucoTwin Demo Seeding - Users, Care Teams, & Patients")
    print("=" * 70)

    # 1. Initialize DB tables
    init_db()

    # 2. Ensure data loader has loaded datasets
    data_loader.load_all()

    db = SessionLocal()
    try:
        # =====================================================================
        # 1. Seed Users (1 admin, 2 clinicians, 1 dietitian, 3 patients)
        # =====================================================================
        default_pwd_hash = hash_password("Password123!")
        
        users_to_seed = [
            ("admin@glucotwin.org", "System Administrator", "admin"),
            ("dr.chen@glucotwin.org", "Dr. Sarah Chen, MD", "clinician"),
            ("dr.patel@glucotwin.org", "Dr. Rajesh Patel, MD", "clinician"),
            ("elena.diet@glucotwin.org", "Elena Rostova, RD", "dietitian"),
            ("patient.a@glucotwin.org", "Arthur Dent (Demo A)", "patient"),
            ("patient.b@glucotwin.org", "Beatrix Kiddo (Demo B)", "patient"),
            ("patient.c@glucotwin.org", "Charles Xavier (Demo C)", "patient"),
        ]

        seeded_users = {}
        for email, full_name, role in users_to_seed:
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
                print(f" [+] Created User: {email} ({role})")
            else:
                user.full_name = full_name
                user.role = role
                db.commit()
                db.refresh(user)
                print(f" [OK] Verified User: {email} ({role})")
            seeded_users[email] = user

        # =====================================================================
        # (a) Demo A: Brand-new patient with cold start (mem_n=0)
        # =====================================================================
        demo_a = db.query(Patient).filter(Patient.display_name.like("Demo A%")).first()
        if not demo_a:
            demo_a = Patient(
                display_name="Demo A [Cold Start]",
                is_synthetic=True,
                source="new",
                cgmacros_participant_id=None,
                age=52,
                sex="M",
                bmi=28.4,
                hba1c_pct=7.6,
                fasting_glucose_mgdl=138.0,
                hypoglycemia_history=False,
                kidney_flag=False,
                current_meds=["metformin"],
            )
            db.add(demo_a)
            db.commit()
            db.refresh(demo_a)
            print(f" [+] Created Demo A (ID: {demo_a.id}) - Cold-start patient (mem_n=0)")
        else:
            demo_a.display_name = "Demo A [Cold Start]"
            demo_a.is_synthetic = True
            demo_a.source = "new"
            demo_a.cgmacros_participant_id = None
            demo_a.age = 52
            demo_a.sex = "M"
            demo_a.bmi = 28.4
            demo_a.hba1c_pct = 7.6
            demo_a.fasting_glucose_mgdl = 138.0
            demo_a.hypoglycemia_history = False
            demo_a.kidney_flag = False
            demo_a.current_meds = ["metformin"]
            db.commit()
            db.refresh(demo_a)
            print(f" [OK] Verified Demo A (ID: {demo_a.id}) - Cold-start patient (mem_n=0)")

        # Recompute twin state for Demo A (will have mem_n=0, baseline used)
        ts_a = recompute_twin_state(demo_a.id, db)
        print(f"     Twin state: mem_n={ts_a.mem_n}, confidence={ts_a.confidence_score:.2f}, baseline_used=True")

        # =====================================================================
        # (b) Demo B: Synthetic patient linked to a CGMacros participant
        # =====================================================================
        demo_b = db.query(Patient).filter(Patient.display_name.like("Demo B%")).first()
        
        # Determine available CGMacros participant ID (defaults to 1 in full dataset)
        cg_id = 1
        if data_loader.meals_df is not None and not data_loader.meals_df.empty:
            avail_pids = data_loader.meals_df["patient_id"].unique()
            if 1 in avail_pids:
                cg_id = 1
            elif len(avail_pids) > 0:
                cg_id = int(avail_pids[0])

        # Demographic metrics from participant if bio file is available
        cg_age = 45
        cg_sex = "Female"
        cg_bmi = 26.2
        cg_hba1c = 6.8
        cg_fpg = 112.0
        if data_loader.is_bio_available and data_loader.bio_df is not None:
            try:
                prof = data_loader.get_cgmacros_profile(cg_id)
                cg_age = prof["age"]
                cg_sex = prof["sex"]
                cg_bmi = prof["bmi"]
                cg_hba1c = prof["hba1c_pct"]
                cg_fpg = prof["fasting_glucose_mgdl"]
            except Exception:
                pass

        if not demo_b:
            demo_b = Patient(
                display_name=f"Demo B [CGMacros #{cg_id}]",
                is_synthetic=True,
                source="cgmacros",
                cgmacros_participant_id=cg_id,
                age=cg_age,
                sex=cg_sex,
                bmi=cg_bmi,
                hba1c_pct=cg_hba1c,
                fasting_glucose_mgdl=cg_fpg,
                hypoglycemia_history=None,  # unknown per spec D2
                kidney_flag=False,
                current_meds=[],
            )
            db.add(demo_b)
            db.commit()
            db.refresh(demo_b)
            print(f" [+] Created Demo B (ID: {demo_b.id}) - Linked to CGMacros participant #{cg_id}")
        else:
            demo_b.display_name = f"Demo B [CGMacros #{cg_id}]"
            demo_b.is_synthetic = True
            demo_b.source = "cgmacros"
            demo_b.cgmacros_participant_id = cg_id
            demo_b.age = cg_age
            demo_b.sex = cg_sex
            demo_b.bmi = cg_bmi
            demo_b.hba1c_pct = cg_hba1c
            demo_b.fasting_glucose_mgdl = cg_fpg
            demo_b.hypoglycemia_history = None
            demo_b.kidney_flag = False
            db.commit()
            db.refresh(demo_b)
            print(f" [OK] Verified Demo B (ID: {demo_b.id}) - Linked to CGMacros participant #{cg_id}")

        # Recompute twin state for Demo B (seeds from CGMacros participant meals)
        ts_b = recompute_twin_state(demo_b.id, db)
        print(f"     Twin state: mem_n={ts_b.mem_n}, confidence={ts_b.confidence_score:.2f}, mem_rise={ts_b.mem_mean_rise}")

        # =====================================================================
        # (c) Demo C: Shanghai-style profile with hypoglycemia history = True
        # =====================================================================
        demo_c = db.query(Patient).filter(Patient.display_name.like("Demo C%")).first()

        sh_age = 62
        sh_sex = "Male"
        sh_bmi = 23.7
        sh_hba1c = 8.1
        sh_fpg = 142.0
        if data_loader.is_shanghai_available and data_loader.shanghai_df is not None:
            try:
                prof_c = data_loader.get_shanghai_profile(2000)
                sh_age = prof_c["age"]
                sh_sex = prof_c["sex"]
                sh_bmi = prof_c["bmi"]
                sh_hba1c = prof_c["hba1c_pct"]
                sh_fpg = prof_c["fasting_glucose_mgdl"]
            except Exception:
                pass

        if not demo_c:
            demo_c = Patient(
                display_name="Demo C [Shanghai Hypo]",
                is_synthetic=True,
                source="shanghai_profile",
                cgmacros_participant_id=None,
                age=sh_age,
                sex=sh_sex,
                bmi=sh_bmi,
                hba1c_pct=sh_hba1c,
                fasting_glucose_mgdl=sh_fpg,
                hypoglycemia_history=True,  # Mandatory true for Demo C
                kidney_flag=False,
                current_meds=["sulfonylurea"],
            )
            db.add(demo_c)
            db.commit()
            db.refresh(demo_c)
            print(f" [+] Created Demo C (ID: {demo_c.id}) - Shanghai profile (hypoglycemia_history=True)")
        else:
            demo_c.display_name = "Demo C [Shanghai Hypo]"
            demo_c.is_synthetic = True
            demo_c.source = "shanghai_profile"
            demo_c.cgmacros_participant_id = None
            demo_c.age = sh_age
            demo_c.sex = sh_sex
            demo_c.bmi = sh_bmi
            demo_c.hba1c_pct = sh_hba1c
            demo_c.fasting_glucose_mgdl = sh_fpg
            demo_c.hypoglycemia_history = True
            demo_c.kidney_flag = False
            db.commit()
            db.refresh(demo_c)
            print(f" [OK] Verified Demo C (ID: {demo_c.id}) - Shanghai profile (hypoglycemia_history=True)")

        # Link patient users
        demo_a.user_id = seeded_users["patient.a@glucotwin.org"].id
        demo_b.user_id = seeded_users["patient.b@glucotwin.org"].id
        demo_c.user_id = seeded_users["patient.c@glucotwin.org"].id
        db.commit()

        # =====================================================================
        # 3. Seed Care Team Links (All Active for Smooth Demonstrations)
        # =====================================================================
        care_links = [
            (demo_a.id, seeded_users["dr.chen@glucotwin.org"].id, "clinician", "active"),
            (demo_a.id, seeded_users["dr.patel@glucotwin.org"].id, "clinician", "active"),
            (demo_a.id, seeded_users["elena.diet@glucotwin.org"].id, "dietitian", "active"),
            (demo_b.id, seeded_users["dr.chen@glucotwin.org"].id, "clinician", "active"),
            (demo_b.id, seeded_users["dr.patel@glucotwin.org"].id, "clinician", "active"),
            (demo_b.id, seeded_users["elena.diet@glucotwin.org"].id, "dietitian", "active"),
            (demo_c.id, seeded_users["dr.chen@glucotwin.org"].id, "clinician", "active"),
            (demo_c.id, seeded_users["dr.patel@glucotwin.org"].id, "clinician", "active"),
            (demo_c.id, seeded_users["elena.diet@glucotwin.org"].id, "dietitian", "active"),
        ]

        for pat_id, prov_id, role_in_team, status in care_links:
            link = (
                db.query(CareTeamLink)
                .filter(
                    CareTeamLink.patient_id == pat_id,
                    CareTeamLink.provider_user_id == prov_id,
                )
                .first()
            )
            if not link:
                link = CareTeamLink(
                    patient_id=pat_id,
                    provider_user_id=prov_id,
                    role_in_team=role_in_team,
                    status=status,
                )
                db.add(link)
                db.commit()
            else:
                link.role_in_team = role_in_team
                link.status = status
                db.commit()

        print(" [+] Seeded care-team link network (all active provider partnerships)")

        # Evaluate and seed initial clinical alerts for demo patients
        from app.routers.alerts import evaluate_and_sync_alerts
        evaluate_and_sync_alerts(demo_a.id, db)
        evaluate_and_sync_alerts(demo_b.id, db)
        evaluate_and_sync_alerts(demo_c.id, db)
        print(" [+] Evaluated and seeded initial clinical alerts engine rules")

        print("=" * 70)
        print("  DEMO CREDENTIALS TABLE - GlucoTwin Authentication & RBAC")
        print("=" * 70)
        print(f" {'Role':<12} | {'Email':<28} | {'Password':<15} | {'Notes'}")
        print("-" * 70)
        print(f" {'admin':<12} | {'admin@glucotwin.org':<28} | {'Password123!':<15} | Full system access")
        print(f" {'clinician':<12} | {'dr.chen@glucotwin.org':<28} | {'Password123!':<15} | Links: Demo A, Demo B")
        print(f" {'clinician':<12} | {'dr.patel@glucotwin.org':<28} | {'Password123!':<15} | Links: Demo C, (Pending B)")
        print(f" {'dietitian':<12} | {'elena.diet@glucotwin.org':<28} | {'Password123!':<15} | Links: Demo A, (Pending C)")
        print(f" {'patient':<12} | {'patient.a@glucotwin.org':<28} | {'Password123!':<15} | Patient profile #{demo_a.id}")
        print(f" {'patient':<12} | {'patient.b@glucotwin.org':<28} | {'Password123!':<15} | Patient profile #{demo_b.id}")
        print(f" {'patient':<12} | {'patient.c@glucotwin.org':<28} | {'Password123!':<15} | Patient profile #{demo_c.id}")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_patients()
    from seed_comprehensive_demo import run_comprehensive_seeder
    run_comprehensive_seeder()

