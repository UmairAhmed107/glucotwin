// API Models & Types for GlucoTwin

export type ProvenanceType = 'TWIN_PREDICTED' | 'GUIDELINE_AI' | 'PROJECTION';

export interface HealthResponse {
  status: string;
  models_loaded: boolean;
  sklearn_version_running: string;
  sklearn_version_manifest?: string;
  version_match: boolean;
}

export interface ModelManifestResponse {
  name: string;
  class_name: string;
  sklearn_version: string;
  pandas_version?: string;
  numpy_version?: string;
  dataset_sizes: Record<string, any>;
  public_methods?: Record<string, any>;
}

export interface DropdownItem {
  id: number;
  summary: string;
  metadata?: Record<string, any>;
}

export interface ShanghaiDropdownItem extends DropdownItem {
  session_id?: string;
}

export interface TwinState {
  patient_id: number;
  mem_mean_rise: number | null;
  mem_mean_iauc: number | null;
  mem_n: number;
  confidence_score: number;
  updated_at: string;
}

export interface Patient {
  id: number;
  display_name: string;
  is_synthetic: boolean;
  source: 'new' | 'cgmacros' | 'shanghai_profile';
  cgmacros_participant_id?: number | null;
  age: number;
  sex: string;
  bmi: number;
  hba1c_pct: number;
  fasting_glucose_mgdl: number;
  hypoglycemia_history: boolean | null; // null = unknown
  kidney_flag: boolean;
  current_meds: string[];
  created_at: string;
  twin_state?: TwinState | null;
}

export interface PatientCreatePayload {
  mode: 'new' | 'cgmacros' | 'shanghai_profile';
  display_name?: string;
  age?: number;
  sex?: string;
  bmi?: number;
  hba1c_pct?: number;
  fasting_glucose_mgdl?: number;
  hypoglycemia_history?: boolean | null;
  kidney_flag?: boolean;
  current_meds?: string[];
  cgmacros_participant_id?: number;
  shanghai_patient_id?: number;
  session_id?: string;
}

export interface MealEntryCreatePayload {
  logged_at: string; // ISO 8601 string
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  fibre_g?: number | null;
  calories?: number | null;
  pre_glucose: number;
  pre_trend30: number;
  observed_peak_rise?: number | null;
  observed_iauc_2h?: number | null;
  observed_delta_60?: number | null;
  observed_delta_120?: number | null;
  activity_after_min?: number | null;
}

export interface MealEntry {
  id: number;
  patient_id: number;
  logged_at: string;
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  fibre_g?: number | null;
  calories: number;
  pre_glucose: number;
  pre_trend30: number;
  observed_peak_rise?: number | null;
  observed_iauc_2h?: number | null;
  observed_delta_60?: number | null;
  observed_delta_120?: number | null;
  activity_after_min?: number | null;
}

export interface GlucoseReadingCreatePayload {
  ts: string;
  value_mgdl: number;
  source?: 'manual' | 'replay';
}

export interface GlucoseReading {
  id: number;
  patient_id: number;
  ts: string;
  value_mgdl: number;
  source: string;
}

export interface TimelineEvent {
  type: 'meal' | 'reading' | 'recommendation';
  id: number;
  timestamp: string;
  data: Record<string, any>;
}

export interface TimelineResponse {
  patient_id: number;
  events: TimelineEvent[];
}

export interface TargetPrediction {
  target: string;
  median: number;
  p10: number;
  p90: number;
  min: number;
  max: number;
  band_width: number;
}

export interface PredictResponse {
  provenance: 'TWIN_PREDICTED';
  safety_checked: boolean;
  model_version: string;
  patient_id: number;
  targets: {
    peak_rise: TargetPrediction;
    iauc_2h?: TargetPrediction | null;
    delta_60?: TargetPrediction | null;
    delta_120?: TargetPrediction | null;
  };
  confidence_score: number;
  confidence_components: {
    n_component: number;
    band_component: number;
    mem_n: number;
    band_width: number;
  };
  baseline_used: boolean;
  feature_row?: Record<string, any>;
}

