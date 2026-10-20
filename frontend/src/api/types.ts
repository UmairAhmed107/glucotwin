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

export interface PredictionRecord {
  id: number;
  patient_id: number;
  meal_id?: number | null;
  predicted_peak_rise: number;
  p10: number;
  p90: number;
  model_version: string;
  created_at: string;
  actual_peak_rise?: number | null;
  actual_iauc_2h?: number | null;
  error?: number | null;
  in_range?: boolean | null;
  reconciled_at?: string | null;
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
  prediction?: PredictionRecord | null;
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
  adjustments?: Array<{
    lever: string;
    name: string;
    adjustment_pct: number;
    applied_delta_mgdl: number;
    description: string;
    citation?: string;
  }>;
  is_estimated_adjustment?: boolean;
}

export interface SavedScenario {
  id: number;
  patient_id: number;
  name: string;
  description?: string | null;
  inputs: Record<string, any>;
  baseline_output: Record<string, any>;
  intervention_output?: Record<string, any> | null;
  created_at: string;
}

export interface ScenarioComparison {
  median_diff_mgdl: number;
  p10_diff_mgdl: number;
  p90_diff_mgdl: number;
  carb_reduction_diff_pct: number;
  summary: string;
}

export interface ScenarioCompareResponse {
  scenario_a: SavedScenario;
  scenario_b: SavedScenario;
  comparison: ScenarioComparison;
}

export interface PlannedMealItem {
  meal_name: string;
  portion_pct: number;
  scaled_carbs: number;
  scaled_kcal: number;
  walk_option: string;
  walk_duration_min: number;
  walk_intensity: string;
  meal_order: string;
  meal_order_label: string;
  timing_shift_hours: number;
  pred_median: number;
  pred_p10: number;
  pred_p90: number;
}

export interface GoalPlanOption {
  plan_id: string;
  title: string;
  strategy_type: string;
  target_peak_rise_limit: number;
  goal_met: boolean;
  predicted_peak: {
    median: number;
    p10: number;
    p90: number;
    band_width: number;
  };
  meals: PlannedMealItem[];
  tradeoffs: string[];
  adjustments?: Array<{
    lever: string;
    name: string;
    adjustment_pct: number;
    applied_delta_mgdl: number;
    description: string;
    citation?: string;
  }>;
  is_estimated_adjustment?: boolean;
  governor_trace: {
    clean: boolean;
    blocked: boolean;
    rules_triggered: string[];
    reason?: string;
  };
  care_plan_tasks: Array<{
    title: string;
    category: string;
    due_date?: string;
    assigned_to?: string;
  }>;
}

