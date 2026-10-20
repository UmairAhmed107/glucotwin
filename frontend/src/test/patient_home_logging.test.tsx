import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PatientHome } from '../pages/PatientHome';
import { LogData } from '../pages/LogData';
import * as ClientModule from '../api/client';
import * as AppContextModule from '../context/AppContext';
import * as AuthContextModule from '../context/AuthContext';
import {
  PatientHomeSummary,
  FoodSearchResponse,
  SavedMeal,
  PhotoMealEstimate,
  PredictResponse,
} from '../api/types';

const mockHomeSummary: PatientHomeSummary = {
  patient_id: 1,
  today_glucose: {
    current_value: 122.5,
    min_value: 95.0,
    max_value: 148.0,
    mean_value: 118.0,
    readings_count: 4,
    trend: 'stable',
    unit: 'mg/dL',
    last_reading_time: '2026-10-19T18:00:00Z',
  },
  time_in_range_ring: {
    in_range_pct: 82.0,
    below_range_pct: 2.0,
    above_range_pct: 16.0,
    total_readings: 32,
    target_in_range_pct: 70.0,
    status: 'on_track',
    window_label: 'Last 7 Days',
  },
  last_meal: {
    id: 10,
    logged_at: '2026-10-19T13:30:00Z',
    carbs_g: 48.0,
    protein_g: 22.0,
    fat_g: 14.0,
    fiber_g: 6.0,
    calories: 406.0,
    observed_peak_rise: 36.5,
    predicted_peak_rise: 38.0,
    delta_mgdl: -1.5,
    response_badge: 'Matched twin forecast',
    badge_color: 'emerald',
    pre_glucose: 104.0,
  },
  circadian_suggestion: {
    meal_type: 'Dinner',
    optimal_window: '18:15 - 19:30',
    predicted_rise_reduction_mgdl: -16.5,
    rationale: 'Diurnal peripheral insulin sensitivity is elevated before 19:30.',
    circadian_advantage: '16.5 mg/dL lower peak rise',
  },
  medications_today: [
    {
      id: 101,
      medication_id: 1,
      patient_id: 1,
      medication_name: 'Metformin XR',
      dose: '500mg',
      scheduled_time: '2026-10-19T09:00:00Z',
      taken_at: '2026-10-19T09:15:00Z',
      status: 'taken',
      notes: null,
    },
    {
      id: 102,
      medication_id: 2,
      patient_id: 1,
      medication_name: 'Empagliflozin',
      dose: '10mg',
      scheduled_time: '2026-10-19T20:00:00Z',
      taken_at: null,
      status: 'pending',
      notes: null,
    },
  ],
  weekly_streak: {
    current_streak_days: 6,
    target_days: 7,
    is_streak_active_today: true,
    history: [
      { day: 'Mon', date: '2026-10-13', active: true, glucose_count: 4, meal_count: 3, dose_count: 2 },
      { day: 'Tue', date: '2026-10-14', active: true, glucose_count: 3, meal_count: 3, dose_count: 2 },
      { day: 'Wed', date: '2026-10-15', active: true, glucose_count: 5, meal_count: 3, dose_count: 2 },
      { day: 'Thu', date: '2026-10-16', active: true, glucose_count: 4, meal_count: 2, dose_count: 2 },
      { day: 'Fri', date: '2026-10-17', active: true, glucose_count: 4, meal_count: 3, dose_count: 2 },
      { day: 'Sat', date: '2026-10-18', active: true, glucose_count: 3, meal_count: 3, dose_count: 2 },
      { day: 'Sun', date: '2026-10-19', active: true, glucose_count: 4, meal_count: 2, dose_count: 1 },
    ],
    encouragement: '6-day logging streak! Consistent data improves twin forecast precision.',
  },
};

