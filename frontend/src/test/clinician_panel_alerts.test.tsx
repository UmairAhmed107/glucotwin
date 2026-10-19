import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PatientPanel } from '../pages/PatientPanel';
import { AlertsPage } from '../pages/Alerts';
import { Layout } from '../components/Layout';
import * as ClientModule from '../api/client';
import * as AppContextModule from '../context/AppContext';
import * as AuthContextModule from '../context/AuthContext';
import { ClinicianPanelItem, Alert } from '../api/types';

const mockPanelData: ClinicianPanelItem[] = [
  {
    patient_id: 1,
    display_name: 'Patient A (High Risk)',
    age: 62,
    sex: 'M',
    hba1c_pct: 8.5,
    risk_score: 78.5,
    risk_level: 'critical',
    time_in_range_pct: 42.0,
    last_reading_time: '2026-10-19T10:00:00',
    open_alerts_count: 2,
    alerts_by_severity: {
      critical: 1,
      warning: 1,
      info: 0,
    },
    twin_status: {
      mem_n: 25,
      confidence_score: 85,
      personalized: true,
      last_calibrated: '2026-10-19T08:00:00',
    },
    care_team_status: 'active',
  },
  {
    patient_id: 2,
    display_name: 'Patient B (Stable)',
    age: 48,
    sex: 'F',
    hba1c_pct: 6.2,
    risk_score: 22.0,
    risk_level: 'low',
    time_in_range_pct: 82.5,
    last_reading_time: '2026-10-19T11:30:00',
    open_alerts_count: 0,
    alerts_by_severity: {
      critical: 0,
      warning: 0,
      info: 0,
    },
    twin_status: {
      mem_n: 18,
      confidence_score: 80,
      personalized: true,
      last_calibrated: '2026-10-19T07:00:00',
    },
    care_team_status: 'active',
  },
];

const mockAlertsData: Alert[] = [
  {
    id: 101,
    patient_id: 1,
    rule_key: 'hypoglycemia',
    severity: 'critical',
    message: 'CRITICAL HYPOGLYCEMIA: Blood glucose dropped to 52 mg/dL.',
    created_at: '2026-10-19T10:15:00',
    status: 'open',
    patient_name: 'Patient A (High Risk)',
  },
  {
    id: 102,
    patient_id: 1,
    rule_key: 'post_meal_peaks',
    severity: 'warning',
    message: 'METABOLIC INSTABILITY: 3 post-meal peaks exceeded 250 mg/dL.',
    created_at: '2026-10-19T09:00:00',
    status: 'open',
    patient_name: 'Patient A (High Risk)',
  },
  {
    id: 103,
    patient_id: 2,
    rule_key: 'missing_glucose_48h',
    severity: 'info',
    message: 'SENSOR ADHERENCE: No glucose readings logged for 48 hours.',
    created_at: '2026-10-18T12:00:00',
    status: 'resolved',
    patient_name: 'Patient B (Stable)',
  },
];

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

