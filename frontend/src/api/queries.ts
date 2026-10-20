import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, showToast } from './client';
import {
  AuditLogEntry,
  Alert,
  BestTimeResponse,
  CarePlan,
  CarePlanTask,
  ClinicalPlanResponse,
  ClinicianPanelItem,
  CohortPositionResponse,
  CombinedPlanResponse,
  CompareMealsRequest,
  CompareMealsResponse,
  DailyPlanRequest,
  DailyPlanResponse,
  DropdownItem,
  GlucoseReading,
  GlucoseReadingCreatePayload,
  HealthResponse,
  MealEntry,
  MealEntryCreatePayload,
  Patient,
  PatientCreatePayload,
  PredictMealInput,
  PredictResponse,
  ShanghaiDropdownItem,
  TherapyScenariosResponse,
  TimelineResponse,
  TwinLearningResponse,
  ValidationMetricsResponse,
  RecommendationDraft,
  ReplayStartResponse,
  Visit,
  WhatIfResponse,
  FoodItem,
  FoodSearchResponse,
  SavedMeal,
  PhotoMealEstimate,
  Medication,
  DoseLog,
  AdherenceStats,
  PatientHomeSummary,
  TwinAccuracyResponse,
  TwinMaturityResponse,
  ReconcileResponse,
  SavedScenario,
  ScenarioCompareResponse,
  PlanGoalResponse,
  Message,
  MessageThread,
  ThreadCreatePayload,
  CGMImportReport,
  WearableImportReport,
  WearableDailyItem,
  WeeklyReport,
} from './types';

// ============================================================================
// System Queries
// ============================================================================

export function useHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => apiRequest<HealthResponse>('/health'),
    refetchInterval: 30000,
  });
}

export function useDropdownParticipants() {
  return useQuery({
    queryKey: ['data', 'cgmacros-participants'],
    queryFn: () => apiRequest<DropdownItem[]>('/data/cgmacros-participants'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDropdownProfiles() {
  return useQuery({
    queryKey: ['data', 'shanghai-profiles'],
    queryFn: () => apiRequest<ShanghaiDropdownItem[]>('/data/shanghai-profiles'),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Patient Queries & Mutations
// ============================================================================

export function usePatients() {
  return useQuery({
    queryKey: ['patients'],
    queryFn: () => apiRequest<Patient[]>('/patients'),
  });
}

export function usePatient(id: number | null) {
  return useQuery({
    queryKey: ['patient', id],
    queryFn: () => apiRequest<Patient>(`/patients/${id}`),
    enabled: id !== null && id !== undefined,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PatientCreatePayload) =>
      apiRequest<Patient>('/patients', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (newPatient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      showToast({
        type: 'success',
        title: 'Patient Created',
        message: `Patient ${newPatient.display_name} (#${newPatient.id}) initialized.`,
      });
    },
  });
}

// ============================================================================
// Logging Data (Meals & Glucose Readings)
// ============================================================================

export function useLogMeal(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MealEntryCreatePayload) =>
      apiRequest<MealEntry>(`/patients/${patientId}/meals`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['timeline', patientId] });
      showToast({
        type: 'success',
        title: 'Meal Logged',
        message: 'Meal saved and metabolic twin memory updated.',
      });
    },
  });
}

export function useLogReading(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GlucoseReadingCreatePayload) =>
      apiRequest<GlucoseReading>(`/patients/${patientId}/readings`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['timeline', patientId] });
      showToast({
        type: 'success',
        title: 'Glucose Logged',
        message: 'Glucose reading recorded in timeline.',
      });
    },
  });
}

export function useTimeline(patientId: number | null) {
  return useQuery({
    queryKey: ['timeline', patientId],
    queryFn: () => apiRequest<TimelineResponse>(`/patients/${patientId}/timeline`),
    enabled: patientId !== null && patientId !== undefined,
  });
}

// ============================================================================
// Twin Engine Simulations
// ============================================================================

export function usePredictMeal(patientId: number) {
  return useMutation({
    mutationFn: (mealInput: any) =>
      apiRequest<PredictResponse>(`/patients/${patientId}/predict`, {
        method: 'POST',
        body: JSON.stringify(mealInput),
      }),
  });
}