const mockFoodSearch: FoodSearchResponse = {
  items: [
    {
      id: 1,
      name: 'Whole Wheat Roti / Chapati',
      serving_description: '1 medium roti (35g)',
      carbs: 17.5,
      protein: 3.5,
      fat: 0.8,
      calories: 90.0,
      fiber: 2.5,
      category: 'indian_breads',
      is_demo: true,
      disclaimer: 'Approximate demo data',
    },
    {
      id: 2,
      name: 'Dal Tadka (Yellow Lentil)',
      serving_description: '1 medium bowl (150g)',
      carbs: 18.2,
      protein: 7.8,
      fat: 4.5,
      calories: 145.0,
      fiber: 4.2,
      category: 'curries_dal',
      is_demo: true,
      disclaimer: 'Approximate demo data',
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  pages: 1,
};

const mockSavedMeals: SavedMeal[] = [
  {
    id: 5,
    patient_id: 1,
    name: 'Standard Healthy Lunch',
    items: [
      { food_id: 1, servings: 2.0, name: 'Whole Wheat Roti' },
      { food_id: 2, servings: 1.0, name: 'Dal Tadka' },
    ],
    computed_carbs: 53.2,
    computed_protein: 14.8,
    computed_fat: 6.1,
    computed_calories: 325.0,
    computed_fiber: 9.2,
    created_at: '2026-10-18T12:00:00Z',
  },
];

const mockPredictResponse: any = {
  predicted_peak_rise: 34.2,
  predicted_peak_time_min: 65,
  uncertainty_band_width: 12.0,
  confidence_score: 0.91,
  targets: {
    peak_rise: { median: 34.2, p10: 25.0, p90: 45.0 },
  },
  predicted_curve: [
    { time_min: 0, time_label: '0m', baseline_median: 108, baseline_p10: 104, baseline_p90: 112 },
    { time_min: 30, time_label: '30m', baseline_median: 128, baseline_p10: 122, baseline_p90: 134 },
    { time_min: 60, time_label: '60m', baseline_median: 142, baseline_p10: 135, baseline_p90: 149 },
    { time_min: 90, time_label: '90m', baseline_median: 131, baseline_p10: 124, baseline_p90: 138 },
    { time_min: 120, time_label: '120m', baseline_median: 115, baseline_p10: 109, baseline_p90: 121 },
  ],
  governor_audit: {
    clean: true,
    rules_triggered: [],
  },
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

describe('PatientHome Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      activePatientId: 1,
      setActivePatientId: vi.fn(),
      viewMode: 'patient',
      setViewMode: vi.fn(),
      isSidebarCollapsed: false,
      toggleSidebar: vi.fn(),
    });

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        email: 'priya@glucotwin.org',
        full_name: 'Priya Patel',
        role: 'patient',
        created_at: '2026-10-10T00:00:00',
        patient_id: 1,
      },
      token: 'fake-jwt',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn().mockResolvedValue(undefined),
      isLoading: false,
    });

    vi.spyOn(ClientModule, 'apiRequest').mockImplementation(async (path: string) => {
      if (path.includes('/home-summary')) {
        return mockHomeSummary;
      }
      if (path.includes('/patients/1')) {
        return {
          id: 1,
          display_name: 'Priya Patel',
          age: 48,
          sex: 'F',
          bmi: 26.2,
          hba1c_pct: 7.2,
        };
      }
      return {};
    });
  });

  it('renders today glucose summary and time-in-range ring', async () => {
    render(<PatientHome />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('122.5')).toBeInTheDocument();
      expect(screen.getByText(/In Range/i)).toBeInTheDocument();
      expect(screen.getAllByText('82%').length).toBeGreaterThan(0);
    });

    // Check glucose trend and stats
    expect(screen.getByText('STABLE')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument(); // min
    expect(screen.getByText('148')).toBeInTheDocument(); // max
  });

  it('renders last meal response and circadian diurnal recommendation', async () => {
    render(<PatientHome />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Last Meal & Twin Forecast/i)).toBeInTheDocument();
      expect(screen.getByText('Matched twin forecast')).toBeInTheDocument();
      expect(screen.getByText('+36.5 mg/dL')).toBeInTheDocument();
      expect(screen.getByText('+38 mg/dL')).toBeInTheDocument();
    });

    // Circadian window
    expect(screen.getByText('18:15 - 19:30')).toBeInTheDocument();
    expect(screen.getByText('16.5 mg/dL lower peak rise')).toBeInTheDocument();
  });

  it('renders today medication checklist with toggle action', async () => {
    render(<PatientHome />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Today's Medication Checklist")).toBeInTheDocument();
      expect(screen.getByText('Metformin XR')).toBeInTheDocument();
      expect(screen.getByText('Empagliflozin')).toBeInTheDocument();
      expect(screen.getByText('Taken ✓')).toBeInTheDocument();
      expect(screen.getByText('Take Dose')).toBeInTheDocument();
    });

    // 6-day streak
    expect(screen.getByText('6 Days Active')).toBeInTheDocument();
  });
});

