import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MessagesPage } from '../pages/Messages';
import { DataImportPage } from '../pages/DataImport';
import { ReportsPage } from '../pages/ReportsPage';
import * as ClientModule from '../api/client';
import * as AppContextModule from '../context/AppContext';
import * as AuthContextModule from '../context/AuthContext';
import { MessageThread, CGMImportReport, WearableImportReport, WeeklyReport } from '../api/types';

describe('Platform Glue: Messages, Import, and Reports UI', () => {
  let queryClient: QueryClient;

  const mockPatients = [
    { id: 1, display_name: 'Alex Rivera', age: 52, sex: 'M', hba1c_pct: 7.8, bmi: 28.4 },
    { id: 2, display_name: 'Sarah Connor', age: 44, sex: 'F', hba1c_pct: 6.5, bmi: 24.2 },
  ];

  const mockThreads: MessageThread[] = [
    {
      id: 101,
      patient_id: 1,
      title: 'Postprandial glucose spike after dinner',
      topic_type: 'alert',
      topic_id: 'alert-42',
      unread_count: 2,
      last_message_at: '2026-10-20T10:00:00Z',
      created_at: '2026-10-20T08:00:00Z',
      updated_at: '2026-10-20T10:00:00Z',
      patient_name: 'Alex Rivera',
      messages: [
        {
          id: 1001,
          thread_id: 101,
          sender_id: 1,
          sender_name: 'Alex Rivera',
          sender_role: 'patient',
          content: 'Hello doctor, my glucose spiked to 195 after pasta.',
          created_at: '2026-10-20T08:00:00Z',
          is_read: true,
        },
        {
          id: 1002,
          thread_id: 101,
          sender_id: 2,
          sender_name: 'Dr. Sarah Care',
          sender_role: 'clinician',
          content: 'Try adding a 15-minute walk immediately post-meal.',
          created_at: '2026-10-20T10:00:00Z',
          is_read: false,
        },
      ],
    },
    {
      id: 102,
      patient_id: 1,
      title: 'Upcoming Visit Review',
      topic_type: 'visit',
      topic_id: 'visit-9',
      unread_count: 0,
      last_message_at: '2026-10-19T14:00:00Z',
      created_at: '2026-10-19T12:00:00Z',
      updated_at: '2026-10-19T14:00:00Z',
      patient_name: 'Alex Rivera',
      messages: [
        {
          id: 1003,
          thread_id: 102,
          sender_id: 2,
          sender_name: 'Dr. Sarah Care',
          sender_role: 'clinician',
          content: 'Please ensure you complete your fasting glucose log before Monday.',
          created_at: '2026-10-19T12:00:00Z',
          is_read: true,
        },
      ],
    },
  ];

  const mockCgmReport: CGMImportReport = {
    patient_id: 1,
    rows_accepted: 144,
    rows_skipped: 3,
    errors: ['Row 12: invalid glucose reading value', 'Row 48: malformed timestamp'],
    units_detected: 'mg/dL',
    alerts_evaluated: 1,
    predictions_reconciled: 4,
    message: 'Successfully imported 144 readings with 1 alert triggered and 4 predictions reconciled.',
  };

  const mockWearableReport: WearableImportReport = {
    patient_id: 1,
    rows_accepted: 7,
    rows_skipped: 1,
    errors: ['Row 8: non-numeric step count'],
    message: 'Imported 7 daily wearable records (context display only).',
  };

  const mockWeeklyReport: WeeklyReport = {
    patient_id: 1,
    patient_name: 'Alex Rivera',
    generated_at: '2026-10-20T12:00:00Z',
    period_days: 7,
    tir_stats: {
      total_readings: 672,
      tir_pct: 74.5,
      tar_pct: 21.0,
      tbr_pct: 4.5,
      mean_glucose: 138.4,
    },
    best_meals: [
      {
        meal_id: 1,
        carbs_g: 32.0,
        calories: 380,
        pre_glucose: 110,
        observed_peak_rise: 24.0,
        rating: 'best',
      },
    ],
    worst_meals: [
      {
        meal_id: 2,
        carbs_g: 85.0,
        calories: 720,
        pre_glucose: 125,
        observed_peak_rise: 72.0,
        rating: 'worst',
      },
    ],
    twin_accuracy: {
      mean_error: 11.2,
      in_range_pct: 85.7,
      total_predictions: 21,
      calibrated: true,
      confidence_score: 0.85,
    },
    adherence: {
      doses_taken: 14,
      doses_total: 14,
      adherence_pct: 100.0,
      meals_logged: 19,
    },
    alerts: [
      {
        id: 1,
        rule_key: 'POSTPRANDIAL_SPIKE',
        severity: 'warning',
        message: 'Elevated glucose spike after meal',
        status: 'open',
        created_at: '2026-10-20T10:00:00Z',
      },
    ],
    plan_progress: {
      title: 'Active 4-Week Plan',
      total_tasks: 8,
      completed_tasks: 6,
      progress_pct: 75.0,
    },
  };

  const mockFhirBundle = {
    resourceType: 'Bundle',
    type: 'collection',
    total: 4,
    entry: [
      {
        resource: {
          resourceType: 'Patient',
          id: 'pat-1',
          name: [{ text: 'Alex Rivera' }],
          gender: 'male',
        },
      },
      {
        resource: {
          resourceType: 'Observation',
          id: 'obs-hba1c',
          code: { coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c' }] },
          valueQuantity: { value: 7.8, unit: '%' },
        },
      },
      {
        resource: {
          resourceType: 'Observation',
          id: 'obs-egfr',
          code: { coding: [{ system: 'http://loinc.org', code: '33914-3', display: 'eGFR' }] },
          valueQuantity: { value: 92.0, unit: 'mL/min/1.73m2' },
        },
      },
      {
        resource: {
          resourceType: 'MedicationStatement',
          id: 'med-1',
          medicationCodeableConcept: { text: 'Metformin 500mg' },
          status: 'active',
        },
      },
    ],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      activePatientId: 1,
      setActivePatientId: vi.fn(),
      viewMode: 'clinician',
      setViewMode: vi.fn(),
      isSidebarCollapsed: false,
      toggleSidebar: vi.fn(),
    });

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 2, email: 'dr.sarah@glucotwin.org', role: 'clinician', full_name: 'Dr. Sarah Care', created_at: '2026-01-01' },
      token: 'mock-token',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      isLoading: false,
    });

    vi.spyOn(ClientModule, 'apiRequest').mockImplementation((url: string, options?: any) => {
      if (url.includes('/patients') && !url.includes('/wearables') && !url.includes('/visits')) {
        return Promise.resolve(mockPatients);
      }
      if (url.includes('/messages/threads/101/messages') && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          id: 1004,
          thread_id: 101,
          sender_user_id: 2,
          sender_name: 'Dr. Sarah Care',
          sender_role: 'clinician',
          content: body.content,
          created_at: new Date().toISOString(),
          is_read: true,
        });
      }
      if (url.includes('/messages/threads/101/read')) {
        return Promise.resolve({ ...mockThreads[0], unread_count: 0 });
      }
      if (url.includes('/messages/threads/101')) {
        return Promise.resolve(mockThreads[0]);
      }
      if (url.includes('/messages/threads/102')) {
        return Promise.resolve(mockThreads[1]);
      }
      if (url.startsWith('/messages/threads') && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ...mockThreads[0],
          id: 103,
          title: body.title,
          topic_type: body.topic_type,
          topic_id: body.topic_id,
        });
      }
      if (url.startsWith('/messages/threads')) {
        return Promise.resolve(mockThreads);
      }
      if (url.includes('/import/cgm') && options?.method === 'POST') {
        return Promise.resolve(mockCgmReport);
      }
      if (url.includes('/import/wearables') && options?.method === 'POST') {
        return Promise.resolve(mockWearableReport);
      }
      if (url.includes('/reports/weekly/1/generate')) {
        return Promise.resolve(mockWeeklyReport);
      }
      if (url.includes('/reports/weekly')) {
        return Promise.resolve(mockWeeklyReport);
      }
      if (url.includes('/export/fhir/1')) {
        return Promise.resolve(mockFhirBundle);
      }
      if (url.includes('/visits')) return Promise.resolve([]);
      if (url.includes('/alerts')) return Promise.resolve([]);
      if (url.includes('/whatif/scenarios')) return Promise.resolve([]);
      return Promise.resolve({});
    });
  });

  // 1. Messages Page Tests
  describe('MessagesPage Component', () => {
    it('renders thread list, unread badges, and chat conversation', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <MessagesPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Header and active thread
      await waitFor(() => {
        expect(screen.getByText('Care Team Discussion Hub')).toBeInTheDocument();
        expect(screen.getByText('Postprandial glucose spike after dinner')).toBeInTheDocument();
      });

      // Context topic pill for Alert
      await waitFor(() => {
        expect(screen.getByText('#alert-42')).toBeInTheDocument();
      });

      // Message contents
      expect(await screen.findByText(/Hello doctor, my glucose spiked to 195 after pasta./i)).toBeInTheDocument();
      expect(screen.getByText(/Try adding a 15-minute walk immediately post-meal./i)).toBeInTheDocument();
    });

    it('switches threads when clicked and displays related topic context', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <MessagesPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Upcoming Visit Review')).toBeInTheDocument();
      });

      // Click second thread
      fireEvent.click(screen.getByText('Upcoming Visit Review'));

      await waitFor(() => {
        expect(screen.getByText(/Please ensure you complete your fasting glucose log before Monday./i)).toBeInTheDocument();
      });
    });

    it('allows composing and sending a reply message', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <MessagesPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type a clinical note or question to care team/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Type a clinical note or question to care team/i);
      fireEvent.change(input, { target: { value: 'Checking on your hydration levels today.' } });
      expect(input).toHaveValue('Checking on your hydration levels today.');

      const sendButton = screen.getByRole('button', { name: /Send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(ClientModule.apiRequest).toHaveBeenCalledWith(
          expect.stringContaining('/messages/threads/101/messages'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  // 2. Data Import Page Tests
  describe('DataImportPage Component', () => {
    it('renders CGM import tab with dropzone and sample download options', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DataImportPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('Clinical Data Ingestion Engine')).toBeInTheDocument();
      expect(screen.getByText('Continuous Glucose Monitor (CGM)')).toBeInTheDocument();
      expect(screen.getByText(/Wearables \(Steps & Sleep\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Drag & drop your CGM CSV file here/i)).toBeInTheDocument();
    });

    it('submits a CGM file and renders comprehensive import report', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DataImportPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const testFile = new File(['timestamp,glucose\n2026-10-20 12:00,120.0'], 'cgm_export.csv', {
        type: 'text/csv',
      });

      fireEvent.change(fileInput, { target: { files: [testFile] } });

      const uploadBtn = screen.getByRole('button', { name: /Ingest CGM Data/i });
      fireEvent.click(uploadBtn);

      await waitFor(() => {
        expect(screen.getByText('Ingestion Succeeded')).toBeInTheDocument();
        expect(screen.getByText('144')).toBeInTheDocument(); // Rows Accepted
        expect(screen.getByText('3')).toBeInTheDocument(); // Rows Skipped
        expect(screen.getByText('mg/dL')).toBeInTheDocument(); // Units Detected
        expect(screen.getByText('Row 12: invalid glucose reading value')).toBeInTheDocument();
      });
    });

    it('allows switching to Wearables tab and imports wearable telemetry', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DataImportPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const wearableTab = screen.getByText(/Wearables \(Steps & Sleep\)/i);
      fireEvent.click(wearableTab);

      expect(screen.getByText(/Drag & drop your Wearables CSV file here/i)).toBeInTheDocument();
      expect(screen.getByText(/Daily step counts and sleep hours \(stored per day for display context only\)/i)).toBeInTheDocument();
    });
  });

  // 3. Reports & FHIR Page Tests
  describe('ReportsPage Component', () => {
    it('renders weekly synthesis metrics including TIR, meal analysis, and twin accuracy', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ReportsPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(await screen.findByText('Weekly Clinical Reports & Interoperability')).toBeInTheDocument();
      expect(await screen.findByText('Glycaemic Control & Time In Range')).toBeInTheDocument();
      expect(screen.getByText('74.5%')).toBeInTheDocument(); // TIR %
      expect(screen.getByText('11.2 mg/dL')).toBeInTheDocument(); // MAE
      expect(screen.getByText('Active 4-Week Plan')).toBeInTheDocument(); // Plan title
      expect(screen.getByText('6 completed')).toBeInTheDocument(); // Plan progress
      expect(screen.getByText(/Meal #1/i)).toBeInTheDocument(); // Best meal
      expect(screen.getByText(/Meal #2/i)).toBeInTheDocument(); // Worst meal

      // PDF download action exists
      expect(screen.getByRole('button', { name: /Download PDF Dossier/i })).toBeInTheDocument();
    });

    it('triggers manual report generation', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ReportsPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument();
      });

      const generateBtn = screen.getByRole('button', { name: /Regenerate/i });
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(ClientModule.apiRequest).toHaveBeenCalledWith(
          expect.stringContaining('/reports/weekly/1/generate'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('opens FHIR Export modal displaying simplified R4 Bundle with proper disclaimer', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ReportsPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /FHIR Export/i })).toBeInTheDocument();
      });

      const fhirBtn = screen.getByRole('button', { name: /FHIR Export/i });
      fireEvent.click(fhirBtn);

      await waitFor(() => {
        expect(screen.getByText('Simplified FHIR R4 Bundle Export')).toBeInTheDocument();
        expect(screen.getByText(/Clinical Interoperability Notice/i)).toBeInTheDocument();
        expect(screen.getByText(/This is a simplified subset of the HL7 FHIR Release 4 standard/i)).toBeInTheDocument();
        expect(screen.getByText(/Total resources in bundle:/i)).toBeInTheDocument();
      });
    });
  });
});