export function useWhatIf(patientId: number) {
  return useMutation({
    mutationFn: (whatIfInput: any) =>
      apiRequest<WhatIfResponse>(`/patients/${patientId}/whatif`, {
        method: 'POST',
        body: JSON.stringify(whatIfInput),
      }),
  });
}

// ============================================================================
// Clinical Decision Support
// ============================================================================

export function useClinicalPlan(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<ClinicalPlanResponse>(`/patients/${patientId}/clinical-plan`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['therapy-scenarios', patientId] });
    },
  });
}

export function useTherapyScenarios(patientId: number | null) {
  return useQuery({
    queryKey: ['therapy-scenarios', patientId],
    queryFn: () => apiRequest<TherapyScenariosResponse>(`/patients/${patientId}/therapy-scenarios`),
    enabled: patientId !== null && patientId !== undefined,
  });
}

export function useCombinedPlan(patientId: number) {
  return useMutation({
    mutationFn: () =>
      apiRequest<CombinedPlanResponse>(`/patients/${patientId}/plan`, {
        method: 'POST',
      }),
  });
}

// ============================================================================
// Twin Engine Specialized Hooks
// ============================================================================

export function useTwinLearning(participantId: number | null) {
  return useQuery({
    queryKey: ['twin-learning', participantId],
    queryFn: () => apiRequest<TwinLearningResponse>(`/twin-learning/${participantId}`),
    enabled: participantId !== null && participantId !== undefined,
  });
}

