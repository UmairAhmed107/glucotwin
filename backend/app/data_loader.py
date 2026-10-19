import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
from app.config import settings

logger = logging.getLogger("glucotwin.data_loader")


class BioDataUnavailableException(Exception):
    """Raised when CGMacros bio demographics are requested but the bio file is unavailable."""
    pass


class ShanghaiDataUnavailableException(Exception):
    """Raised when Shanghai clinical profile data is unavailable."""
    pass


class DataLoader:
    def __init__(self):
        self.meals_df: Optional[pd.DataFrame] = None
        self.shanghai_df: Optional[pd.DataFrame] = None
        self.bio_df: Optional[pd.DataFrame] = None
        self.model_manifest: Optional[Dict[str, Any]] = None
        self.is_bio_available: bool = False
        self.is_shanghai_available: bool = False
        self.is_meals_available: bool = False

    def load_all(self, models_dir: Optional[Path] = None) -> None:
        """Load datasets and manifest from the specified directory or settings."""
        dir_path = models_dir or settings.models_dir

        # 1. Load model_manifest.json
        manifest_path = dir_path / "model_manifest.json"
        if manifest_path.exists():
            try:
                with open(manifest_path, "r", encoding="utf-8") as f:
                    self.model_manifest = json.load(f)
                logger.info("Loaded model_manifest.json successfully.")
            except Exception as e:
                logger.error(f"Error loading model_manifest.json: {e}")
                self.model_manifest = None
        else:
            logger.warning(f"model_manifest.json not found in {dir_path}")

        # 2. Load meals_db.pkl
        meals_path = dir_path / "meals_db.pkl"
        if meals_path.exists():
            try:
                self.meals_df = pd.read_pickle(meals_path)
                self.is_meals_available = True
                logger.info(f"Loaded meals_db.pkl: {self.meals_df.shape[0]} rows.")
            except Exception as e:
                logger.error(f"Failed to load meals_db.pkl: {e}")
                self.meals_df = None
                self.is_meals_available = False
        else:
            logger.warning(f"meals_db.pkl not found at {meals_path}")

        # 3. Load shanghai_clinical.pkl
        shanghai_path = dir_path / "shanghai_clinical.pkl"
        if shanghai_path.exists():
            try:
                self.shanghai_df = pd.read_pickle(shanghai_path)
                self.is_shanghai_available = True
                logger.info(f"Loaded shanghai_clinical.pkl: {self.shanghai_df.shape[0]} rows.")
            except Exception as e:
                logger.error(f"Failed to load shanghai_clinical.pkl: {e}")
                self.shanghai_df = None
                self.is_shanghai_available = False
        else:
            logger.warning(f"shanghai_clinical.pkl not found at {shanghai_path}")

        # 4. Load CGMacros bio file (bio.csv)
        bio_path = dir_path / "bio.csv"
        if bio_path.exists():
            try:
                self.bio_df = pd.read_csv(bio_path)
                self.is_bio_available = True
                logger.info(f"Loaded bio.csv: {self.bio_df.shape[0]} participants.")
            except Exception as e:
                logger.warning(f"Error reading bio.csv: {e}. CGMacros participant loading disabled.")
                self.bio_df = None
                self.is_bio_available = False
        else:
            logger.warning("CGMacros bio file (bio.csv) missing! 'load CGMacros participant' is disabled.")
            self.bio_df = None
            self.is_bio_available = False

    def get_manifest(self) -> Dict[str, Any]:
        """Return model manifest data or sensible default."""
        return self.model_manifest or {}

    def get_cgmacros_dropdown(self) -> List[Dict[str, Any]]:
        """Return short summaries of available CGMacros participants for dropdowns."""
        if not self.is_bio_available or self.bio_df is None:
            raise BioDataUnavailableException("CGMacros participant demographics are unavailable because the bio file is missing.")

        dropdown = []
        for _, row in self.bio_df.iterrows():
            sub_id = int(row["subject"])
            age = int(row["Age"])
            gender = str(row["Gender"]).strip()
            bmi = round(float(row["BMI"]), 1)
            a1c = round(float(row["A1c PDL (Lab)"]), 1)
            fpg = round(float(row["Fasting GLU - PDL (Lab)"]), 1)
            summary = f"Age {age}, {gender}, BMI {bmi}, HbA1c {a1c}%, FPG {fpg} mg/dL"
            dropdown.append({"id": sub_id, "summary": summary})
        return dropdown

    def get_cgmacros_profile(self, participant_id: int) -> Dict[str, Any]:
        """Extract profile metrics for a specific CGMacros participant."""
        if not self.is_bio_available or self.bio_df is None:
            raise BioDataUnavailableException("CGMacros participant demographics are unavailable because the bio file is missing.")

        match = self.bio_df[self.bio_df["subject"] == participant_id]
        if match.empty:
            raise ValueError(f"CGMacros participant id {participant_id} not found in bio dataset.")

        row = match.iloc[0]
        return {
            "display_name": f"CGMacros #{participant_id}",
            "age": int(row["Age"]),
            "sex": str(row["Gender"]).strip(),
            "bmi": round(float(row["BMI"]), 1),
            "hba1c_pct": round(float(row["A1c PDL (Lab)"]), 1),
            "fasting_glucose_mgdl": round(float(row["Fasting GLU - PDL (Lab)"]), 1),
            "hypoglycemia_history": None,  # Unknown for CGMacros cohort per spec D2
            "source": "cgmacros",
            "is_synthetic": False,
        }

    def get_shanghai_dropdown(self) -> List[Dict[str, Any]]:
        """Return short summaries of Shanghai clinical profiles for dropdowns."""
        if not self.is_shanghai_available or self.shanghai_df is None:
            raise ShanghaiDataUnavailableException("Shanghai clinical profiles are unavailable.")

        dropdown = []
        # Group by patient_id or pick first session for each patient
        seen_patients = set()
        for _, row in self.shanghai_df.iterrows():
            pid = int(row["patient_id"])
            if pid in seen_patients:
                continue
            seen_patients.add(pid)
            sess_id = str(row["session_id"])
            age = int(row["age"])
            sex = str(row["sex"]).strip()
            bmi = round(float(row["bmi"]), 1)
            a1c = round(float(row["hba1c_pct"]), 1)
            fpg = round(float(row["fasting_glucose_mgdl"]), 1)
            hypo = str(row.get("Hypoglycemia (yes/no)", "no")).strip().lower()
            hypo_str = "Yes" if hypo == "yes" else "No"
            summary = f"Age {age}, {sex}, BMI {bmi}, HbA1c {a1c}%, FPG {fpg} mg/dL, Hypo: {hypo_str}"
            dropdown.append({"id": pid, "session_id": sess_id, "summary": summary})
        return dropdown

    def get_shanghai_profile(self, identifier: Any) -> Dict[str, Any]:
        """Extract profile metrics for a Shanghai clinical profile by patient_id or session_id."""
        if not self.is_shanghai_available or self.shanghai_df is None:
            raise ShanghaiDataUnavailableException("Shanghai clinical profiles are unavailable.")

        match = pd.DataFrame()
        if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
            match = self.shanghai_df[self.shanghai_df["patient_id"] == int(identifier)]
        elif isinstance(identifier, str):
            match = self.shanghai_df[self.shanghai_df["session_id"] == identifier]

        if match.empty:
            raise ValueError(f"Shanghai clinical profile for identifier '{identifier}' not found.")

        row = match.iloc[0]
        hypo_raw = str(row.get("Hypoglycemia (yes/no)", "")).strip().lower()
        hypo_bool = True if hypo_raw == "yes" else (False if hypo_raw == "no" else None)

        return {
            "display_name": f"Shanghai Profile #{row['patient_id']}",
            "age": int(row["age"]),
            "sex": str(row["sex"]).strip(),
            "bmi": round(float(row["bmi"]), 1),
            "hba1c_pct": round(float(row["hba1c_pct"]), 1),
            "fasting_glucose_mgdl": round(float(row["fasting_glucose_mgdl"]), 1),
            "hypoglycemia_history": hypo_bool,
            "source": "shanghai_profile",
            "is_synthetic": True,  # Always set is_synthetic=True for shanghai_profile per rule
        }


data_loader = DataLoader()
