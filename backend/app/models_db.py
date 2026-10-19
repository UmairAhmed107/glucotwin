from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    func,
)
from sqlalchemy.orm import relationship
from app.db import Base


def utcnow():
    return datetime.now(timezone.utc)


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    display_name = Column(String(255), nullable=False)
    is_synthetic = Column(Boolean, nullable=False, default=False)
    source = Column(String(50), nullable=False)  # "cgmacros" | "shanghai_profile" | "new"
    cgmacros_participant_id = Column(Integer, nullable=True, index=True)

    age = Column(Integer, nullable=False)
    sex = Column(String(20), nullable=False)  # e.g. "M", "F", "Other"
    bmi = Column(Float, nullable=False)
    hba1c_pct = Column(Float, nullable=False)
    fasting_glucose_mgdl = Column(Float, nullable=False)
    hypoglycemia_history = Column(Boolean, nullable=True)  # True / False / None (unknown)
    kidney_flag = Column(Boolean, nullable=False, default=False)
    current_meds = Column(JSON, nullable=False, default=list)  # list of drug classes
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    # Relationships
    meals = relationship("MealEntry", back_populates="patient", cascade="all, delete-orphan")
    readings = relationship("GlucoseReading", back_populates="patient", cascade="all, delete-orphan")
    twin_state = relationship("TwinState", back_populates="patient", uselist=False, cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="patient", cascade="all, delete-orphan")


class MealEntry(Base):
    __tablename__ = "meal_entries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    logged_at = Column(DateTime(timezone=True), nullable=False, index=True)

    carbs_g = Column(Float, nullable=False)
    protein_g = Column(Float, nullable=False)
    fat_g = Column(Float, nullable=False)
    fibre_g = Column(Float, nullable=True)
    calories = Column(Float, nullable=False)

    pre_glucose = Column(Float, nullable=False)
    pre_trend30 = Column(Float, nullable=False)

    # Optional observed outcomes (when known)
    observed_peak_rise = Column(Float, nullable=True)
    observed_iauc_2h = Column(Float, nullable=True)
    observed_delta_60 = Column(Float, nullable=True)
    observed_delta_120 = Column(Float, nullable=True)
    activity_after_min = Column(Float, nullable=True)

    patient = relationship("Patient", back_populates="meals")


class GlucoseReading(Base):
    __tablename__ = "glucose_readings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    ts = Column(DateTime(timezone=True), nullable=False, index=True)
    value_mgdl = Column(Float, nullable=False)
    source = Column(String(50), nullable=False, default="manual")  # "manual" | "replay"

    patient = relationship("Patient", back_populates="readings")


class TwinState(Base):
    __tablename__ = "twin_state"

    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), primary_key=True)
    mem_mean_rise = Column(Float, nullable=True)
    mem_mean_iauc = Column(Float, nullable=True)
    mem_n = Column(Integer, nullable=False, default=0)
    confidence_score = Column(Float, nullable=False, default=0.0)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    patient = relationship("Patient", back_populates="twin_state")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    kind = Column(String(50), nullable=False)  # "meal" | "lifestyle" | "therapy"
    provenance = Column(String(50), nullable=False)  # "TWIN_PREDICTED" | "GUIDELINE_AI" | "PROJECTION"
    safety_checked = Column(Boolean, nullable=False, default=False)
    payload = Column(JSON, nullable=False)
    governor_result = Column(JSON, nullable=True)

    patient = relationship("Patient", back_populates="recommendations")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, nullable=True, index=True)
    ts = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    endpoint = Column(String(255), nullable=False)
    inputs_hash = Column(String(64), nullable=False)
    model_version = Column(String(100), nullable=True)
    rules_triggered = Column(JSON, nullable=True)
    gemini_model = Column(String(100), nullable=True)
    gemini_used = Column(Boolean, nullable=False, default=False)


class LLMCache(Base):
    __tablename__ = "llm_cache"

    hash_key = Column(String(64), primary_key=True, index=True)
    request_prompt = Column(String, nullable=True)
    response_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