export function useCompareMeals(patientId: number) {
  return useMutation({
    mutationFn: (payload: CompareMealsRequest) =>
      apiRequest<CompareMealsResponse>(`/patients/${patientId}/compare-meals`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

export interface BestTimeQueryParams {
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  fibre_g?: number;
  pre_glucose: number;
  pre_trend30: number;
}

export function useBestTime(patientId: number | null, params: BestTimeQueryParams | null, enabled: boolean = true) {
  const queryStr = params
    ? new URLSearchParams({
        carbs_g: String(params.carbs_g),
        protein_g: String(params.protein_g),
        fat_g: String(params.fat_g),
        fibre_g: String(params.fibre_g || 0),
        pre_glucose: String(params.pre_glucose),
        pre_trend30: String(params.pre_trend30),
      }).toString()
    : '';

  return useQuery({
    queryKey: ['best-time', patientId, queryStr],
    queryFn: () => apiRequest<BestTimeResponse>(`/patients/${patientId}/best-time?${queryStr}`),
    enabled: enabled && patientId !== null && params !== null,
  });
}

export function useDailyPlan(patientId: number) {
  return useMutation({
    mutationFn: (payload: DailyPlanRequest) =>
      apiRequest<DailyPlanResponse>(`/patients/${patientId}/daily-plan`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

export function useCohortPosition(patientId: number | null) {
  return useQuery({
    queryKey: ['cohort-position', patientId],
    queryFn: () => apiRequest<CohortPositionResponse>(`/patients/${patientId}/cohort-position`),
    enabled: patientId !== null && patientId !== undefined,
  });
}

export function useAuditLog(patientId: number | null) {
  return useQuery({
    queryKey: ['patient-audit', patientId],
    queryFn: () => apiRequest<AuditLogEntry[]>(`/patients/${patientId}/audit`),
    enabled: patientId !== null && patientId !== undefined,
  });
}

// ============================================================================
// Phase 7 Validation & CGM Replay Queries
// ============================================================================

export function useValidation() {
  return useQuery({
    queryKey: ['system', 'validation'],
    queryFn: () => apiRequest<ValidationMetricsResponse>('/system/validation'),
    retry: 1,
    staleTime: 60 * 1000,
  });
}

export function useReplayStart(participantId: number) {
  return useMutation({
    mutationFn: (payload: { speed: number }) =>
      apiRequest<ReplayStartResponse>(`/replay/${participantId}/start`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

// ============================================================================
// Clinician Panel & Alerts
// ============================================================================

export function useClinicianPanel() {
  return useQuery({
    queryKey: ['clinician-panel'],
    queryFn: () => apiRequest<ClinicianPanelItem[]>('/clinician/panel'),
    refetchInterval: 15000,
  });
}

export function useAlerts(params?: { patient_id?: number; status?: string; severity?: string }) {
  const queryStr = params
    ? new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';

  return useQuery({
    queryKey: ['alerts', queryStr],
    queryFn: () => apiRequest<Alert[]>(`/alerts${queryStr ? `?${queryStr}` : ''}`),
    refetchInterval: 10000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: number) =>
      apiRequest<Alert>(`/alerts/${alertId}/acknowledge`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['clinician-panel'] });
      showToast({ type: 'success', title: 'Alert Acknowledged', message: 'Alert has been acknowledged.' });
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: number) =>
      apiRequest<Alert>(`/alerts/${alertId}/resolve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['clinician-panel'] });
      showToast({ type: 'success', title: 'Alert Resolved', message: 'Alert has been marked as resolved.' });
    },
  });
}

export function useEvaluateAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patientId: number) =>
      apiRequest<Alert[]>(`/alerts/evaluate/${patientId}`, { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['clinician-panel'] });
      showToast({
        type: 'info',
        title: 'Rules Evaluated',
        message: `Evaluation completed. ${data.length} active alerts found.`,
      });
    },
  });
}

// ============================================================================
// Clinical Visits & 4-Week Care Pathway Queries
// ============================================================================

export function usePatientVisits(patientId: number | null) {
  return useQuery({
    queryKey: ['visits', patientId],
    queryFn: () => apiRequest<Visit[]>(`/patients/${patientId}/visits`),
    enabled: patientId !== null && patientId !== undefined,
  });
}

export const useVisits = usePatientVisits;

export function useVisit(visitId: number | null) {
  return useQuery({
    queryKey: ['visit', visitId],
    queryFn: () => apiRequest<Visit>(`/visits/${visitId}`),
    enabled: visitId !== null && visitId !== undefined,
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, notes }: { patientId: number; notes?: string }) =>
      apiRequest<Visit>(`/patients/${patientId}/visits`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visits', variables.patientId] });
      showToast({ type: 'success', title: 'Visit Scheduled', message: 'Clinical visit scheduled and pre-visit summary prepared.' });
    },
  });
}

export function useStartVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (visitId: number) =>
      apiRequest<Visit>(`/visits/${visitId}/start`, { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['visit', data.id] });
      queryClient.invalidateQueries({ queryKey: ['visits', data.patient_id] });
      showToast({ type: 'info', title: 'Visit In Progress', message: 'Consultation active. Ready for recommendation review.' });
    },
  });
}

export function useReviewDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      draftId,
      status,
      title,
      detail,
      clinician_comment,
    }: {
      draftId: number;
      visitId: number;
      status: 'approved' | 'edited' | 'rejected';
      title?: string;
      detail?: string;
      clinician_comment?: string;
    }) =>
      apiRequest<RecommendationDraft>(`/visits/drafts/${draftId}`, {
        method: 'PUT',
        body: JSON.stringify({ status, title, detail, clinician_comment }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visit', variables.visitId] });
      showToast({
        type: 'success',
        title: 'Draft Updated',
        message: `Recommendation marked as ${variables.status}.`,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Review Blocked',
        message: err?.message || 'Cannot approve draft that failed safety governor checks.',
      });
    },
  });
}

export function useCompleteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, notes }: { visitId: number; notes?: string }) =>
      apiRequest<Visit>(`/visits/${visitId}/complete${notes ? `?notes=${encodeURIComponent(notes)}` : ''}`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['visit', data.id] });
      queryClient.invalidateQueries({ queryKey: ['visits', data.patient_id] });
      queryClient.invalidateQueries({ queryKey: ['care-plan', data.patient_id] });
      showToast({
        type: 'success',
        title: 'Plan Published',
        message: 'Visit completed and 4-week actionable Care Pathway published!',
      });
    },
  });
}

export function usePatientCarePlan(patientId: number | null) {
  return useQuery({
    queryKey: ['care-plan', patientId],
    queryFn: () => apiRequest<CarePlan>(`/patients/${patientId}/care-plan`),
    enabled: patientId !== null && patientId !== undefined,
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      status,
    }: {
      taskId: number;
      patientId: number;
      status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    }) =>
      apiRequest<CarePlanTask>(`/care-plan/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['care-plan', variables.patientId] });
      showToast({
        type: 'success',
        title: 'Task Updated',
        message: `Task status updated to ${variables.status}.`,
      });
    },
  });
}

// ============================================================================
// Phase 7: Fast Food Logging, Saved Meals & Patient Home Queries
// ============================================================================

export function useFoodSearch(
  query: string,
  category?: string,
  page: number = 1,
  limit: number = 12,
  enabled: boolean = true
) {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (category && category !== 'all') params.append('category', category);
  params.append('page', String(page));
  params.append('limit', String(limit));

  return useQuery({
    queryKey: ['foods', 'search', query, category, page, limit],
    queryFn: () => apiRequest<FoodSearchResponse>(`/foods/search?${params.toString()}`),
    enabled,
    staleTime: 60000,
  });
}

export function useSavedMeals(patientId: number | null) {
  return useQuery({
    queryKey: ['saved-meals', patientId],
    queryFn: () => apiRequest<SavedMeal[]>(`/patients/${patientId}/saved-meals`),
    enabled: patientId !== null && patientId !== undefined,
  });
}

export function useCreateSavedMeal(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; items: Array<{ food_id: number; servings: number }> }) =>
      apiRequest<SavedMeal>(`/patients/${patientId}/saved-meals`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-meals', patientId] });
      showToast({
        type: 'success',
        title: 'Saved Meal Created',
        message: 'Your custom meal has been saved for fast 1-tap logging.',
      });
    },
  });
}

export function useDeleteSavedMeal(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mealId: number) =>
      apiRequest<{ message: string }>(`/patients/${patientId}/saved-meals/${mealId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-meals', patientId] });
      showToast({
        type: 'info',
        title: 'Saved Meal Deleted',
        message: 'Saved meal removed.',
      });
    },
  });
}

export function useLogSavedMeal(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId, preGlucose }: { mealId: number; preGlucose?: number }) => {
      const q = preGlucose ? `?pre_glucose=${preGlucose}` : '';
      return apiRequest<MealEntry>(`/patients/${patientId}/saved-meals/${mealId}/log${q}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
      queryClient.invalidateQueries({ queryKey: ['home-summary', patientId] });
      queryClient.invalidateQueries({ queryKey: ['alerts', patientId] });
      showToast({
        type: 'success',
        title: 'Meal Logged Instantly',
        message: 'Saved meal entry recorded and twin memory updated.',
      });
    },
  });
}

