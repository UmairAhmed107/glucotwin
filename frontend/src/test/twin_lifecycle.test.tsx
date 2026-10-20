import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TwinOverview } from '../pages/TwinOverview';
import { TimelinePage } from '../pages/Timeline';
import * as ClientModule from '../api/client';
import * as AppContextModule from '../context/AppContext';
import {
  Patient,
  TwinAccuracyResponse,
  TwinMaturityResponse,
  TimelineResponse,
} from '../api/types';

const mockPatient: Patient = {
  id: 1,
  display_name: 'Ananya Roy',
  is_synthetic: false,
  source: 'new',
  age: 52,
  sex: 'F',
  bmi: 26.8,
  hba1c_pct: 7.2,
  fasting_glucose_mgdl: 116.0,
  hypoglycemia_history: false,
  kidney_flag: false,
  current_meds: ['Metformin 500mg'],
  created_at: '2026-10-01T08:00:00Z',
  twin_state: {
    patient_id: 1,
    mem_mean_rise: 34.5,
    mem_mean_iauc: 2450.0,
    mem_n: 18,
    confidence_score: 0.82,
    updated_at: '2026-10-19T12:00:00Z',
  },
};

const mockAccuracyStable: TwinAccuracyResponse = {
  patient_id: 1,
  total_predictions: 18,
  reconciled_count: 18,
  overall_mae: 12.4,
  rolling_mae_20: 11.8,
  interval_coverage_pct: 83.3,
  drift_detected: false,
  drift_details: null,
  history: [
    {
      id: 101,
      meal_id: 1,
      created_at: '2026-10-18T12:00:00Z',
      predicted_peak_rise: 38.0,
      p10: 28.0,
      p90: 48.0,
      actual_peak_rise: 36.5,
      actual_iauc_2h: 45.6,
      error: -1.5,
      in_range: true,
      reconciled_at: '2026-10-18T15:00:00Z',
      rolling_mae: 11.8,
      model_version: '15-ensemble-bootstrap',
    },
    {
      id: 102,
      meal_id: 2,
      created_at: '2026-10-19T08:00:00Z',
      predicted_peak_rise: 42.0,
      p10: 32.0,
      p90: 52.0,
      actual_peak_rise: 44.0,
      actual_iauc_2h: 55.0,
      error: 2.0,
      in_range: true,
      reconciled_at: '2026-10-19T11:00:00Z',
      rolling_mae: 11.5,
      model_version: '15-ensemble-bootstrap',
    },
  ],
};

const mockAccuracyDrift: TwinAccuracyResponse = {
  ...mockAccuracyStable,
  drift_detected: true,
  interval_coverage_pct: 50.0,
  drift_details: {
    reason: 'Interval coverage (50.0%) dropped below the 60% minimum threshold',
    baseline_mae: 12.0,
    recent_mae: 19.5,
    coverage_pct: 50.0,
    suggested_causes: ['medication change', 'illness / physiological stress', 'sensor calibration issue'],
  },
};

const mockMaturity: TwinMaturityResponse = {
  patient_id: 1,
  score: 74.5,
  level: 'Personalized',
  description: 'Twin has established strong individual postprandial memory and accurate glycemic forecasting.',
  components: {
    memory_score: 33.4,
    accuracy_score: 22.5,
    calibration_score: 25.0,
    mem_n: 18,
    recent_mae: 11.8,
    coverage_pct: 83.3,
  },
  next_milestone: 'Maintain steady postprandial tracking with rolling MAE <= 16 mg/dL to achieve Well-calibrated status.',
  timeline: [
    { level: 'Population', reached_at: '2026-10-01T08:00:00Z', description: 'Baseline population metabolic priors initialized.', unlocked: true },
    { level: 'Learning', reached_at: '2026-10-06T12:00:00Z', description: 'Achieved initial 5+ postprandial observations.', unlocked: true },
    { level: 'Personalized', reached_at: '2026-10-15T18:00:00Z', description: 'Achieved 15+ meals with tailored glycemic patterns.', unlocked: true },
    { level: 'Well-calibrated', reached_at: null, description: 'Requires score >= 80, 20+ meals, MAE <= 16 mg/dL, and coverage >= 70%.', unlocked: false },
  ],
};

