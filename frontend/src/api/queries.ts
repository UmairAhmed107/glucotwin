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