export function useEstimatePhotoMeal() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      // Raw fetch to preserve multipart boundary
      const token = localStorage.getItem('glucotwin_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/meals/estimate-from-photo', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Photo estimation failed');
      }
      return (await res.json()) as PhotoMealEstimate;
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Photo Estimation Failed',
        message: err.message || 'Could not analyze meal image.',
      });
    },
  });
}

export function usePatientMedications(patientId: number | null) {
  return useQuery({
    queryKey: ['medications', patientId],
    queryFn: () => apiRequest<Medication[]>(`/patients/${patientId}/medications`),
    enabled: patientId !== null && patientId !== undefined,
  });
}

export function useCreateMedication(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; dosage: string; schedule: string; frequency_per_day: number }) =>
      apiRequest<Medication>(`/patients/${patientId}/medications`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications', patientId] });
      queryClient.invalidateQueries({ queryKey: ['home-summary', patientId] });
      showToast({
        type: 'success',
        title: 'Medication Added',
        message: 'Medication schedule saved.',
      });
    },
  });
}

export function useUpdateDose() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      doseId,
      patientId,
      status,
      takenAt,
      notes,
    }: {
      doseId: number;
      patientId: number;
      status: 'taken' | 'skipped' | 'pending';
      takenAt?: string | null;
      notes?: string | null;
    }) =>
      apiRequest<DoseLog>(`/medications/doses/${doseId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, taken_at: takenAt, notes }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['home-summary', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['medication-adherence', variables.patientId] });
      showToast({
        type: 'success',
        title: 'Dose Updated',
        message: `Medication marked as ${variables.status}.`,
      });
    },
  });
}

export function useMedicationAdherence(patientId: number | null, daysWindow: number = 7) {
  return useQuery({
    queryKey: ['medication-adherence', patientId, daysWindow],
    queryFn: () =>
      apiRequest<AdherenceStats>(`/patients/${patientId}/medications/adherence?days_window=${daysWindow}`),
    enabled: patientId !== null && patientId !== undefined,
  });
}

export function usePatientHomeSummary(patientId: number | null) {
  return useQuery({
    queryKey: ['home-summary', patientId],
    queryFn: () => apiRequest<PatientHomeSummary>(`/patients/${patientId}/home-summary`),
    enabled: patientId !== null && patientId !== undefined,
    refetchInterval: 30000,
  });
}

// ============================================================================
// Digital Twin Lifecycle Hooks
// ============================================================================

export function useTwinAccuracy(patientId: number | null) {
  return useQuery({
    queryKey: ['twin-accuracy', patientId],
    queryFn: () => apiRequest<TwinAccuracyResponse>(`/twin/${patientId}/accuracy`),
    enabled: patientId !== null && patientId !== undefined,
    refetchInterval: 15000,
  });
}

export function useTwinMaturity(patientId: number | null) {
  return useQuery({
    queryKey: ['twin-maturity', patientId],
    queryFn: () => apiRequest<TwinMaturityResponse>(`/twin/${patientId}/maturity`),
    enabled: patientId !== null && patientId !== undefined,
    refetchInterval: 30000,
  });
}

export function useReconcileTwin(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<ReconcileResponse>(`/twin/${patientId}/reconcile`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['twin-accuracy', patientId] });
      queryClient.invalidateQueries({ queryKey: ['twin-maturity', patientId] });
      queryClient.invalidateQueries({ queryKey: ['timeline', patientId] });
      queryClient.invalidateQueries({ queryKey: ['alerts', patientId] });
      showToast({
        type: 'success',
        title: 'Reconciliation Completed',
        message: data.message,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Reconciliation Failed',
        message: err.message || 'Could not reconcile twin predictions.',
      });
    },
  });
}

// ============================================================================
// Simulation Lab: Saved Scenarios & Goal Planner
// ============================================================================

export function useSavedScenarios(patientId: number | null) {
  return useQuery({
    queryKey: ['saved-scenarios', patientId],
    queryFn: () => apiRequest<SavedScenario[]>(`/patients/${patientId}/scenarios`),
    enabled: patientId !== null && patientId !== undefined,
  });
}

export function useCreateSavedScenario(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scenarioData: {
      name: string;
      description?: string | null;
      inputs: Record<string, any>;
      baseline_output: Record<string, any>;
      intervention_output?: Record<string, any> | null;
    }) =>
      apiRequest<SavedScenario>(`/patients/${patientId}/scenarios`, {
        method: 'POST',
        body: JSON.stringify(scenarioData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-scenarios', patientId] });
      showToast({
        type: 'success',
        title: 'Scenario Saved',
        message: 'What-if simulation scenario saved successfully.',
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not save scenario.',
      });
    },
  });
}

export function useDeleteSavedScenario(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scenarioId: number) =>
      apiRequest<{ message: string; id: number }>(`/patients/${patientId}/scenarios/${scenarioId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-scenarios', patientId] });
      showToast({
        type: 'success',
        title: 'Scenario Deleted',
        message: 'Scenario removed from saved list.',
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete scenario.',
      });
    },
  });
}

