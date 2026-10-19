from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def validate_tz_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is not None and dt.tzinfo is None:
        raise ValueError("Timestamp must be timezone-aware (e.g. UTC ISO-8601 string)")
    return dt


class ErrorInfo(BaseModel):
    code: str
    message: str
    details: dict = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorInfo


# ============================================================================
# Patient Schemas
# ============================================================================

class PatientBase(BaseModel):
    display_name: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=18, le=100)
    sex: Optional[str] = None
    bmi: Optional[float] = Field(default=None, ge=12.0, le=60.0)
    hba1c_pct: Optional[float] = Field(default=None, ge=4.0, le=18.0)
    fasting_glucose_mgdl: Optional[float] = Field(default=None, ge=50.0, le=500.0)
    hypoglycemia_history: Optional[bool] = None  # None = unknown, True / False
    kidney_flag: bool = False
    current_meds: List[str] = Field(default_factory=list)


class PatientCreate(PatientBase):
    mode: Literal["new", "cgmacros", "shanghai_profile"] = "new"
    cgmacros_participant_id: Optional[int] = None
    shanghai_patient_id: Optional[int] = None
    session_id: Optional[str] = None

    @model_validator(mode="after")
    def validate_mode_requirements(self) -> "PatientCreate":
        if self.mode == "new":
            missing = []
            if not self.display_name:
                missing.append("display_name")
            if self.age is None:
                missing.append("age")
            if not self.sex:
                missing.append("sex")
            if self.bmi is None:
                missing.append("bmi")
            if self.hba1c_pct is None:
                missing.append("hba1c_pct")
            if self.fasting_glucose_mgdl is None:
                missing.append("fasting_glucose_mgdl")
            if missing:
                raise ValueError(f"Mode 'new' requires fields: {', '.join(missing)}")

        elif self.mode == "cgmacros":
            if self.cgmacros_participant_id is None:
                raise ValueError("Mode 'cgmacros' requires 'cgmacros_participant_id'")

        elif self.mode == "shanghai_profile":
            if self.shanghai_patient_id is None and not self.session_id:
                raise ValueError("Mode 'shanghai_profile' requires 'shanghai_patient_id' or 'session_id'")

        return self


class TwinStateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    patient_id: int
    mem_mean_rise: Optional[float] = None
    mem_mean_iauc: Optional[float] = None
    mem_n: int = 0
    confidence_score: float = 0.0
    updated_at: datetime


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    is_synthetic: bool
    source: str
    cgmacros_participant_id: Optional[int] = None
    age: int
    sex: str
    bmi: float
    hba1c_pct: float
    fasting_glucose_mgdl: float
    hypoglycemia_history: Optional[bool] = None
    kidney_flag: bool
    current_meds: List[str]
    created_at: datetime


class PatientDetailResponse(PatientResponse):
    twin_state: Optional[TwinStateResponse] = None


# ============================================================================
# Meal Entry Schemas
# ============================================================================

class MealEntryCreate(BaseModel):
    logged_at: datetime
    carbs_g: float = Field(ge=0.0, le=400.0)
    protein_g: float = Field(ge=0.0, le=200.0)
    fat_g: float = Field(ge=0.0, le=200.0)
    fibre_g: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    calories: Optional[float] = Field(default=None, ge=0.0)

    pre_glucose: float = Field(ge=40.0, le=500.0)
    pre_trend30: float = Field(ge=-100.0, le=100.0)

    observed_peak_rise: Optional[float] = None
    observed_iauc_2h: Optional[float] = None
    observed_delta_60: Optional[float] = None
    observed_delta_120: Optional[float] = None
    activity_after_min: Optional[float] = Field(default=None, ge=0.0, le=360.0)

    @field_validator("logged_at")
    @classmethod
    def check_logged_at_tz(cls, v: datetime) -> datetime:
        return validate_tz_aware(v)

    @model_validator(mode="after")
    def calculate_calories_if_missing(self) -> "MealEntryCreate":
        if self.calories is None:
            # 4 kcal/g carbs, 4 kcal/g protein, 9 kcal/g fat
            self.calories = round(self.carbs_g * 4.0 + self.protein_g * 4.0 + self.fat_g * 9.0, 1)
        return self


class MealEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    logged_at: datetime
    carbs_g: float
    protein_g: float
    fat_g: float
    fibre_g: Optional[float] = None
    calories: float
    pre_glucose: float
    pre_trend30: float
    observed_peak_rise: Optional[float] = None
    observed_iauc_2h: Optional[float] = None
    observed_delta_60: Optional[float] = None
    observed_delta_120: Optional[float] = None
    activity_after_min: Optional[float] = None


