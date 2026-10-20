import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GovernanceWorkspace } from '../pages/GovernanceWorkspace';
import { Layout } from '../components/Layout';
import * as ClientModule from '../api/client';
import * as AppContextModule from '../context/AppContext';
import * as AuthContextModule from '../context/AuthContext';
import * as QueriesModule from '../api/queries';

describe('Cleanup & Consistency Pass: About & Model Info and Role Navigation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('About & Model Info (GovernanceWorkspace)', () => {
    it('renders read-only model specs, training metrics, cohort size, and calibration chart', async () => {
      vi.spyOn(QueriesModule, 'useValidation').mockReturnValue({
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
            '45 participants in CGMacros cohort (healthy & T2D mix)',
            'Meal windows isolated by 2h',
          ],
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<GovernanceWorkspace />);

      // Title & version
      expect(screen.getByText('About & Model Info')).toBeInTheDocument();
      expect(screen.getByText('v0.2.0 Read-Only')).toBeInTheDocument();

      // Model registry specifications
      expect(screen.getByText('MealRecommender')).toBeInTheDocument();
      expect(screen.getByText('1.6.1')).toBeInTheDocument();
      expect(screen.getByText('2024-11-20')).toBeInTheDocument();
      expect(screen.getAllByText(/45 participants/i).length).toBeGreaterThanOrEqual(1);

      // Grouped CV metrics and calculated improvement (+39.1%)
      expect(screen.getByText('Peak Glucose Rise (mg/dL)')).toBeInTheDocument();
      expect(screen.getByText('18.4')).toBeInTheDocument();
      expect(screen.getByText('11.2')).toBeInTheDocument();
      expect(screen.getByText('+39.1%')).toBeInTheDocument();

      // Limitations
      expect(screen.getByText('45 participants in CGMacros cohort (healthy & T2D mix)')).toBeInTheDocument();

      // Verify that SCM console, export controls, and seed re-verify are REMOVED
      expect(screen.queryByText(/Export SCM Audit JSON/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Re-verify Seed Baseline/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/SCM Configuration & Release Console/i)).not.toBeInTheDocument();
    });

    it('renders loading skeleton when fetching model info', () => {
      vi.spyOn(QueriesModule, 'useValidation').mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<GovernanceWorkspace />);
      expect(screen.getByText('About & Model Info')).toBeInTheDocument();
      // Should not render metrics table while loading
      expect(screen.queryByText('Target Metric')).not.toBeInTheDocument();
    });

    it('renders error state with retry button when model info fails to load', () => {
      const mockRefetch = vi.fn();
      vi.spyOn(QueriesModule, 'useValidation').mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network timeout loading validation.json'),
        refetch: mockRefetch,
      } as any);

      renderWithProviders(<GovernanceWorkspace />);
      expect(screen.getByText(/Failed to load model registry and validation metrics/i)).toBeInTheDocument();
      expect(screen.getByText(/Network timeout loading validation.json/i)).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /Retry Loading/i });
      fireEvent.click(retryBtn);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Role-Based Navigation in Layout', () => {
    const mockPatients = [{ id: 1, display_name: 'Alex Rivera', age: 52, sex: 'M', hba1c_pct: 7.8 }];

    beforeEach(() => {
      vi.spyOn(QueriesModule, 'usePatients').mockReturnValue({
        data: mockPatients,
        isLoading: false,
      } as any);
      vi.spyOn(QueriesModule, 'useAlerts').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(QueriesModule, 'useAcknowledgeAlert').mockReturnValue({
        mutate: vi.fn(),
      } as any);
      vi.spyOn(ClientModule, 'subscribeToToasts').mockReturnValue(() => {});
    });

    it('renders patient navigation: includes Patient Home & Personal Workspaces, excludes Panel, Visits, Alerts, Governance', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 1, full_name: 'Alex Rivera', email: 'patient.a@glucotwin.org', role: 'patient', created_at: '2026-01-01' },
        token: 'token',
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });
      vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
        activePatientId: 1,
        setActivePatientId: vi.fn(),
        viewMode: 'patient',
        setViewMode: vi.fn(),
        isSidebarCollapsed: false,
        toggleSidebar: vi.fn(),
      });

      renderWithProviders(<Layout />);

      // Patient-relevant items exist
      expect(screen.getByText('Patient Home')).toBeInTheDocument();
      expect(screen.getByText('Fast Log Meal')).toBeInTheDocument();
      expect(screen.getByText('Metabolic Twin')).toBeInTheDocument();
      expect(screen.getByText('Glucose Diary & Replay')).toBeInTheDocument();
      expect(screen.getByText('Meal & Walk Forecast')).toBeInTheDocument();
      expect(screen.getByText('My 4-Week Plan')).toBeInTheDocument();
      expect(screen.getByText('Care Team Chat')).toBeInTheDocument();
      expect(screen.getByText('Data Import')).toBeInTheDocument();
      expect(screen.getByText('Weekly Reports')).toBeInTheDocument();

      // Clinical-only workspaces must NOT be visible to patient
      expect(screen.queryByText('Patient Panel')).not.toBeInTheDocument();
      expect(screen.queryByText('Visit Workspace')).not.toBeInTheDocument();
      expect(screen.queryByText('Alerts Center')).not.toBeInTheDocument();
      expect(screen.queryByText('About & Model Info')).not.toBeInTheDocument();
    });

    it('renders dietitian navigation: includes Panel, Simulation, Reports, Model Info, but EXCLUDES Visit Workspace & Alerts Center', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 4, full_name: 'Elena Rostova', email: 'elena.diet@glucotwin.org', role: 'dietitian', created_at: '2026-01-01' },
        token: 'token',
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });
      vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
        activePatientId: 1,
        setActivePatientId: vi.fn(),
        viewMode: 'clinician',
        setViewMode: vi.fn(),
        isSidebarCollapsed: false,
        toggleSidebar: vi.fn(),
      });

      renderWithProviders(<Layout />);

      // Dietitian relevant workspaces
      expect(screen.getByText('Patient Panel')).toBeInTheDocument();
      expect(screen.getByText('Twin Overview')).toBeInTheDocument();
      expect(screen.getByText('Simulation Lab')).toBeInTheDocument();
      expect(screen.getByText('My Care Plan')).toBeInTheDocument();
      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('Import Data')).toBeInTheDocument();
      expect(screen.getByText('Weekly Reports')).toBeInTheDocument();
      expect(screen.getByText('About & Model Info')).toBeInTheDocument();

      // Doctor Visit Workspace & Acute Medical Alerts Center must NOT be visible to dietitian
      expect(screen.queryByText('Visit Workspace')).not.toBeInTheDocument();
      expect(screen.queryByText('Alerts Center')).not.toBeInTheDocument();
      expect(screen.queryByText('Patient Home')).not.toBeInTheDocument();
    });

    it('renders clinician navigation: includes Visit Workspace, Alerts Center, Patient Panel, and About & Model Info', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 2, full_name: 'Dr. Michael Chen', email: 'dr.chen@glucotwin.org', role: 'clinician', created_at: '2026-01-01' },
        token: 'token',
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });
      vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
        activePatientId: 1,
        setActivePatientId: vi.fn(),
        viewMode: 'clinician',
        setViewMode: vi.fn(),
        isSidebarCollapsed: false,
        toggleSidebar: vi.fn(),
      });

      renderWithProviders(<Layout />);

      // Full clinical suite
      expect(screen.getByText('Patient Panel')).toBeInTheDocument();
      expect(screen.getByText('Visit Workspace')).toBeInTheDocument();
      expect(screen.getByText('Alerts Center')).toBeInTheDocument();
      expect(screen.getByText('Simulation Lab')).toBeInTheDocument();
      expect(screen.getByText('Treatment Studio')).toBeInTheDocument();
      expect(screen.getByText('About & Model Info')).toBeInTheDocument();
      expect(screen.getByText('Weekly Reports')).toBeInTheDocument();
    });
  });
});