export function useCompareScenarios(patientId: number) {
  return useMutation({
    mutationFn: ({ scenarioIdA, scenarioIdB }: { scenarioIdA: number; scenarioIdB: number }) =>
      apiRequest<ScenarioCompareResponse>(`/patients/${patientId}/scenarios/compare`, {
        method: 'POST',
        body: JSON.stringify({ scenario_id_a: scenarioIdA, scenario_id_b: scenarioIdB }),
      }),
  });
}

export function usePlanGoal() {
  return useMutation({
    mutationFn: (payload: {
      patient_id: number;
      target_peak_rise_limit: number;
      candidate_meals: any[];
      carb_ceiling_g?: number | null;
      foods_to_avoid?: string[];
      min_portion_pct?: number;
      max_portion_pct?: number;
      allow_timing_shift?: boolean;
      allow_walk?: boolean;
      allow_meal_order?: boolean;
      seed?: number;
    }) =>
      apiRequest<PlanGoalResponse>('/twin/plan-goal', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

export function useApplyGoalPlan(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, tasks }: { planId: string; tasks: any[] }) =>
      apiRequest<{ message: string; care_plan_id: number; task_count: number }>('/twin/apply-plan', {
        method: 'POST',
        body: JSON.stringify({ patient_id: patientId, plan_id: planId, tasks }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['care-plans', patientId] });
      queryClient.invalidateQueries({ queryKey: ['timeline', patientId] });
      showToast({
        type: 'success',
        title: 'Added to Care Plan',
        message: data.message,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Could not add tasks to care plan.',
      });
    },
  });
}