export interface WhatIfResponse {
  provenance: 'TWIN_PREDICTED';
  safety_checked: boolean;
  model_version: string;
  patient_id: number;
  status: string;
  baseline: TargetPrediction;
  intervention?: TargetPrediction | null;
  new_macros?: Record<string, any>;
  gains?: {
    median_gain: number;
    pessimistic_gain: number;
    label: 'supported' | 'not_supported';
    margin: number;
    per_member_gains: number[];
  };
  reason?: string;
}

export interface TherapyOption {
  drug_class: string;
  rationale: string;
  patient_factors_used: string[];
  expected_effect_literature: string;
  cautions: string[];
  monitoring: string[];
  guideline_ids: string[];
}

export interface LifestyleIntervention {
  title: string;
  detail: string;
  linked_twin_finding?: string | null;
}

export interface ClinicalPlan {
  therapy_options: TherapyOption[];
  lifestyle_interventions: LifestyleIntervention[];
  red_flags: string[];
  questions_for_clinician: string[];
  missing_information: string[];
  patient_summary: string;
  fallback?: boolean;
  demo_fixture?: boolean;
}

export interface GuidelineSnippet {
  id: string;
  topic: string;
  text: string;
}

export interface ClinicalPlanResponse {
  provenance: 'GUIDELINE_AI';
  safety_checked: boolean;
  patient_id: number;
  plan: ClinicalPlan;
  sources: GuidelineSnippet[];
  governor_trace: {
    rules_triggered: string[];
    clean: boolean;
  };
  gemini_used: boolean;
  demo_fixture: boolean;
  model_name?: string;
}

export interface TherapyScenarioItem {
  drug_class: string;
  expected_effect_literature: string;
  projection_label: string;
  range?: {
    min?: number;
    max?: number;
    unit: string;
  } | null;
  cautions: string[];
  monitoring: string[];
  guideline_ids: string[];
  provenance: 'PROJECTION';
}

export interface TherapyScenariosResponse {
  patient_id: number;
  scenarios: TherapyScenarioItem[];
}

export interface PlanItem {
  title: string;
  detail: string;
  provenance: 'GUIDELINE_AI' | 'TWIN_PREDICTED' | 'PROJECTION';
  category: 'lifestyle' | 'twin_meal_advice' | 'monitoring' | 'clinician_review';
  metadata?: Record<string, any>;
}

export interface WeekPlan {
  week_number: number;
  focus_theme: string;
  items: PlanItem[];
}

