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
    Text,
    func,
)
from sqlalchemy.orm import relationship
from app.db import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # "patient" | "clinician" | "dietitian" | "admin"
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="user", uselist=False)
    care_team_memberships = relationship(
        "CareTeamLink",
        back_populates="provider_user",
        foreign_keys="CareTeamLink.provider_user_id",
        cascade="all, delete-orphan",
    )
    visits_as_clinician = relationship(
        "Visit",
        back_populates="clinician",
        foreign_keys="Visit.clinician_id",
    )


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True, index=True)
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
    user = relationship("User", back_populates="patient")
    care_team = relationship("CareTeamLink", back_populates="patient", cascade="all, delete-orphan")
    meals = relationship("MealEntry", back_populates="patient", cascade="all, delete-orphan")
    readings = relationship("GlucoseReading", back_populates="patient", cascade="all, delete-orphan")
    twin_state = relationship("TwinState", back_populates="patient", uselist=False, cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="patient", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="patient", cascade="all, delete-orphan")
    visits = relationship("Visit", back_populates="patient", cascade="all, delete-orphan")
    care_plans = relationship("CarePlan", back_populates="patient", cascade="all, delete-orphan")


class CareTeamLink(Base):
    __tablename__ = "care_team_links"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_in_team = Column(String(50), nullable=False, default="clinician")
    status = Column(String(20), nullable=False, default="pending")  # "pending" | "active" | "revoked"
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    patient = relationship("Patient", back_populates="care_team")
    provider_user = relationship("User", back_populates="care_team_memberships", foreign_keys=[provider_user_id])


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
    endpoint = Column(String(255), nullable=True)
    inputs_hash = Column(String(64), nullable=True)
    model_version = Column(String(100), nullable=True)
    rules_triggered = Column(JSON, nullable=True)
    gemini_model = Column(String(100), nullable=True)
    gemini_used = Column(Boolean, nullable=False, default=False)

    # Resource & user audit fields
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=True)  # "read" | "create" | "update" | "delete"
    resource_type = Column(String(100), nullable=True)  # "patient" | "meal" | "glucose" | "twin" | etc.
    resource_id = Column(String(100), nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=utcnow)



class LLMCache(Base):
    __tablename__ = "llm_cache"

    hash_key = Column(String(64), primary_key=True, index=True)
    request_prompt = Column(String, nullable=True)
    response_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_key = Column(String(64), nullable=False, index=True)
    severity = Column(String(16), nullable=False)  # "info" | "warning" | "critical"
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    acknowledged_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(16), nullable=False, default="open", index=True)  # "open" | "acknowledged" | "resolved"

    # Relationships
    patient = relationship("Patient", back_populates="alerts")
    acknowledged_by_user = relationship("User", foreign_keys=[acknowledged_by])


class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    clinician_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default="scheduled", index=True)  # "scheduled" | "in_progress" | "completed"
    pre_visit_summary = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    final_plan = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="visits")
    clinician = relationship("User", foreign_keys=[clinician_id], back_populates="visits_as_clinician")
    drafts = relationship("RecommendationDraft", back_populates="visit", cascade="all, delete-orphan")
    care_plan = relationship("CarePlan", back_populates="visit", uselist=False)


class RecommendationDraft(Base):
    __tablename__ = "recommendation_drafts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    visit_id = Column(Integer, ForeignKey("visits.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False)  # "therapy" | "lifestyle" | "monitoring" | "meal"
    title = Column(String(255), nullable=False)
    detail = Column(Text, nullable=True)
    payload = Column(JSON, nullable=False, default=dict)
    status = Column(String(20), nullable=False, default="draft", index=True)  # "draft" | "approved" | "edited" | "rejected"
    clinician_comment = Column(Text, nullable=True)
    governor_trace = Column(JSON, nullable=True)  # { rules_triggered: [...], clean: bool, blocked: bool, reason: str }
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    visit = relationship("Visit", back_populates="drafts")
    patient = relationship("Patient")


class CarePlan(Base):
    __tablename__ = "care_plans"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="active", index=True)  # "active" | "completed" | "archived"
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="care_plans")
    visit = relationship("Visit", back_populates="care_plan")
    tasks = relationship("CarePlanTask", back_populates="care_plan", cascade="all, delete-orphan")


class CarePlanTask(Base):
    __tablename__ = "care_plan_tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    care_plan_id = Column(Integer, ForeignKey("care_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=False)
    category = Column(String(50), nullable=False)  # "lifestyle" | "medication" | "monitoring" | "visit"
    assigned_to = Column(String(50), nullable=False, default="patient")  # "patient" | "clinician"
    status = Column(String(20), nullable=False, default="pending", index=True)  # "pending" | "in_progress" | "completed" | "cancelled"
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    care_plan = relationship("CarePlan", back_populates="tasks")
    patient = relationship("Patient")