# ============================================================================
# Glucose Reading Schemas
# ============================================================================

class GlucoseReadingCreate(BaseModel):
    ts: datetime
    value_mgdl: float = Field(ge=40.0, le=500.0)
    source: Literal["manual", "replay"] = "manual"

    @field_validator("ts")
    @classmethod
    def check_ts_tz(cls, v: datetime) -> datetime:
        return validate_tz_aware(v)


class GlucoseReadingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    ts: datetime
    value_mgdl: float
    source: str


# ============================================================================
# Timeline Schemas
# ============================================================================

class TimelineItem(BaseModel):
    type: Literal["meal", "reading", "recommendation"]
    id: int
    timestamp: datetime
    data: dict


class TimelineResponse(BaseModel):
    patient_id: int
    events: List[TimelineItem]


# ============================================================================
# Dropdown Item Schemas
# ============================================================================

class DropdownItem(BaseModel):
    id: int
    summary: str
    metadata: Optional[dict] = None


class ShanghaiDropdownItem(DropdownItem):
    session_id: Optional[str] = None


# ============================================================================
# System & Health Schemas
# ============================================================================

class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    sklearn_version_running: str
    sklearn_version_manifest: Optional[str] = None
    version_match: bool


class ModelManifestResponse(BaseModel):
    name: str
    class_name: str
    sklearn_version: str
    pandas_version: Optional[str] = None
    numpy_version: Optional[str] = None
    dataset_sizes: dict
    public_methods: Optional[dict] = None


# ============================================================================
# Phase 2: Twin Engine & Prediction Schemas
# ============================================================================

class PredictMealInput(BaseModel):
    carbs_g: float = Field(ge=0.0, le=400.0)
    protein_g: float = Field(ge=0.0, le=200.0)
    fat_g: float = Field(ge=0.0, le=200.0)
    fibre_g: Optional[float] = Field(default=0.0, ge=0.0, le=100.0)
    calories: Optional[float] = Field(default=None, ge=0.0)
    time_of_day: float = Field(default=12.0, ge=0.0, le=24.0)
    pre_glucose: float = Field(default=100.0, ge=40.0, le=500.0)
    pre_trend30: float = Field(default=0.0, ge=-100.0, le=100.0)
    meal_type: Optional[str] = None  # breakfast, lunch, dinner, snack

    @model_validator(mode="after")
    def calculate_calories(self) -> "PredictMealInput":
        if self.calories is None:
            self.calories = round(self.carbs_g * 4.0 + self.protein_g * 4.0 + self.fat_g * 9.0, 1)
        if self.fibre_g is None:
            self.fibre_g = 0.0
        return self


class TargetPrediction(BaseModel):
    target: str
    median: float
    p10: float
    p90: float
    min: float
    max: float
    band_width: float


class PredictResponse(BaseModel):
    provenance: Literal["TWIN_PREDICTED"] = "TWIN_PREDICTED"
    safety_checked: bool = True
    model_version: str
    patient_id: int
    targets: Dict[str, Optional[TargetPrediction]]
    confidence_score: float
    confidence_components: dict
    baseline_used: bool
    feature_row: Optional[dict] = None


class WhatIfInterventions(BaseModel):
    carb_reduction_pct: float = Field(default=0.0, ge=0.0, le=50.0)
    post_meal_walk: bool = False
    margin: float = 15.0


class WhatIfRequest(BaseModel):
    meal: PredictMealInput
    interventions: WhatIfInterventions


class WhatIfResponse(BaseModel):
    provenance: Literal["TWIN_PREDICTED"] = "TWIN_PREDICTED"
    safety_checked: bool = True
    model_version: str
    patient_id: int
    status: str
    baseline: TargetPrediction
    intervention: Optional[TargetPrediction] = None
    new_macros: Optional[dict] = None
    gains: Optional[dict] = None
    reason: Optional[str] = None


class CompareMealsRequest(BaseModel):
    meals: List[PredictMealInput] = Field(min_length=2, max_length=4)
    labels: Optional[List[str]] = None


class ComparedMealItem(BaseModel):
    index: int
    label: str
    rank: int
    prediction: TargetPrediction
    delta_vs_best: float


