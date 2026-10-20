import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VisitWorkspace } from '../pages/VisitWorkspace';
import { MyPlanPage } from '../pages/MyPlan';
import * as ClientModule from '../api/client';
import * as AppContextModule from '../context/AppContext';
import * as AuthContextModule from '../context/AuthContext';
import { Visit, CarePlan, CarePlanTask, RecommendationDraft } from '../api/types';

const mockDrafts: RecommendationDraft[] = [
  {
    id: 1,
    visit_id: 10,
    patient_id: 1,
    category: 'Medication',
    title: 'Initiate SGLT2 Inhibitor Therapy',
    detail: 'Add Empagliflozin 10mg daily to improve glycemic control and cardiorenal protection.',
    payload: {},
    status: 'draft',
    governor_trace: {
      blocked: false,
      clean: true,
      rules_triggered: ['R1', 'R2', 'R5'],
      reason: undefined,
    },
    created_at: '2026-10-19T10:00:00',
  },
  {
    id: 2,
    visit_id: 10,
    patient_id: 1,
    category: 'Medication',
    title: 'Inappropriate High Dose Metformin',
    detail: 'Increase metformin dosage despite severely impaired eGFR.',
    payload: {},
    status: 'draft',
    governor_trace: {
      blocked: true,
      clean: false,
      rules_triggered: ['R1', 'R5'],
      reason: 'R5 VIOLATION: Cannot prescribe metformin with eGFR < 30 mL/min',
    },
    created_at: '2026-10-19T10:00:00',
  },
  {
    id: 3,
    visit_id: 10,
    patient_id: 1,
    category: 'Lifestyle',
    title: 'Post-Meal Walking Routine',
    detail: '15-minute brisk walk after lunch and dinner to reduce glucose spikes.',
    payload: {},
    status: 'approved',
    governor_trace: {
      blocked: false,
      clean: true,
      rules_triggered: ['R3'],
      reason: undefined,
    },
    created_at: '2026-10-19T10:00:00',
  },
];

const mockVisit: Visit = {
  id: 10,
  patient_id: 1,
  clinician_id: 2,
  scheduled_at: '2026-10-20T14:00:00',
  status: 'in_progress',
  pre_visit_summary: {
    patient_id: 1,
    patient_name: 'Anita Sharma',
    generated_at: '2026-10-19T09:00:00',
    glucose_stats_14d: {
      days_window: 14,
      reading_count: 56,
      mean_mgdl: 158.4,
      std_mgdl: 28.5,
      min_mgdl: 68.0,
      max_mgdl: 265.0,
      time_in_range_pct: 64.2,
      hypo_events_count: 1,
      critical_hypo_count: 0,
      hyper_events_count: 4,
    },
    twin_patterns: {
      mem_n: 14,
      mem_mean_rise: 38.5,
      mem_mean_iauc: 1420.0,
      baseline_used: false,
      representative_meal_rise_mgdl: 42.0,
      carb_sensitivity: 'Elevated',
    },
    open_alerts: [
      {
        id: 101,
        rule_key: 'post_meal_peaks',
        severity: 'warning',
        message: '3 post-meal peaks above 250 mg/dL',
      },
    ],
    open_alerts_count: 1,
    biomarkers: {
      hba1c_pct: 7.8,
      fasting_glucose_mgdl: 145.0,
      kidney_flag: false,
      estimated_egfr: 68.0,
      bmi: 27.4,
    },
    medication_adherence: {
      current_meds: ['Metformin 500mg BID'],
      estimated_adherence_pct: 95.0,
      status: 'Optimal Adherence',
    },
    clinical_focus: 'Post-prandial glycemic excursions and meal-walk timing.',
  },
  notes: 'Metabolic review in progress.',
  final_plan: null,
  drafts: mockDrafts,
  created_at: '2026-10-19T09:00:00',
};

const mockTasks: CarePlanTask[] = [
  {
    id: 101,
    care_plan_id: 1,
    patient_id: 1,
    title: 'Begin 15-minute post-lunch walk',
    category: 'Lifestyle',
    assigned_to: 'patient',
    status: 'completed',
    due_date: '2026-10-25T00:00:00',
    completed_at: '2026-10-21T11:00:00',
  },
  {
    id: 102,
    care_plan_id: 1,
    patient_id: 1,
    title: 'Monitor fasting blood glucose daily for 7 days',
    category: 'Monitoring',
    assigned_to: 'patient',
    status: 'pending',
    due_date: '2026-10-28T00:00:00',
    completed_at: null,
  },
];