export interface PlanGoalResponse {
  provenance: 'TWIN_PREDICTED';
  safety_checked: boolean;
  patient_id: number;
  target_peak_rise_limit: number;
  seed: number;
  plans: GoalPlanOption[];
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

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved';

export interface Alert {
  id: number;
  patient_id: number;
  rule_key: string;
  severity: AlertSeverity;
  message: string;
  created_at: string;
  acknowledged_by?: number | null;
  acknowledged_at?: string | null;
  status: AlertStatus;
  patient_name?: string | null;
}

export interface ClinicianPanelItem {
  patient_id: number;
  display_name: string;
  age?: number | null;
  sex?: string | null;
  hba1c_pct?: number | null;
  risk_score: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  time_in_range_pct?: number | null;
  last_reading_time?: string | null;
  open_alerts_count: number;
  alerts_by_severity: {
    critical: number;
    warning: number;
    info: number;
  };
  twin_status: {
    mem_n: number;
    confidence_score: number;
    personalized: boolean;
    last_calibrated?: string | null;
  };
  care_team_status: string;
}

// ============================================================================
// Clinician-Reviewed Visit & Care Plan Types
// ============================================================================

export type VisitStatus = 'scheduled' | 'in_progress' | 'completed';
export type DraftStatus = 'draft' | 'approved' | 'edited' | 'rejected';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface PreVisitSummary {
  patient_id: number;
  patient_name: string;
  generated_at: string;
  glucose_stats_14d: {
    days_window: number;
    reading_count: number;
    mean_mgdl: number;
    std_mgdl: number;
    min_mgdl: number;
    max_mgdl: number;
    time_in_range_pct: number;
    hypo_events_count: number;
    critical_hypo_count: number;
    hyper_events_count: number;
  };
  twin_patterns: {
    mem_n: number;
    mem_mean_rise: number;
    mem_mean_iauc: number;
    baseline_used: boolean;
    representative_meal_rise_mgdl: number;
    carb_sensitivity: string;
  };
  open_alerts: Array<{
    id: number;
    rule_key: string;
    severity: string;
    message: string;
    created_at?: string | null;
  }>;
  open_alerts_count: number;
  biomarkers: {
    hba1c_pct: number;
    fasting_glucose_mgdl: number;
    kidney_flag: boolean;
    estimated_egfr: number;
    hypoglycemia_history?: boolean | null;
    bmi: number;
  };
  medication_adherence: {
    current_meds: string[];
    estimated_adherence_pct: number;
    status: string;
  };
  clinical_focus: string;
}

export interface RecommendationDraft {
  id: number;
  visit_id: number;
  patient_id: number;
  category: 'therapy' | 'lifestyle' | 'monitoring' | string;
  title: string;
  detail?: string | null;
  payload: Record<string, any>;
  status: DraftStatus;
  clinician_comment?: string | null;
  governor_trace?: {
    rules_triggered: string[];
    clean: boolean;
    blocked?: boolean;
    reason?: string;
  } | null;
  created_at: string;
  reviewed_at?: string | null;
}

export interface Visit {
  id: number;
  patient_id: number;
  clinician_id?: number | null;
  scheduled_at: string;
  status: VisitStatus;
  pre_visit_summary?: PreVisitSummary | null;
  notes?: string | null;
  final_plan?: {
    completed_at: string;
    clinician_id: number;
    clinician_name?: string;
    notes: string;
    approved_recommendations: Array<{
      id: number;
      category: string;
      title: string;
      detail?: string | null;
      payload: Record<string, any>;
      clinician_comment?: string | null;
      status: string;
    }>;
  } | null;
  created_at: string;
  completed_at?: string | null;
  drafts: RecommendationDraft[];
  patient_name?: string | null;
  clinician_name?: string | null;
}

export interface CarePlanTask {
  id: number;
  care_plan_id: number;
  patient_id: number;
  title: string;
  description?: string | null;
  due_date: string;
  category: 'lifestyle' | 'medication' | 'monitoring' | 'visit' | string;
  assigned_to: 'patient' | 'clinician';
  status: TaskStatus;
  completed_at?: string | null;
}

export interface CarePlan {
  id: number;
  patient_id: number;
  visit_id?: number | null;
  title: string;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  tasks: CarePlanTask[];
}

// ============================================================================
// Phase 7: Fast Food Logging, Saved Meals & Patient Home Types
// ============================================================================

export interface FoodItem {
  id: number;
  name: string;
  serving_description: string;
  carbs: number;
  protein: number;
  fat: number;
  calories: number;
  fiber: number;
  category?: string | null;
  is_demo: boolean;
  disclaimer: string;
}

export interface FoodSearchResponse {
  items: FoodItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface SavedMealItem {
  food_id: number;
  servings: number;
  name?: string | null;
  carbs?: number | null;
  protein?: number | null;
  fat?: number | null;
  calories?: number | null;
  fiber?: number | null;
}

export interface SavedMeal {
  id: number;
  patient_id: number;
  name: string;
  items: SavedMealItem[];
  computed_carbs: number;
  computed_protein: number;
  computed_fat: number;
  computed_calories: number;
  computed_fiber: number;
  created_at: string;
}

export interface PhotoMealEstimateItem {
  name: string;
  portion: string;
  carbs: number;
  protein: number;
  fat: number;
  calories: number;
  fiber: number;
}

export interface PhotoMealEstimate {
  draft_id: string;
  food_items: PhotoMealEstimateItem[];
  estimated_macros: {
    carbs_g: number;
    protein_g: number;
    fat_g: number;
    calories: number;
    fibre_g: number;
    carbs?: number;
    protein?: number;
    fat?: number;
    fiber?: number;
  };
  confidence: number;
  rationale: string;
  confirmed: boolean;
  is_mock: boolean;
  disclaimer: string;
}

export interface Medication {
  id: number;
  patient_id: number;
  name: string;
  dosage: string;
  schedule: string;
  frequency_per_day: number;
  is_active: boolean;
  created_at: string;
}

export interface DoseLog {
  id: number;
  medication_id: number;
  patient_id: number;
  medication_name?: string | null;
  dose: string;
  scheduled_time: string;
  taken_at?: string | null;
  status: 'taken' | 'skipped' | 'pending';
  notes?: string | null;
}

export interface AdherenceStats {
  patient_id: number;
  days_window: number;
  total_scheduled_doses: number;
  total_taken_doses: number;
  total_missed_doses: number;
  adherence_rate_pct: number;
  current_streak_days: number;
  today_doses: DoseLog[];
}

export interface PatientHomeSummary {
  patient_id: number;
  today_glucose: {
    current_value: number;
    min_value: number;
    max_value: number;
    mean_value: number;
    readings_count: number;
    trend: 'rising' | 'falling' | 'stable';
    unit: string;
    last_reading_time: string;
  };
  time_in_range_ring: {
    in_range_pct: number;
    below_range_pct: number;
    above_range_pct: number;
    total_readings: number;
    target_in_range_pct: number;
    status: 'on_track' | 'attention_needed';
    window_label: string;
  };
  last_meal?: {
    id: number;
    logged_at: string;
    carbs_g: number;
    protein_g: number;
    fat_g: number;
    fiber_g: number;
    calories: number;
    observed_peak_rise: number;
    predicted_peak_rise: number;
    delta_mgdl: number;
    response_badge: string;
    badge_color: string;
    pre_glucose: number;
  } | null;
  circadian_suggestion: {
    meal_type: string;
    optimal_window: string;
    predicted_rise_reduction_mgdl: number;
    rationale: string;
    circadian_advantage: string;
  };
  medications_today: DoseLog[];
  weekly_streak: {
    current_streak_days: number;
    target_days: number;
    is_streak_active_today: boolean;
    history: Array<{
      day: string;
      date: string;
      active: boolean;
      glucose_count: number;
      meal_count: number;
      dose_count: number;
    }>;
    encouragement: string;
  };
}

export interface PredictionHistoryItem {
  id: number;
  meal_id?: number | null;
  created_at?: string | null;
  predicted_peak_rise: number;
  p10: number;
  p90: number;
  actual_peak_rise?: number | null;
  actual_iauc_2h?: number | null;
  error?: number | null;
  in_range?: boolean | null;
  reconciled_at?: string | null;
  rolling_mae?: number | null;
  model_version: string;
}

export interface DriftDetails {
  reason?: string | null;
  baseline_mae?: number | null;
  recent_mae?: number | null;
  coverage_pct?: number | null;
  suggested_causes: string[];
}

export interface TwinAccuracyResponse {
  patient_id: number;
  total_predictions: number;
  reconciled_count: number;
  overall_mae?: number | null;
  rolling_mae_20?: number | null;
  interval_coverage_pct?: number | null;
  drift_detected: boolean;
  drift_details?: DriftDetails | null;
  history: PredictionHistoryItem[];
}

export interface MaturityTimelineItem {
  level: string;
  reached_at?: string | null;
  description: string;
  unlocked: boolean;
}

export interface TwinMaturityResponse {
  patient_id: number;
  score: number;
  level: 'Population' | 'Learning' | 'Personalized' | 'Well-calibrated';
  description: string;
  components: {
    memory_score: number;
    accuracy_score: number;
    calibration_score: number;
    mem_n: number;
    recent_mae?: number | null;
    coverage_pct?: number | null;
    formula?: string;
  };
  next_milestone: string;
  timeline: MaturityTimelineItem[];
}

export interface ReconcileResponse {
  patient_id: number;
  reconciled_count: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Platform Glue Types: Messaging
// ---------------------------------------------------------------------------

export interface Message {
  id: number;
  thread_id: number;
  sender_id?: number | null;
  sender_name?: string | null;
  sender_role?: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface MessageThread {
  id: number;
  patient_id: number;
  patient_name?: string | null;
  title: string;
  topic_type?: 'general' | 'visit' | 'alert' | 'scenario' | null;
  topic_id?: string | null;
  topic_title?: string | null;
  created_by?: number | null;
  creator_name?: string | null;
  unread_count: number;
  last_message?: string | null;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface ThreadCreatePayload {
  patient_id: number;
  title: string;
  initial_message?: string;
  topic_type?: 'general' | 'visit' | 'alert' | 'scenario';
  topic_id?: string;
  topic_title?: string;
}

// ---------------------------------------------------------------------------
// Platform Glue Types: Data Import & Wearables
// ---------------------------------------------------------------------------

export interface CGMImportReport {
  patient_id: number;
  rows_accepted: number;
  rows_skipped: number;
  errors: string[];
  units_detected: string;
  alerts_evaluated: number;
  predictions_reconciled: number;
  message: string;
}

export interface WearableImportReport {
  patient_id: number;
  rows_accepted: number;
  rows_skipped: number;
  errors: string[];
  message: string;
}

export interface WearableDailyItem {
  id: number;
  patient_id: number;
  date: string;
  steps: number;
  sleep_hours: number;
  source: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Platform Glue Types: Weekly Report
// ---------------------------------------------------------------------------

export interface WeeklyReportMealItem {
  meal_id?: number;
  logged_at?: string;
  meal_type?: string;
  carbs_g: number;
  calories: number;
  pre_glucose: number;
  observed_peak_rise?: number | null;
  actual_peak_rise?: number | null;
  rating?: 'best' | 'worst';
}

export interface WeeklyReport {
  patient_id: number;
  patient_name: string;
  generated_at: string;
  period_days: number;
  tir_stats: {
    tir_pct: number;
    tar_pct: number;
    tbr_pct: number;
    mean_glucose: number;
    total_readings: number;
    target_tir_pct?: number;
    target_tbr_pct?: number;
  };
  best_meals: WeeklyReportMealItem[];
  worst_meals: WeeklyReportMealItem[];
  twin_accuracy: {
    mean_error: number;
    in_range_pct: number;
    total_predictions: number;
    calibrated: boolean;
    confidence_score?: number;
  };
  adherence: {
    doses_taken: number;
    doses_total: number;
    adherence_pct: number;
    meals_logged: number;
  };
  alerts: Array<{
    id: number;
    rule_key: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    status: string;
    created_at: string;
  }>;
  plan_progress: {
    title: string;
    completed_tasks: number;
    total_tasks: number;
    progress_pct: number;
  };
  wearables_summary?: {
    avg_steps: number;
    avg_sleep_hours: number;
    days_recorded: number;
  } | null;
}




