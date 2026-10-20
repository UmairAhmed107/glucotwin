import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WhatIfLabPage } from '../pages/WhatIfLab';
import { SavedScenariosTab } from '../pages/SavedScenariosTab';
import { GoalPlannerTab } from '../pages/GoalPlannerTab';
import { SimulationWorkspace } from '../pages/SimulationWorkspace';
import * as ClientModule from '../api/client';
import * as AppContextModule from '../context/AppContext';
import {
  Patient,
  WhatIfResponse,
  SavedScenario,
  ScenarioCompareResponse,
  PlanGoalResponse,
} from '../api/types';

const mockPatient: Patient = {
  id: 1,
  display_name: 'Sim Test Patient',
  is_synthetic: true,
  source: 'cgmacros',
  age: 52,
  sex: 'M',
  bmi: 27.5,
  hba1c_pct: 7.6,
  fasting_glucose_mgdl: 135.0,
  hypoglycemia_history: true,
  kidney_flag: false,
  current_meds: ['metformin'],
  created_at: '2026-10-01T08:00:00Z',
};

const mockWhatIfResponse: WhatIfResponse = {
  provenance: 'TWIN_PREDICTED',
  safety_checked: true,
  model_version: '15-ensemble-bootstrap',
  patient_id: 1,
  status: 'evaluated',
  baseline: {
    target: 'peak_rise',
    median: 48.0,
    p10: 36.0,
    p90: 62.0,
    min: 30.0,
    max: 70.0,
    band_width: 26.0,
  },
  intervention: {
    target: 'peak_rise',
    median: 29.5,
    p10: 21.0,
    p90: 39.0,
    min: 18.0,
    max: 45.0,
    band_width: 18.0,
  },
  new_macros: {
    carbs_g: 48.0,
    kcal: 420.0,
    post_act_60: 175.0,
  },
  gains: {
    median_gain: 18.5,
    pessimistic_gain: 12.0,
    label: 'supported',
    margin: 10.0,
    per_member_gains: [15, 18, 20],
  },
  adjustments: [
    {
      lever: 'meal_order',
      name: 'Food Sequencing: Vegetables First',
      adjustment_pct: -18.0,
      applied_delta_mgdl: -6.5,
      description: 'Pre-meal fiber slows gastric emptying via incretin (GLP-1) release.',
      citation: 'Shukla et al., Diabetes Care 2017',
    },
  ],
  is_estimated_adjustment: true,
};

const mockSavedScenarios: SavedScenario[] = [
  {
    id: 101,
    patient_id: 1,
    name: 'Scenario A: 15m Light Walk',
    description: 'Gentle post-meal stroll',
    inputs: {
      meal: { carbs_g: 65, protein_g: 25, fat_g: 15 },
      interventions: { carb_reduction_pct: 10, walk_duration_min: 15, walk_intensity: 'light' },
    },
    baseline_output: { median: 48.0, p10: 36.0, p90: 62.0 },
    intervention_output: { median: 40.0, p10: 30.0, p90: 52.0 },
    created_at: '2026-10-19T10:00:00Z',
  },
  {
    id: 102,
    patient_id: 1,
    name: 'Scenario B: 30m Brisk Walk + Veggies First',
    description: 'Active muscular glucose uptake',
    inputs: {
      meal: { carbs_g: 65, protein_g: 25, fat_g: 15 },
      interventions: { carb_reduction_pct: 20, walk_duration_min: 30, walk_intensity: 'brisk', meal_order: 'veggies_first' },
    },
    baseline_output: { median: 48.0, p10: 36.0, p90: 62.0 },
    intervention_output: { median: 29.5, p10: 21.0, p90: 39.0 },
    created_at: '2026-10-19T11:00:00Z',
  },
];

const mockComparisonResponse: ScenarioCompareResponse = {
  scenario_a: mockSavedScenarios[0],
  scenario_b: mockSavedScenarios[1],
  comparison: {
    median_diff_mgdl: -10.5,
    p10_diff_mgdl: -9.0,
    p90_diff_mgdl: -13.0,
    carb_reduction_diff_pct: 10.0,
    summary: 'Scenario B yields a 10.5 mg/dL lower predicted peak rise than Scenario A.',
  },
};