const mockCarePlan: CarePlan = {
  id: 1,
  patient_id: 1,
  visit_id: 10,
  title: '4-Week Glycemic Stabilization Pathway',
  status: 'active',
  tasks: mockTasks,
  created_at: '2026-10-19T10:00:00',
  updated_at: '2026-10-19T10:00:00',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Clinician-Reviewed Visit Workflow & Patient Care Plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      activePatientId: 1,
      setActivePatientId: vi.fn(),
      viewMode: 'clinician',
      setViewMode: vi.fn(),
      toggleViewMode: vi.fn(),
      isSidebarCollapsed: false,
      toggleSidebar: vi.fn(),
      currentPatient: { id: 1, name: 'John Doe' },
    } as any);

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 2,
        email: 'dr.smith@hospital.org',
        full_name: 'Dr. Sarah Smith',
        role: 'clinician',
      },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
    } as any);
  });

  describe('VisitWorkspace Component', () => {
    it('renders 3-panel workspace: pre-visit summary, recommendations, and plan preview', async () => {
      vi.spyOn(ClientModule, 'apiRequest').mockImplementation((path: string) => {
        if (path === '/patients/1/visits') {
          return Promise.resolve([mockVisit]);
        }
        if (path === '/visits/10') {
          return Promise.resolve(mockVisit);
        }
        return Promise.resolve({});
      });

      render(<VisitWorkspace />, { wrapper: createWrapper() });

      // Check header
      expect(await screen.findByText('Clinical Visit & Care Pathway Review')).toBeInTheDocument();

      // Check Left Panel (Pre-Visit Summary)
      expect(await screen.findByText('Pre-Visit Summary')).toBeInTheDocument();
      expect(screen.getByText('158.4')).toBeInTheDocument(); // Mean glucose
      expect(screen.getByText('64.2%')).toBeInTheDocument(); // Time in range
      expect(screen.getByText(/7.8%/)).toBeInTheDocument(); // HbA1c
      expect(screen.getByText(/Optimal Adherence/)).toBeInTheDocument(); // Medication Adherence

      // Check Middle Panel (Recommendation Drafts)
      expect(screen.getByText(/Recommendation Drafts/)).toBeInTheDocument();
      expect(screen.getByText('Initiate SGLT2 Inhibitor Therapy')).toBeInTheDocument();
      expect(screen.getByText('Inappropriate High Dose Metformin')).toBeInTheDocument();

      // Check Right Panel (Plan Preview)
      expect(screen.getByText('Plan Preview')).toBeInTheDocument();
      expect(screen.getByText('Complete & Publish Plan')).toBeInTheDocument();
    });

    it('enforces safety governor: disables approve button for governor-blocked draft', async () => {
      vi.spyOn(ClientModule, 'apiRequest').mockImplementation((path: string) => {
        if (path === '/patients/1/visits') return Promise.resolve([mockVisit]);
        if (path === '/visits/10') return Promise.resolve(mockVisit);
        return Promise.resolve({});
      });

      render(<VisitWorkspace />, { wrapper: createWrapper() });

      await screen.findByText('Inappropriate High Dose Metformin');

      // Check violation tag
      expect(screen.getByText(/Governor Blocked/i)).toBeInTheDocument();
      expect(
        screen.getByText(/R5 VIOLATION: Cannot prescribe metformin with eGFR < 30/i)
      ).toBeInTheDocument();

      // The blocked draft button should be disabled
      const blockedApproveBtn = screen.getByTestId('approve-draft-2');
      expect(blockedApproveBtn).toBeDisabled();
      expect(blockedApproveBtn).toHaveTextContent('Blocked by Governor');

      // The unblocked draft button should be enabled
      const safeApproveBtn = screen.getByTestId('approve-draft-1');
      expect(safeApproveBtn).not.toBeDisabled();
      expect(safeApproveBtn).toHaveTextContent('Approve');
    });

    it('allows approving an eligible draft and calls the draft review endpoint', async () => {
      const apiSpy = vi.spyOn(ClientModule, 'apiRequest').mockImplementation((path: string, options?: any) => {
        if (path === '/patients/1/visits') return Promise.resolve([mockVisit]);
        if (path === '/visits/10') return Promise.resolve(mockVisit);
        if (path === '/visits/drafts/1' && options?.method === 'PUT') {
          return Promise.resolve({ ...mockDrafts[0], status: 'approved' });
        }
        return Promise.resolve({});
      });

      render(<VisitWorkspace />, { wrapper: createWrapper() });

      await screen.findByText('Initiate SGLT2 Inhibitor Therapy');

      const safeApproveBtn = screen.getByTestId('approve-draft-1');
      fireEvent.click(safeApproveBtn);

      await waitFor(() => {
        expect(apiSpy).toHaveBeenCalledWith(
          '/visits/drafts/1',
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('"status":"approved"'),
          })
        );
      });
    });

    it('allows completing a visit and publishing the final plan', async () => {
      const apiSpy = vi.spyOn(ClientModule, 'apiRequest').mockImplementation((path: string, options?: any) => {
        if (path === '/patients/1/visits') return Promise.resolve([mockVisit]);
        if (path === '/visits/10') return Promise.resolve(mockVisit);
        if (path.startsWith('/visits/10/complete') && options?.method === 'POST') {
          return Promise.resolve({ ...mockVisit, status: 'completed' });
        }
        return Promise.resolve({});
      });

      render(<VisitWorkspace />, { wrapper: createWrapper() });

      await screen.findByText('Complete & Publish Plan');

      // Fill in consultation notes
      const notesInput = screen.getByPlaceholderText(/Enter consultation synthesis/i);
      fireEvent.change(notesInput, { target: { value: 'Reviewed telemetry; started lifestyle routine.' } });

      // Click Complete & Publish Plan
      const completeBtn = screen.getByText('Complete & Publish Plan');
      fireEvent.click(completeBtn);

      await waitFor(() => {
        expect(apiSpy).toHaveBeenCalledWith(
          expect.stringContaining('/visits/10/complete'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });
  });

  describe('MyPlanPage (Patient View)', () => {
    beforeEach(() => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: {
          id: 1,
          email: 'john@example.com',
          full_name: 'John Doe',
          role: 'patient',
        },
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      } as any);
    });

    it('renders 4-week pathway tasks, progress percentage, and upcoming visit info', async () => {
      vi.spyOn(ClientModule, 'apiRequest').mockImplementation((path: string) => {
        if (path === '/patients/1/care-plan') return Promise.resolve(mockCarePlan);
        if (path === '/patients/1/visits') return Promise.resolve([mockVisit]);
        return Promise.resolve({});
      });

      render(<MyPlanPage />, { wrapper: createWrapper() });

      expect(await screen.findByText('My Personalized Care Plan')).toBeInTheDocument();

      // Progress bar should reflect 1 of 2 tasks completed = 50%
      expect(await screen.findByText('50%')).toBeInTheDocument();
      expect(screen.getByText(/1 of 2 action milestones completed/i)).toBeInTheDocument();

      // Task list items
      expect(screen.getByText('Begin 15-minute post-lunch walk')).toBeInTheDocument();
      expect(screen.getByText('Monitor fasting blood glucose daily for 7 days')).toBeInTheDocument();

      // Upcoming visit banner
      expect(screen.getByText('Upcoming Consultation')).toBeInTheDocument();
    });

    it('toggles task completion status on click', async () => {
      const apiSpy = vi.spyOn(ClientModule, 'apiRequest').mockImplementation((path: string, options?: any) => {
        if (path === '/patients/1/care-plan') return Promise.resolve(mockCarePlan);
        if (path === '/patients/1/visits') return Promise.resolve([mockVisit]);
        if (path === '/care-plan/tasks/102' && options?.method === 'PATCH') {
          return Promise.resolve({ ...mockTasks[1], status: 'completed' });
        }
        return Promise.resolve({});
      });

      render(<MyPlanPage />, { wrapper: createWrapper() });

      const pendingTask = await screen.findByText('Monitor fasting blood glucose daily for 7 days');
      fireEvent.click(pendingTask);

      await waitFor(() => {
        expect(apiSpy).toHaveBeenCalledWith(
          '/care-plan/tasks/102',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ status: 'completed' }),
          })
        );
      });
    });
  });
});