class CompareMealsResponse(BaseModel):
    provenance: Literal["TWIN_PREDICTED"] = "TWIN_PREDICTED"
    safety_checked: bool = True
    model_version: str
    patient_id: int
    ranked_meals: List[ComparedMealItem]
    best_meal: ComparedMealItem


class BestTimeSlot(BaseModel):
    hour: float
    hour_label: str
    median_rise: float
    p10: float
    p90: float
    band_width: float


class BestTimeResponse(BaseModel):
    provenance: Literal["TWIN_PREDICTED"] = "TWIN_PREDICTED"
    safety_checked: bool = True
    model_version: str
    patient_id: int
    slots: List[BestTimeSlot]
    best_slot: BestTimeSlot
    worst_slot: BestTimeSlot
    spread: float


class DailyPlanMeal(PredictMealInput):
    label: str = "Meal"


class DailyPlanRequest(BaseModel):
    meals: List[DailyPlanMeal] = Field(min_length=1)


class DailyPlanItem(BaseModel):
    label: str
    time_of_day: float
    prediction: TargetPrediction
    is_worst_meal: bool


class DailyPlanResponse(BaseModel):
    provenance: Literal["TWIN_PREDICTED"] = "TWIN_PREDICTED"
    safety_checked: bool = True
    model_version: str
    patient_id: int
    plan: List[DailyPlanItem]
    worst_meal: DailyPlanItem
    warnings: List[str]


class CohortPositionResponse(BaseModel):
    provenance: Literal["TWIN_PREDICTED"] = "TWIN_PREDICTED"
    safety_checked: bool = True
    model_version: str
    patient_id: int
    patient_mem_mean_rise: float
    patient_mem_mean_iauc: float
    percentile_mem_mean_rise: float
    percentile_mem_mean_iauc: float
    cohort_size: int
    cohort_rise_stats: dict
    cohort_iauc_stats: dict
    baseline_used: bool


class TwinLearningDataPoint(BaseModel):
    meal_index: int
    mem_n: int
    observed_peak_rise: Optional[float] = None
    observed_iauc_2h: Optional[float] = None
    mem_mean_rise: Optional[float] = None
    mem_mean_iauc: Optional[float] = None
    predicted_peak_rise_median: Optional[float] = None
    band_width: Optional[float] = None
    prediction_error: Optional[float] = None


class TwinLearningResponse(BaseModel):
    participant_id: int
    data_points: List[TwinLearningDataPoint]
    note: str


# ============================================================================
# Phase 3: Clinical Reasoning & Safety Governor Schemas
# ============================================================================

class TherapyOptionSchema(BaseModel):
    drug_class: str
    rationale: str
    patient_factors_used: List[str] = Field(default_factory=list)
    expected_effect_literature: str
    cautions: List[str] = Field(default_factory=list)
    monitoring: List[str] = Field(default_factory=list)
    guideline_ids: List[str] = Field(default_factory=list)


class LifestyleInterventionSchema(BaseModel):
    title: str
    detail: str
    linked_twin_finding: Optional[str] = None


class ClinicalPlanSchema(BaseModel):
    therapy_options: List[TherapyOptionSchema] = Field(default_factory=list)
    lifestyle_interventions: List[LifestyleInterventionSchema] = Field(default_factory=list)
    red_flags: List[str] = Field(default_factory=list)
    questions_for_clinician: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    patient_summary: str
    fallback: bool = False
    demo_fixture: bool = False


class GuidelineSnippetSchema(BaseModel):
    id: str
    topic: str
    text: str


class GovernorTraceSchema(BaseModel):
    rules_triggered: List[str] = Field(default_factory=list)
    clean: bool = True


class ClinicalPlanResponse(BaseModel):
    provenance: Literal["GUIDELINE_AI"] = "GUIDELINE_AI"
    safety_checked: bool = True
    patient_id: int
    plan: ClinicalPlanSchema
    sources: List[GuidelineSnippetSchema]
    governor_trace: GovernorTraceSchema
    gemini_used: bool
    demo_fixture: bool
    model_name: Optional[str] = None