describe('Redesigned LogData Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      activePatientId: 1,
      setActivePatientId: vi.fn(),
      viewMode: 'patient',
      setViewMode: vi.fn(),
      isSidebarCollapsed: false,
      toggleSidebar: vi.fn(),
    });

    vi.spyOn(ClientModule, 'apiRequest').mockImplementation(async (path: string, options?: any) => {
      if (path.includes('/foods/search')) {
        return mockFoodSearch;
      }
      if (path.includes('/saved-meals') && (!options || options.method === 'GET')) {
        return mockSavedMeals;
      }
      if (path.includes('/saved-meals') && options?.method === 'POST') {
        return { ...mockSavedMeals[0], id: 99 };
      }
      if (path.includes('/predict')) {
        return mockPredictResponse;
      }
      if (path.includes('/meals') && options?.method === 'POST') {
        return {
          id: 55,
          patient_id: 1,
          logged_at: '2026-10-19T20:00:00Z',
          carbs_g: 35.0,
          protein_g: 7.0,
          fat_g: 1.6,
          calories: 180.0,
          pre_glucose: 108.0,
          pre_trend30: 0.0,
        };
      }
      return {};
    });
  });

  it('renders food search and allows adding food to plate with servings stepper', async () => {
    render(<LogData />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search 380\+ Indian & international dishes/i)).toBeInTheDocument();
      expect(screen.getByText('Whole Wheat Roti / Chapati')).toBeInTheDocument();
      expect(screen.getByText('Dal Tadka (Yellow Lentil)')).toBeInTheDocument();
    });

    // Add first food to plate
    const addButtons = screen.getAllByText('Add to Plate');
    fireEvent.click(addButtons[0]);

    // Check plate updates
    await waitFor(() => {
      expect(screen.getByText('1 item')).toBeInTheDocument();
      expect(screen.getAllByText('17.5g').length).toBeGreaterThan(0); // Carbs
      expect(screen.getAllByText('90').length).toBeGreaterThan(0); // Calories
    });

    // Increment servings using '+' stepper
    const plusButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-plus'));
    if (plusButtons.length > 0) {
      fireEvent.click(plusButtons[plusButtons.length - 1]);
    }

    await waitFor(() => {
      expect(screen.getByText('1.5x')).toBeInTheDocument();
    });
  });

  it('renders saved meals tab and allows 1-tap logging', async () => {
    render(<LogData />, { wrapper: createWrapper() });

    // Switch to Saved Meals tab via tab button
    const savedTabBtn = screen.getByRole('button', { name: /Saved Meals/i });
    fireEvent.click(savedTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Standard Healthy Lunch')).toBeInTheDocument();
      expect(screen.getByText('Log This Meal (1-Tap)')).toBeInTheDocument();
      expect(screen.getByText('53.2g')).toBeInTheDocument(); // carbs
    });

    // 1-tap log
    const oneTapBtn = screen.getByText('Log This Meal (1-Tap)');
    fireEvent.click(oneTapBtn);

    // Immediate forecast appears
    await waitFor(() => {
      expect(screen.getByText('Meal Successfully Logged!')).toBeInTheDocument();
      expect(screen.getByText('Live Twin Forecast Ready')).toBeInTheDocument();
      expect(screen.getByText('+34.2 mg/dL')).toBeInTheDocument(); // forecast peak rise
    });
  });
});