export interface CombinedPlanResponse {
  patient_id: number;
  provenance: 'GUIDELINE_AI';
  safety_checked: boolean;
  weeks: WeekPlan[];
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PredictMealInput {
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  fibre_g?: number;
  calories?: number;
  time_of_day?: number;
  meal_type?: string;
  pre_glucose: number;
  pre_trend30: number;
}

export interface TwinLearningDataPoint {
  meal_index: number;
  mem_n: number;
  observed_peak_rise: number | null;
  observed_iauc_2h: number | null;
  mem_mean_rise: number | null;
  mem_mean_iauc: number | null;
  predicted_peak_rise_median: number | null;
  band_width: number | null;
  prediction_error: number | null;
}

export interface TwinLearningResponse {
  participant_id: number;
  data_points: TwinLearningDataPoint[];
  note: string;
}

export interface ComparedMealItem {
  index: number;
  label: string;
  rank: number;
  prediction: TargetPrediction;
  delta_vs_best: number;
}

export interface CompareMealsRequest {
  meals: PredictMealInput[];
  labels?: string[];
}

export interface CompareMealsResponse {
  provenance: 'TWIN_PREDICTED';
  safety_checked: boolean;
  model_version: string;
  patient_id: number;
  ranked_meals: ComparedMealItem[];
  best_meal: ComparedMealItem;
}

export interface BestTimeSlot {
  hour: number;
  hour_label: string;
  median_rise: number;
  p10: number;
  p90: number;
  band_width: number;
}

export interface BestTimeResponse {
  provenance: 'TWIN_PREDICTED';
  safety_checked: boolean;
  model_version: string;
  patient_id: number;
  slots: BestTimeSlot[];
  best_slot: BestTimeSlot;
  worst_slot: BestTimeSlot;
  spread: number;
}

export interface DailyPlanMeal extends PredictMealInput {
  label: string;
}

export interface DailyPlanItem {
  label: string;
  time_of_day: number;
  prediction: TargetPrediction;
  is_worst_meal: boolean;
}

export interface DailyPlanRequest {
  meals: DailyPlanMeal[];
}

export interface DailyPlanResponse {
  provenance: 'TWIN_PREDICTED';
  safety_checked: boolean;
  model_version: string;
  patient_id: number;
  plan: DailyPlanItem[];
  worst_meal: DailyPlanItem;
  warnings: string[];
}

export interface CohortPositionResponse {
  provenance: 'TWIN_PREDICTED';
  safety_checked: boolean;
  model_version: string;
  patient_id: number;
  patient_mem_mean_rise: number;
  patient_mem_mean_iauc: number;
  percentile_mem_mean_rise: number;
  percentile_mem_mean_iauc: number;
  cohort_size: number;
  cohort_rise_stats: {
    min: number;
    q25: number;
    median: number;
    q75: number;
    max: number;
  };
  cohort_iauc_stats: {
    min: number;
    q25: number;
    median: number;
    q75: number;
    max: number;
  };
  baseline_used: boolean;
}

export interface AuditLogEntry {
  id: number;
  patient_id?: number | null;
  ts: string;
  endpoint: string;
  inputs_hash: string;
  model_version?: string | null;
  rules_triggered?: string[];
  gemini_model?: string | null;
  gemini_used: boolean;
}

export interface GroupedCvTargetMetrics {
  baseline_mae?: number | null;
  twin_mae?: number | null;
  baseline_rmse?: number | null;
  twin_rmse?: number | null;
}

export interface ErrorVsMemoryPoint {
  mem_n: number;
  mae: number;
  n?: number;
}

export interface IntervalCalibrationPoint {
  nominal: number;
  empirical: number;
}

export interface ValidationMetricsResponse {
  class?: string;
  class_name?: string;
  sklearn_version?: string;
  training_date?: string;
  trained_on?: {
    dataset?: string;
    participants?: number;
    meals?: number;
    features?: number;
    rows?: number;
  };
  dataset_sizes?: Record<string, { rows?: number; columns?: number; meals?: number; participants?: number }>;
  grouped_cv?: Record<string, GroupedCvTargetMetrics>;
  error_vs_memory?: ErrorVsMemoryPoint[];
  interval_calibration?: IntervalCalibrationPoint[];
  limitations?: string[];
}

export interface ReplayStartResponse {
  status: string;
  participant_id: number;
  speed: number;
  stream_url: string;
  total_points: number;
  message?: string;
}

export interface ReplayPointEvent {
  type: 'reading' | 'meal' | 'complete' | 'error';
  participant_id?: number;
  index?: number;
  timestamp?: string;
  glucose?: number;
  message?: string;
  meal?: {
    meal_type?: string;
    carbs_g?: number;
    protein_g?: number;
    fat_g?: number;
    calories?: number;
  };
  predicted_response?: {
    peak_rise?: number;
    iauc_2h?: number;
    p10?: number;
    p90?: number;
    predicted_peak?: number;
    curve?: Array<{ minute: number; glucose: number; p10?: number; p90?: number }>;
  };
}

export type UserRole = 'patient' | 'clinician' | 'dietitian' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  patient_id?: number | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface CareTeamLink {
  id: number;
  patient_id: number;
  provider_user_id: number;
  provider_name?: string | null;
  provider_role?: string | null;
  patient_name?: string | null;
  role_in_team: string;
  status: 'pending' | 'active' | 'revoked';
  created_at: string;
}