// ============================================================================
// Platform Glue: Messaging Hooks
// ============================================================================

export function useThreads(patientId?: number) {
  return useQuery({
    queryKey: ['messages', 'threads', patientId],
    queryFn: () => {
      const qs = patientId ? `?patient_id=${patientId}` : '';
      return apiRequest<MessageThread[]>(`/messages/threads${qs}`);
    },
    refetchInterval: 15000,
  });
}

export function useThreadDetail(threadId?: number) {
  return useQuery({
    queryKey: ['messages', 'thread', threadId],
    queryFn: () => apiRequest<MessageThread>(`/messages/threads/${threadId}`),
    enabled: typeof threadId === 'number' && threadId > 0,
    refetchInterval: 10000,
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ThreadCreatePayload) =>
      apiRequest<MessageThread>('/messages/threads', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'threads'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
      showToast({
        type: 'success',
        title: 'Thread Created',
        message: `Thread "${data.title}" started with your care team.`,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Thread Creation Failed',
        message: err.message || 'Could not create message thread.',
      });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, content }: { threadId: number; content: string }) =>
      apiRequest<Message>(`/messages/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'thread', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'threads'] });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Send Message Failed',
        message: err.message || 'Could not send message.',
      });
    },
  });
}

export function useMarkThreadRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: number) =>
      apiRequest<{ status: string; thread_id: number; unread_count: number }>(`/messages/threads/${threadId}/read`, {
        method: 'POST',
      }),
    onSuccess: (_data, threadId) => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'threads'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
    },
  });
}

export function useUnreadMessagesCount() {
  return useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: () => apiRequest<{ unread_count: number }>('/messages/unread-count'),
    refetchInterval: 30000,
  });
}

// ============================================================================
// Platform Glue: Data Import & Wearables Hooks
// ============================================================================

export function useImportCGM() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, patientId }: { file: File; patientId: number }) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiRequest<CGMImportReport>(`/import/cgm?patient_id=${patientId}`, {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timeline', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['alerts', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['twin-accuracy', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['twin-maturity', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-home', variables.patientId] });
      showToast({
        type: 'success',
        title: 'CGM Import Completed',
        message: data.message,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'CGM Import Failed',
        message: err.message || 'Failed to process CGM CSV file.',
      });
    },
  });
}

export function useImportWearables() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, patientId }: { file: File; patientId: number }) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiRequest<WearableImportReport>(`/import/wearables?patient_id=${patientId}`, {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wearables', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['weekly-report', variables.patientId] });
      showToast({
        type: 'success',
        title: 'Wearables Import Completed',
        message: data.message,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Wearables Import Failed',
        message: err.message || 'Failed to process wearables CSV file.',
      });
    },
  });
}

export function useWearables(patientId?: number, limit: number = 30) {
  return useQuery({
    queryKey: ['wearables', patientId, limit],
    queryFn: () => apiRequest<WearableDailyItem[]>(`/patients/${patientId}/wearables?limit=${limit}`),
    enabled: typeof patientId === 'number' && patientId > 0,
  });
}

// ============================================================================
// Platform Glue: Weekly Reports & FHIR Interoperability Hooks
// ============================================================================

export function useWeeklyReport(patientId?: number, periodDays: number = 7) {
  return useQuery({
    queryKey: ['weekly-report', patientId, periodDays],
    queryFn: () => apiRequest<WeeklyReport>(`/reports/weekly/${patientId}?period_days=${periodDays}`),
    enabled: typeof patientId === 'number' && patientId > 0,
  });
}

export function useGenerateWeeklyReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, periodDays = 7 }: { patientId: number; periodDays?: number }) =>
      apiRequest<WeeklyReport>(`/reports/weekly/${patientId}/generate?period_days=${periodDays}`, {
        method: 'POST',
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['weekly-report', variables.patientId] });
      showToast({
        type: 'success',
        title: 'Weekly Report Generated',
        message: `Weekly metabolic report for ${data.patient_name} generated successfully.`,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Report Generation Failed',
        message: err.message || 'Could not generate weekly report.',
      });
    },
  });
}

export function useFhirExport(patientId?: number) {
  return useQuery({
    queryKey: ['export', 'fhir', patientId],
    queryFn: () => apiRequest<any>(`/export/fhir/${patientId}`),
    enabled: typeof patientId === 'number' && patientId > 0,
  });
}


