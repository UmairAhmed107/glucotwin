import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, showToast } from './client';
import {
  AuditLogEntry,
  BestTimeResponse,
  ClinicalPlanResponse,
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
  ReplayStartResponse,
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