const mockTimeline: TimelineResponse = {
  patient_id: 1,
  events: [
    {
      type: 'meal',
      id: 1,
      timestamp: '2026-10-18T12:00:00Z',
      data: {
        id: 1,
        patient_id: 1,
        logged_at: '2026-10-18T12:00:00Z',
        carbs_g: 50.0,
        protein_g: 20.0,
        fat_g: 12.0,
        calories: 388.0,
        pre_glucose: 104.0,
        pre_trend30: 0.0,
        observed_peak_rise: 36.5,
        prediction: {
          id: 101,
          predicted_peak_rise: 38.0,
          p10: 28.0,
          p90: 48.0,
          actual_peak_rise: 36.5,
          error: -1.5,
          in_range: true,
          reconciled_at: '2026-10-18T15:00:00Z',
        },
      },
    },
    {
      type: 'meal',
      id: 2,
      timestamp: '2026-10-19T08:00:00Z',
      data: {
        id: 2,
        patient_id: 1,
        logged_at: '2026-10-19T08:00:00Z',
        carbs_g: 65.0,
        protein_g: 15.0,
        fat_g: 10.0,
        calories: 410.0,
        pre_glucose: 112.0,
        pre_trend30: 0.0,
        prediction: {
          id: 102,
          predicted_peak_rise: 44.0,
          p10: 34.0,
          p90: 54.0,
          reconciled_at: null,
        },
      },
    },
  ],
};

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Digital Twin Lifecycle & Health Section', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      activePatientId: 1,
      viewMode: 'patient',
      role: 'patient',
      setActivePatientId: vi.fn(),
      setViewMode: vi.fn(),
    } as any);

    // Global ResizeObserver mock for Recharts
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('renders the Twin Health & Calibration section with maturity and calibration cards', async () => {
    vi.spyOn(ClientModule, 'apiRequest').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/patients/1') return mockPatient;
      if (endpoint === '/twin/1/accuracy') return mockAccuracyStable;
      if (endpoint === '/twin/1/maturity') return mockMaturity;
      if (endpoint === '/patients/1/timeline') return mockTimeline;
      return {};
    });

    renderWithProviders(<TwinOverview />);

    // Check Twin Health header
    expect(await screen.findByText('Twin Health & Calibration')).toBeInTheDocument();

    // Check Maturity Tier badge and components
    expect(screen.getAllByText('Personalized')[0]).toBeInTheDocument();
    expect(screen.getByText('74.5')).toBeInTheDocument();
    expect(screen.getByText('Memory Volume (40 pts)')).toBeInTheDocument();
    expect(screen.getByText('Recent Accuracy (30 pts)')).toBeInTheDocument();
    expect(screen.getByText('Interval Calibration (30 pts)')).toBeInTheDocument();

    // Check Milestone Timeline
    expect(screen.getByText('Milestone Progression Timeline')).toBeInTheDocument();
    expect(screen.getByText('Well-calibrated')).toBeInTheDocument();

    // Check Scatter & Rolling MAE chart headers
    expect(screen.getByText('Predicted vs Actual Peak Rise')).toBeInTheDocument();
    expect(screen.getByText('Rolling MAE & Interval Coverage')).toBeInTheDocument();
    expect(screen.getByText('83.3%')).toBeInTheDocument();
  });

  it('displays active drift banner with suggested causes when drift is detected', async () => {
    vi.spyOn(ClientModule, 'apiRequest').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/patients/1') return mockPatient;
      if (endpoint === '/twin/1/accuracy') return mockAccuracyDrift;
      if (endpoint === '/twin/1/maturity') return mockMaturity;
      if (endpoint === '/patients/1/timeline') return mockTimeline;
      return {};
    });

    renderWithProviders(<TwinOverview />);

    // Check drift warning banner
    expect(await screen.findByText('Digital Twin Model Drift Active')).toBeInTheDocument();
    expect(
      screen.getByText(/Interval coverage \(50.0%\) dropped below the 60% minimum threshold/)
    ).toBeInTheDocument();

    // Check suggested causes
    expect(screen.getByText('• medication change')).toBeInTheDocument();
    expect(screen.getByText('• illness / physiological stress')).toBeInTheDocument();
    expect(screen.getByText('• sensor calibration issue')).toBeInTheDocument();
  });

  it('shows predicted vs actual on logged meals in the diary once reconciled', async () => {
    vi.spyOn(ClientModule, 'apiRequest').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/patients/1') return mockPatient;
      if (endpoint === '/patients/1/timeline') return mockTimeline;
      return {};
    });

    renderWithProviders(<TimelinePage />);

    // Check reconciled meal badge
    expect(await screen.findByText('Predicted +38 mg/dL')).toBeInTheDocument();
    expect(screen.getByText('Actual +36.5 mg/dL')).toBeInTheDocument();
    expect(screen.getByText(/In P10-P90/)).toBeInTheDocument();
    expect(screen.getByText(/(-1.5 mg\/dL)/)).toBeInTheDocument();

    // Check unreconciled meal awaiting readings badge
    expect(screen.getByText('Predicted +44 mg/dL')).toBeInTheDocument();
    expect(screen.getByText('Awaiting 3h window reading(s)')).toBeInTheDocument();
  });
});