class TherapyScenarioRange(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    unit: str = "% HbA1c"


class TherapyScenarioItem(BaseModel):
    drug_class: str
    expected_effect_literature: str
    projection_label: str = "Population-literature projection, not a twin prediction"
    range: Optional[TherapyScenarioRange] = None
    cautions: List[str] = Field(default_factory=list)
    monitoring: List[str] = Field(default_factory=list)
    guideline_ids: List[str] = Field(default_factory=list)
    provenance: Literal["PROJECTION"] = "PROJECTION"


class TherapyScenariosResponse(BaseModel):
    patient_id: int
    scenarios: List[TherapyScenarioItem]


class PlanItem(BaseModel):
    title: str
    detail: str
    provenance: Literal["GUIDELINE_AI", "TWIN_PREDICTED", "PROJECTION"]
    category: Literal["lifestyle", "twin_meal_advice", "monitoring", "clinician_review"]
    metadata: Optional[dict] = None


class WeekPlan(BaseModel):
    week_number: int
    focus_theme: str
    items: List[PlanItem]


class CombinedPlanResponse(BaseModel):
    patient_id: int
    provenance: Literal["GUIDELINE_AI"] = "GUIDELINE_AI"
    safety_checked: bool = True
    weeks: List[WeekPlan]


class AuditLogResponse(BaseModel):
    id: int
    patient_id: Optional[int] = None
    ts: datetime
    endpoint: Optional[str] = None
    inputs_hash: Optional[str] = None
    model_version: Optional[str] = None
    rules_triggered: Optional[List[str]] = Field(default_factory=list)
    gemini_model: Optional[str] = None
    gemini_used: bool = False
    user_id: Optional[int] = None
    action: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# Auth & Care Team Schemas
# ============================================================================

class UserRegister(BaseModel):
    email: str
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1)
    role: Literal["patient", "clinician", "dietitian", "admin"] = "patient"


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    created_at: datetime
    patient_id: Optional[int] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class CareTeamLinkCreate(BaseModel):
    patient_id: Optional[int] = None
    provider_user_id: Optional[int] = None
    role_in_team: str = "clinician"


class CareTeamLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    provider_user_id: int
    provider_name: Optional[str] = None
    provider_role: Optional[str] = None
    patient_name: Optional[str] = None
    role_in_team: str
    status: str
    created_at: datetime


class CareTeamStatusUpdate(BaseModel):
    status: Literal["pending", "active", "revoked"]


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    rule_key: str
    severity: Literal["info", "warning", "critical"]
    message: str
    created_at: datetime
    acknowledged_by: Optional[int] = None
    acknowledged_at: Optional[datetime] = None
    status: Literal["open", "acknowledged", "resolved"]
    patient_name: Optional[str] = None


class ClinicianPanelItem(BaseModel):
    patient_id: int
    display_name: str
    age: Optional[int] = None
    sex: Optional[str] = None
    hba1c_pct: Optional[float] = None
    risk_score: float
    risk_level: Literal["low", "moderate", "high", "critical"]
    time_in_range_pct: Optional[float] = None
    last_reading_time: Optional[datetime] = None
    open_alerts_count: int
    alerts_by_severity: Dict[str, int]
    twin_status: Dict[str, Any]
    care_team_status: str


# ============================================================================
# Clinician-Reviewed Visit & Care Plan Schemas
# ============================================================================

class VisitCreate(BaseModel):
    scheduled_at: Optional[datetime] = None
    notes: Optional[str] = None


class RecommendationDraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    visit_id: int
    patient_id: int
    category: str
    title: str
    detail: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    status: Literal["draft", "approved", "edited", "rejected"]
    clinician_comment: Optional[str] = None
    governor_trace: Optional[Dict[str, Any]] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None


class DraftReviewRequest(BaseModel):
    status: Literal["approved", "edited", "rejected"]
    title: Optional[str] = None
    detail: Optional[str] = None
    clinician_comment: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


class CarePlanTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    care_plan_id: int
    patient_id: int
    title: str
    description: Optional[str] = None
    due_date: datetime
    category: str
    assigned_to: str
    status: Literal["pending", "in_progress", "completed", "cancelled"]
    completed_at: Optional[datetime] = None


class CarePlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    visit_id: Optional[int] = None
    title: str
    status: str
    created_at: datetime
    updated_at: datetime
    tasks: List[CarePlanTaskResponse] = Field(default_factory=list)


class VisitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    clinician_id: Optional[int] = None
    scheduled_at: datetime
    status: Literal["scheduled", "in_progress", "completed"]
    pre_visit_summary: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    final_plan: Optional[Dict[str, Any]] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    drafts: List[RecommendationDraftResponse] = Field(default_factory=list)
    patient_name: Optional[str] = None
    clinician_name: Optional[str] = None


class TaskUpdateRequest(BaseModel):
    status: Literal["pending", "in_progress", "completed", "cancelled"]




