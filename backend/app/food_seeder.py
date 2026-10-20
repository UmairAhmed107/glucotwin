import csv
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from sqlalchemy.orm import Session
from app.models_db import FoodItem, Medication, DoseLog, Patient

logger = logging.getLogger("glucotwin.food_seeder")


def seed_foods(db: Session) -> int:
    """
    Seed FoodItem table from bundled CSV if empty.
    Returns the count of seeded items.
    """
    existing_count = db.query(FoodItem).count()
    if existing_count > 0:
        logger.info(f"FoodItem table already contains {existing_count} records. Skipping seed.")
        return existing_count

    csv_path = Path(__file__).resolve().parent / "data" / "foods_seed.csv"
    if not csv_path.exists():
        logger.warning(f"foods_seed.csv not found at {csv_path}")
        return 0

    items_to_add = []
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            item = FoodItem(
                name=row["name"].strip(),
                serving_description=row["serving_description"].strip(),
                carbs=float(row["carbs"]),
                protein=float(row["protein"]),
                fat=float(row["fat"]),
                calories=float(row["calories"]),
                fiber=float(row.get("fiber", 0.0) or 0.0),
                category=row.get("category", "General").strip(),
                is_demo=True,
                disclaimer=row.get("disclaimer", "Approximate demo data for clinical educational testing").strip(),
            )
            items_to_add.append(item)

    if items_to_add:
        db.bulk_save_objects(items_to_add)
        db.commit()
        logger.info(f"Successfully seeded {len(items_to_add)} food items from {csv_path.name}.")

    return len(items_to_add)


def seed_demo_medications(db: Session) -> None:
    """
    Seed standard medications and recent dose logs for demo patients if not present.
    """
    patients = db.query(Patient).all()
    if not patients:
        return

    now = datetime.now(timezone.utc)

    for p in patients[:5]:
        med_count = db.query(Medication).filter(Medication.patient_id == p.id).count()
        if med_count == 0:
            # Create standard T2D meds: Metformin + Empagliflozin/Sitagliptin
            m1 = Medication(
                patient_id=p.id,
                name="Metformin Hydrochloride",
                dosage="500 mg",
                schedule="morning",
                frequency_per_day=2,
                is_active=True,
            )
            m2 = Medication(
                patient_id=p.id,
                name="Empagliflozin (Jardiance)",
                dosage="10 mg",
                schedule="morning",
                frequency_per_day=1,
                is_active=True,
            )
            db.add_all([m1, m2])
            db.commit()
            db.refresh(m1)
            db.refresh(m2)

            # Create 7-day dose logs for adherence calculations
            doses = []
            for day_offset in range(7, -1, -1):
                day_time = now - timedelta(days=day_offset)
                scheduled_am = day_time.replace(hour=8, minute=30, second=0, microsecond=0)
                scheduled_pm = day_time.replace(hour=20, minute=0, second=0, microsecond=0)

                # Morning metformin
                doses.append(
                    DoseLog(
                        medication_id=m1.id,
                        patient_id=p.id,
                        dose="500 mg",
                        scheduled_time=scheduled_am,
                        taken_at=scheduled_am + timedelta(minutes=15) if day_offset > 0 else (scheduled_am if now.hour >= 9 else None),
                        status="taken" if (day_offset > 0 or now.hour >= 9) else "pending",
                        notes="Taken with breakfast",
                    )
                )

                # Evening metformin
                doses.append(
                    DoseLog(
                        medication_id=m1.id,
                        patient_id=p.id,
                        dose="500 mg",
                        scheduled_time=scheduled_pm,
                        taken_at=scheduled_pm + timedelta(minutes=10) if day_offset > 0 else (scheduled_pm if now.hour >= 20 else None),
                        status="taken" if (day_offset > 0 or now.hour >= 20) else "pending",
                        notes="Taken with dinner",
                    )
                )

                # Morning empagliflozin
                doses.append(
                    DoseLog(
                        medication_id=m2.id,
                        patient_id=p.id,
                        dose="10 mg",
                        scheduled_time=scheduled_am,
                        taken_at=scheduled_am + timedelta(minutes=10) if day_offset > 0 else (scheduled_am if now.hour >= 9 else None),
                        status="taken" if (day_offset > 0 or now.hour >= 9) else "pending",
                        notes="Taken with glass of water",
                    )
                )

            db.add_all(doses)
            db.commit()
            logger.info(f"Seeded demo medications and dose logs for patient {p.id}")