describe('Clinician Home Patient Panel & Alerts Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PatientPanel Page', () => {
    it('renders panel overview metrics and patient rows with risk scores', async () => {
      vi.spyOn(ClientModule, 'apiRequest').mockImplementation((path: string) => {
        if (path === '/clinician/panel') {
          return Promise.resolve(mockPanelData);
        }
        return Promise.resolve([]);
      });

      const mockSetActivePatientId = vi.fn();
      vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
        activePatientId: 1,
        setActivePatientId: mockSetActivePatientId,
        viewMode: 'clinician',
        setViewMode: vi.fn(),
        toggleViewMode: vi.fn(),
        isSidebarCollapsed: false,
        toggleSidebar: vi.fn(),
        currentPatient: null,
      } as any);

      render(<PatientPanel />, { wrapper: createWrapper() });

      // Check header
      expect(screen.getByText('Clinical Patient Panel')).toBeInTheDocument();

      // Check top summary cards
      await waitFor(() => {
        expect(screen.getByText('Linked Patients')).toBeInTheDocument();
        expect(screen.getByText('Priority Care Patients')).toBeInTheDocument();
        expect(screen.getByText('Open Safety Alerts')).toBeInTheDocument();
        expect(screen.getByText('Mean Time-in-Range')).toBeInTheDocument();

        // Check patient rows
        expect(screen.getByText('Patient A (High Risk)')).toBeInTheDocument();
        expect(screen.getByText('Patient B (Stable)')).toBeInTheDocument();
      });

      // Check risk badges
      expect(screen.getByText('79')).toBeInTheDocument(); // 78.5 rounded
      expect(screen.getByText('22')).toBeInTheDocument();
      expect(screen.getAllByText(/critical/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/low/i).length).toBeGreaterThan(0);
    });

    it('filters patients by search input', async () => {
      vi.spyOn(ClientModule, 'apiRequest').mockResolvedValue(mockPanelData);
      vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
        activePatientId: 1,
        setActivePatientId: vi.fn(),
        viewMode: 'clinician',
      } as any);

      render(<PatientPanel />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Patient A (High Risk)')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by patient name/i);
      fireEvent.change(searchInput, { target: { value: 'Stable' } });

      expect(screen.queryByText('Patient A (High Risk)')).not.toBeInTheDocument();
      expect(screen.getByText('Patient B (Stable)')).toBeInTheDocument();
    });

    it('filters patients by risk level dropdown', async () => {
      vi.spyOn(ClientModule, 'apiRequest').mockResolvedValue(mockPanelData);
      vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
        activePatientId: 1,
        setActivePatientId: vi.fn(),
        viewMode: 'clinician',
      } as any);

      render(<PatientPanel />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Patient A (High Risk)')).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      const riskSelect = selects[0]; // first select is risk filter
      fireEvent.change(riskSelect, { target: { value: 'low' } });

      expect(screen.queryByText('Patient A (High Risk)')).not.toBeInTheDocument();
      expect(screen.getByText('Patient B (Stable)')).toBeInTheDocument();
    });

    it('clicks through to patient twin overview when selecting a patient', async () => {
      vi.spyOn(ClientModule, 'apiRequest').mockResolvedValue(mockPanelData);
      const mockSetActivePatientId = vi.fn();
      vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
        activePatientId: 1,
        setActivePatientId: mockSetActivePatientId,
        viewMode: 'clinician',
      } as any);

      render(<PatientPanel />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Patient B (Stable)')).toBeInTheDocument();
      });

      const patientBtn = screen.getByText('Patient B (Stable)');
      fireEvent.click(patientBtn);

      expect(mockSetActivePatientId).toHaveBeenCalledWith(2);
    });
  });

  describe('AlertsPage Page', () => {
    it('renders alert center with severity counts, message, and rules', async () => {
      vi.spyOn(ClientModule, 'apiRequest').mockResolvedValue(mockAlertsData);
      vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
        activePatientId: 1,
        setActivePatientId: vi.fn(),
      } as any);

      render(<AlertsPage />, { wrapper: createWrapper() });

      expect(screen.getByText('Clinical Alerts Center')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText(/Blood glucose dropped to 52 mg\/dL/i)).toBeInTheDocument();
        expect(screen.getByText('Hypoglycemic Event')).toBeInTheDocument();
        expect(screen.getByText('Post-Meal Hyperglycemia')).toBeInTheDocument();
      });
    });

    it('handles acknowledge and resolve actions on alerts', async () => {
      const mockApiRequest = vi.spyOn(ClientModule, 'apiRequest').mockImplementation((path: string, options?: any) => {
        if (path.includes('/alerts/') && options?.method === 'POST') {
          return Promise.resolve({ id: 101, status: 'acknowledged' });
        }
        return Promise.resolve(mockAlertsData);
      });

      vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
        activePatientId: 1,
        setActivePatientId: vi.fn(),
      } as any);

      render(<AlertsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Acknowledge' }).length).toBeGreaterThan(0);
      });

      const ackButtons = screen.getAllByRole('button', { name: 'Acknowledge' });
      fireEvent.click(ackButtons[0]);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('/alerts/101/acknowledge', { method: 'POST' });
      });

      const resolveButtons = screen.getAllByRole('button', { name: 'Resolve' });
      fireEvent.click(resolveButtons[0]);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('/alerts/101/resolve', { method: 'POST' });
      });
    });

    it('triggers manual rule evaluation for active patient', async () => {
      const mockApiRequest = vi.spyOn(ClientModule, 'apiRequest').mockImplementation((path: string) => {
        if (path === '/alerts/evaluate/1') {
          return Promise.resolve(mockAlertsData);
        }
        return Promise.resolve(mockAlertsData);
      });

      vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
        activePatientId: 1,
        setActivePatientId: vi.fn(),
        currentPatient: { id: 1, display_name: 'Patient A' },
      } as any);

      render(<AlertsPage />, { wrapper: createWrapper() });

      const evalBtn = screen.getByRole('button', { name: /Evaluate Patient #1/i });
      fireEvent.click(evalBtn);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('/alerts/evaluate/1', { method: 'POST' });
      });
    });
  });

  describe('Header Alert Bell in Layout', () => {
    it('renders bell with unread badge and opens dropdown with quick ack action', async () => {
      vi.spyOn(ClientModule, 'apiRequest').mockImplementation((path: string) => {
        if (path.includes('/alerts?status=open') || path === '/alerts') {
          return Promise.resolve(mockAlertsData.filter((a) => a.status === 'open'));
        }
        if (path === '/patients') {
          return Promise.resolve([{ id: 1, display_name: 'Patient A', age: 60, sex: 'M', hba1c_pct: 8.0 }]);
        }
        return Promise.resolve([]);
      });

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 2, email: 'dr.chen@glucotwin.org', full_name: 'Dr. Sarah Chen', role: 'clinician', created_at: '' },
        token: 'test.jwt',
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
        activePatientId: 1,
        setActivePatientId: vi.fn(),
        viewMode: 'clinician',
        isSidebarCollapsed: false,
        toggleSidebar: vi.fn(),
      } as any);

      render(<Layout />, { wrapper: createWrapper() });

      // Verify Bell button is in document with badge '2' (since 2 open alerts in mock)
      await waitFor(() => {
        const bellBtn = screen.getByRole('button', { name: /Clinical Alerts/i });
        expect(bellBtn).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
      });

      // Click bell button to toggle dropdown
      const bellBtn = screen.getByRole('button', { name: /Clinical Alerts/i });
      fireEvent.click(bellBtn);

      // Verify dropdown appears
      expect(screen.getByText('Active Metabolic Alerts')).toBeInTheDocument();
      expect(screen.getByText('2 Open')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Ack/i }).length).toBe(2);
      expect(screen.getByText(/View All in Alerts Center/i)).toBeInTheDocument();
    });
  });
});
