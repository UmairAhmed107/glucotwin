import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ValidationPage } from '../pages/Validation';
import { ReplayPage } from '../pages/Replay';
import { ClinicianViewPage } from '../pages/ClinicianView';
import { AppProvider } from '../context/AppContext';
import * as queries from '../api/queries';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
};

describe('ValidationPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all sections and relative improvement percentages when data is fully provided', () => {
    vi.spyOn(queries, 'useValidation').mockReturnValue({
      data: {
        class: 'MealRecommender',
        sklearn_version: '1.6.1',
        training_date: '2024-11-20',
        trained_on: {
          dataset: 'cgmacros',
          participants: 45,
          meals: 1200,
          features: 20,
        },
        grouped_cv: {
          peak_rise: {
            baseline_mae: 18.4,
            twin_mae: 11.2,
            baseline_rmse: 23.6,
            twin_rmse: 14.8,
          },
        },
        error_vs_memory: [
          { mem_n: 0, mae: 18.4, n: 45 },
          { mem_n: 1, mae: 15.6, n: 45 },
        ],
        interval_calibration: [
          { nominal: 0.5, empirical: 0.49 },
          { nominal: 0.8, empirical: 0.78 },
        ],
        limitations: [
          '45 participants in CGMacros cohort',
          'Meal windows isolated by 2h',
        ],
      },
      isLoading: false,
      isError: false,
    } as any);

    render(<ValidationPage />, { wrapper: createWrapper() });

    // Header & model registry
    expect(screen.getByText('Model Validation & Registry')).toBeInTheDocument();
    expect(screen.getByText('MealRecommender')).toBeInTheDocument();
    expect(screen.getByText('1.6.1')).toBeInTheDocument();
    expect(screen.getByText('2024-11-20')).toBeInTheDocument();
    expect(screen.getAllByText(/45 participants/i).length).toBeGreaterThanOrEqual(1);

    // Table with metrics & calculated relative improvement
    // MAE improvement: (18.4 - 11.2) / 18.4 = 39.1%
    expect(screen.getByText('Peak Glucose Rise (mg/dL)')).toBeInTheDocument();
    expect(screen.getByText('18.4')).toBeInTheDocument();
    expect(screen.getByText('11.2')).toBeInTheDocument();
    expect(screen.getByText('+39.1%')).toBeInTheDocument();

    // Limitations
    expect(screen.getByText('Meal windows isolated by 2h')).toBeInTheDocument();
  });

  it('renders "Not provided" for missing sections and never invents default values', () => {
    vi.spyOn(queries, 'useValidation').mockReturnValue({
      data: {
        sklearn_version: '1.6.1',
        // class, training_date, grouped_cv, error_vs_memory, limitations all missing
      },
      isLoading: false,
      isError: false,
    } as any);

    render(<ValidationPage />, { wrapper: createWrapper() });

    expect(screen.getByText('1.6.1')).toBeInTheDocument();

    // Missing fields in model registry and sections show "Not provided"
    const notProvidedElements = screen.getAllByText('Not provided');
    expect(notProvidedElements.length).toBeGreaterThanOrEqual(4);
  });
});

describe('ReplayPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders mandatory recorded data label and 1x, 10x, 60x speed controls', () => {
    vi.spyOn(queries, 'usePatient').mockReturnValue({
      data: { id: 1, display_name: 'Demo Patient', cgmacros_participant_id: 1 },
      isLoading: false,
    } as any);

    render(<ReplayPage />, { wrapper: createWrapper() });

    // Mandatory disclaimer banner
    expect(
      screen.getByText(/replay of recorded data, not live monitoring/i)
    ).toBeInTheDocument();

    // Speed buttons
    expect(screen.getByRole('button', { name: '1x' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10x' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '60x' })).toBeInTheDocument();

    // Start button
    expect(screen.getByRole('button', { name: /start replay/i })).toBeInTheDocument();
  });

  it('allows switching playback speeds', () => {
    vi.spyOn(queries, 'usePatient').mockReturnValue({
      data: { id: 1, display_name: 'Demo Patient', cgmacros_participant_id: 1 },
      isLoading: false,
    } as any);

    render(<ReplayPage />, { wrapper: createWrapper() });

    const btn60x = screen.getByRole('button', { name: '60x' });
    fireEvent.click(btn60x);
    expect(btn60x).toHaveClass('bg-teal-500');
  });
});

describe('ClinicianViewPage PDF Download', () => {
  beforeEach(() => {
    localStorage.setItem('glucotwin_active_patient_id', '42');
  });

  it('triggers PDF download when Download Clinical Report button is clicked', () => {
    vi.spyOn(queries, 'usePatient').mockReturnValue({
      data: {
        id: 42,
        display_name: 'Test Patient',
        is_synthetic: true,
        age: 50,
        sex: 'M',
        bmi: 25,
        hba1c_pct: 6.5,
        fasting_glucose_mgdl: 100,
        hypoglycemia_history: false,
        kidney_flag: false,
        current_meds: [],
        twin_state: { mem_n: 2, confidence_score: 0.6, mem_mean_rise: 35.0 },
      },
      isLoading: false,
    } as any);

    vi.spyOn(queries, 'useAuditLog').mockReturnValue({ data: [], isLoading: false } as any);

    // Mock window.open
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<ClinicianViewPage />, { wrapper: createWrapper() });

    const downloadBtn = screen.getByRole('button', { name: /download clinical report \(pdf\)/i });
    expect(downloadBtn).toBeInTheDocument();

    fireEvent.click(downloadBtn);

    expect(openSpy).toHaveBeenCalledWith('/patients/42/report.pdf', '_blank');
  });
});