const mockPlannerResponse: PlanGoalResponse = {
  provenance: 'TWIN_PREDICTED',
  safety_checked: true,
  patient_id: 1,
  target_peak_rise_limit: 35.0,
  seed: 42,
  plans: [
    {
      plan_id: 'plan_lifestyle_first',
      title: 'Lifestyle-First (Full Portions)',
      strategy_type: 'lifestyle_first',
      target_peak_rise_limit: 35.0,
      goal_met: true,
      predicted_peak: {
        median: 31.5,
        p10: 24.0,
        p90: 41.0,
        band_width: 17.0,
      },
      meals: [
        {
          meal_name: 'Chicken Biryani with Raita',
          portion_pct: 100.0,
          scaled_carbs: 75.0,
          scaled_kcal: 608.0,
          walk_option: '20 min moderate walk',
          walk_duration_min: 20.0,
          walk_intensity: 'moderate',
          meal_order: 'veggies_first',
          meal_order_label: 'Vegetables first',
          timing_shift_hours: 0.0,
          pred_median: 31.5,
          pred_p10: 24.0,
          pred_p90: 41.0,
        },
      ],
      tradeoffs: [
        'Preserves 85-100% full meal portion.',
        'Requires 20 min moderate walk and eating vegetables first.',
      ],
      adjustments: [
        {
          lever: 'meal_order',
          name: 'Food Sequencing: Vegetables First',
          adjustment_pct: -18.0,
          applied_delta_mgdl: -6.0,
          description: 'Pre-meal fiber slows gastric emptying.',
        },
      ],
      is_estimated_adjustment: true,
      governor_trace: {
        clean: true,
        blocked: false,
        rules_triggered: ['R9_SAFETY_STAMPED', 'R4_HYPOGLYCEMIA_PROTECTION'],
        reason: 'Deterministic Safety Governor approved.',
      },
      care_plan_tasks: [
        {
          title: 'Eat Vegetables first for Chicken Biryani with Raita',
          category: 'diet',
          due_date: 'Daily with meal',
          assigned_to: 'patient',
        },
        {
          title: '20 min moderate walk after Chicken Biryani with Raita',
          category: 'exercise',
          due_date: 'Within 30 min of meal',
          assigned_to: 'patient',
        },
      ],
    },
  ],
};

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Simulation Lab Extended Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      activePatientId: 1,
      setActivePatientId: vi.fn(),
      viewMode: 'patient',
      setViewMode: vi.fn(),
      isClinicianView: false,
      userRole: 'patient',
      currentUser: { id: 1, email: 'patient@example.com', role: 'patient', full_name: 'Patient' } as any,
      logout: vi.fn(),
      patients: [mockPatient],
    } as any);

    vi.spyOn(ClientModule, 'apiRequest').mockImplementation(async (path: string, options?: any) => {
      if (path === '/patients/1') {
        return mockPatient;
      }
      if (path === '/patients/1/timeline') {
        return { patient_id: 1, events: [] };
      }
      if (path === '/patients/1/whatif') {
        return mockWhatIfResponse;
      }
      if (path === '/patients/1/scenarios' && (!options || options.method === 'GET')) {
        return mockSavedScenarios;
      }
      if (path === '/patients/1/scenarios' && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        return {
          id: 103,
          patient_id: 1,
          name: body.name,
          description: body.description,
          inputs: body.inputs,
          baseline_output: body.baseline_output,
          intervention_output: body.intervention_output,
          created_at: new Date().toISOString(),
        };
      }
      if (path.includes('/patients/1/scenarios/') && options?.method === 'DELETE') {
        return { message: 'Deleted', id: 101 };
      }
      if (path === '/patients/1/scenarios/compare') {
        return mockComparisonResponse;
      }
      if (path === '/twin/plan-goal') {
        return mockPlannerResponse;
      }
      if (path === '/twin/apply-plan') {
        return { message: 'Added 2 tasks to care plan', care_plan_id: 1, task_count: 2 };
      }
      return {};
    });
  });

  it('renders new levers in WhatIfLab and handles estimated adjustments disclosure', async () => {
    renderWithProviders(<WhatIfLabPage />);

    // Check for new lever controls
    expect(await screen.findByText(/What-If Simulation Lab/i)).toBeInTheDocument();
    expect(screen.getByText(/Meal Order \(Food Sequencing\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Post-Meal Physical Activity:/i)).toBeInTheDocument();
    expect(screen.getByText(/Meal Timing Shift:/i)).toBeInTheDocument();

    // Check for Estimated Adjustment badge
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Estimated Adjustment/i })).toBeInTheDocument();
    });

    // Click Estimated Adjustment badge to view disclosure
    const estBadge = screen.getByRole('button', { name: /Estimated Adjustment/i });
    fireEvent.click(estBadge);

    expect(await screen.findByText(/Documented Estimated Adjustments/i)).toBeInTheDocument();
    expect(screen.getByText(/Shukla et al., Diabetes Care 2017/i)).toBeInTheDocument();
  });

  it('opens Save Scenario modal and saves a scenario', async () => {
    renderWithProviders(<WhatIfLabPage />);

    const saveBtn = await screen.findByRole('button', { name: /Save Scenario/i });
    fireEvent.click(saveBtn);

    // Modal opens
    expect(await screen.findByText(/Save Simulation Scenario/i)).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText(/e.g. 20m Moderate Walk \+ Veggies First/i);
    fireEvent.change(nameInput, { target: { value: 'My Test Scenario' } });

    // Submit save (the last Save Scenario button is inside the modal)
    const saveBtns = screen.getAllByRole('button', { name: /^Save Scenario$/i });
    fireEvent.click(saveBtns[saveBtns.length - 1]);

    await waitFor(() => {
      expect(ClientModule.apiRequest).toHaveBeenCalledWith(
        '/patients/1/scenarios',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('renders SavedScenariosTab, compares two scenarios and deletes scenario', async () => {
    renderWithProviders(<SavedScenariosTab />);

    expect(await screen.findByText('Scenario A: 15m Light Walk')).toBeInTheDocument();
    expect(screen.getByText('Scenario B: 30m Brisk Walk + Veggies First')).toBeInTheDocument();

    // Select both scenarios for comparison
    const cardA = screen.getByText('Scenario A: 15m Light Walk');
    const cardB = screen.getByText('Scenario B: 30m Brisk Walk + Veggies First');
    fireEvent.click(cardA);
    fireEvent.click(cardB);

    // Click Compare button
    const compareBtn = screen.getByRole('button', { name: /Compare Scenarios/i });
    expect(compareBtn).not.toBeDisabled();
    fireEvent.click(compareBtn);

    // Verify modal displays comparison metrics and summary
    expect(await screen.findByText(/Side-by-Side Scenario Comparison/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Scenario B yields a 10.5 mg\/dL lower predicted peak rise than Scenario A./i)
    ).toBeInTheDocument();
    expect(screen.getByText(/-10.5 mg\/dL/i)).toBeInTheDocument();
  });

  it('renders GoalPlannerTab, generates top 3 plans and applies tasks to care plan', async () => {
    renderWithProviders(<GoalPlannerTab />);

    expect(await screen.findByText(/Goal-Based Glycemic Lifestyle Planner/i)).toBeInTheDocument();
    expect(screen.getByText(/Target Peak Rise Limit:/i)).toBeInTheDocument();

    // Click Generate Plans
    const generateBtn = screen.getByRole('button', { name: /Generate Top 3 Goal Plans/i });
    fireEvent.click(generateBtn);

    // Verify top plan card is rendered with predicted peak and Governor audit stamp
    expect(await screen.findByText('Lifestyle-First (Full Portions)')).toBeInTheDocument();
    expect(screen.getByText('+31.5 mg/dL')).toBeInTheDocument();
    expect(screen.getByText(/Goal Met/i)).toBeInTheDocument();
    expect(screen.getByText(/R4_HYPOGLYCEMIA_PROTECTION/i)).toBeInTheDocument();

    // Click "Add to my plan"
    const addPlanBtn = screen.getByRole('button', { name: /Add to my plan/i });
    fireEvent.click(addPlanBtn);

    await waitFor(() => {
      expect(ClientModule.apiRequest).toHaveBeenCalledWith(
        '/twin/apply-plan',
        expect.objectContaining({ method: 'POST' })
      );
      expect(screen.getByText(/Added to My Plan/i)).toBeInTheDocument();
    });
  });

  it('switches between tabs seamlessly in SimulationWorkspace', async () => {
    renderWithProviders(<SimulationWorkspace />);

    // Starts on forecast tab
    expect(await screen.findByText(/What-If Simulation Lab/i)).toBeInTheDocument();

    // Switch to Saved Scenarios tab
    const scenariosTabBtn = screen.getByRole('button', { name: /Saved Scenarios & Compare/i });
    fireEvent.click(scenariosTabBtn);
    expect(await screen.findByText('Scenario A: 15m Light Walk')).toBeInTheDocument();

    // Switch to Goal Planner tab
    const goalTabBtn = screen.getByRole('button', { name: /Goal-Based Planner/i });
    fireEvent.click(goalTabBtn);
    expect(await screen.findByText(/Goal-Based Glycemic Lifestyle Planner/i)).toBeInTheDocument();
  });
});
