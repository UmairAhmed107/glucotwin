import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { CareTeamPage } from '../pages/CareTeam';
import { ProtectedRoute } from '../components/ProtectedRoute';
import * as AuthContextModule from '../context/AuthContext';
import * as ClientModule from '../api/client';

describe('Authentication & Care Team UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Login Page', () => {
    it('renders email, password inputs, sign-in button, and 7 demo accounts', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: null,
        token: null,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );

      expect(screen.getByPlaceholderText('name@glucotwin.org')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Sign In/i })).toBeInTheDocument();

      // Check quick demo buttons
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Dr. Sarah Chen')).toBeInTheDocument();
      expect(screen.getByText('Dr. Rajesh Patel')).toBeInTheDocument();
      expect(screen.getByText('Elena (Dietitian)')).toBeInTheDocument();
      expect(screen.getByText('Patient A')).toBeInTheDocument();
      expect(screen.getByText('Patient B')).toBeInTheDocument();
      expect(screen.getByText('Patient C')).toBeInTheDocument();
    });

    it('populates fields and submits when clicking a demo account button', async () => {
      const mockLogin = vi.fn();
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: null,
        token: null,
        isLoading: false,
        login: mockLogin,
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const mockApiRequest = vi.spyOn(ClientModule, 'apiRequest').mockResolvedValue({
        access_token: 'fake.jwt.token',
        token_type: 'bearer',
        user: {
          id: 2,
          email: 'dr.chen@glucotwin.org',
          full_name: 'Dr. Sarah Chen',
          role: 'clinician',
          created_at: '2026-01-01',
        },
      });

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );

      const drChenBtn = screen.getByText('Dr. Sarah Chen');
      fireEvent.click(drChenBtn);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: 'dr.chen@glucotwin.org',
            password: 'Password123!',
          }),
        });
        expect(mockLogin).toHaveBeenCalledWith('fake.jwt.token', expect.objectContaining({
          email: 'dr.chen@glucotwin.org',
          role: 'clinician',
        }));
      });
    });

    it('shows error message on failed login', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: null,
        token: null,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      vi.spyOn(ClientModule, 'apiRequest').mockRejectedValue(new Error('Invalid email or password'));

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );

      const emailInput = screen.getByPlaceholderText('name@glucotwin.org');
      const passwordInput = screen.getByPlaceholderText('••••••••••••');
      fireEvent.change(emailInput, { target: { value: 'wrong@glucotwin.org' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

      const submitBtn = screen.getByRole('button', { name: /^Sign In/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
      });
    });
  });

  describe('Register Page', () => {
    it('renders registration form with all 4 clinical role choices', () => {
      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );

      expect(screen.getByPlaceholderText('e.g. Dr. Jane Doe or Alex Smith')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('name@domain.org')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Patient/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Clinician/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Dietitian/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Admin/i })).toBeInTheDocument();
    });

    it('switches active role when role selector button is clicked', () => {
      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );

      const clinicianBtn = screen.getByRole('button', { name: /^Clinician/i });
      fireEvent.click(clinicianBtn);
      expect(clinicianBtn.className).toContain('indigo');
    });

    it('submits registration and logs user in on success', async () => {
      const mockLogin = vi.fn();
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: null,
        token: null,
        isLoading: false,
        login: mockLogin,
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const mockApiRequest = vi.spyOn(ClientModule, 'apiRequest').mockResolvedValue({
        access_token: 'new.reg.token',
        token_type: 'bearer',
        user: {
          id: 10,
          email: 'newuser@glucotwin.org',
          full_name: 'Dr. Jane Smith',
          role: 'clinician',
          created_at: '2026-01-01',
        },
      });

      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText('e.g. Dr. Jane Doe or Alex Smith'), {
        target: { value: 'Dr. Jane Smith' },
      });
      fireEvent.change(screen.getByPlaceholderText('name@domain.org'), {
        target: { value: 'newuser@glucotwin.org' },
      });
      fireEvent.change(screen.getByPlaceholderText('At least 6 characters'), {
        target: { value: 'Password123!' },
      });

      const clinicianBtn = screen.getByRole('button', { name: /^Clinician/i });
      fireEvent.click(clinicianBtn);

      const createBtn = screen.getByRole('button', { name: /^Create Account/i });
      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: 'newuser@glucotwin.org',
            password: 'Password123!',
            full_name: 'Dr. Jane Smith',
            role: 'clinician',
          }),
        });
        expect(mockLogin).toHaveBeenCalledWith('new.reg.token', expect.objectContaining({
          email: 'newuser@glucotwin.org',
        }));
      });
    });
  });

  describe('ProtectedRoute Component', () => {
    it('shows loading spinner when authentication check is in progress', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: null,
        token: null,
        isLoading: true,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Secret Patient Dashboard</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText(/Authenticating GlucoTwin Session.../i)).toBeInTheDocument();
      expect(screen.queryByText('Secret Patient Dashboard')).not.toBeInTheDocument();
    });

    it('redirects to /login if user is unauthenticated', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: null,
        token: null,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/login" element={<div>Login Page Screen</div>} />
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Secret Patient Dashboard</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Login Page Screen')).toBeInTheDocument();
      expect(screen.queryByText('Secret Patient Dashboard')).not.toBeInTheDocument();
    });

    it('renders protected child component if authenticated', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: {
          id: 1,
          email: 'patient.a@glucotwin.org',
          full_name: 'Patient Alpha',
          role: 'patient',
          patient_id: 1,
          created_at: '2026-01-01',
        },
        token: 'valid.mock.token',
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Secret Patient Dashboard</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Secret Patient Dashboard')).toBeInTheDocument();
    });
  });

  describe('CareTeam Page', () => {
    it('displays active care team members and allows patient to approve pending invites', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: {
          id: 5,
          email: 'patient.a@glucotwin.org',
          full_name: 'Patient Alpha',
          role: 'patient',
          patient_id: 1,
          created_at: '2026-01-01',
        },
        token: 'valid.patient.token',
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      vi.spyOn(ClientModule, 'apiRequest').mockImplementation((endpoint: string) => {
        if (endpoint === '/care-team/my-team') {
          return Promise.resolve([
            {
              id: 1,
              patient_id: 1,
              provider_user_id: 2,
              role_in_team: 'lead_endocrinologist',
              status: 'active',
              created_at: '2026-01-01',
              provider_name: 'Dr. Sarah Chen',
              provider_email: 'dr.chen@glucotwin.org',
              provider_role: 'clinician',
            },
            {
              id: 2,
              patient_id: 1,
              provider_user_id: 4,
              role_in_team: 'clinical_dietitian',
              status: 'pending',
              created_at: '2026-01-02',
              provider_name: 'Elena Rostova, RD',
              provider_email: 'elena.diet@glucotwin.org',
              provider_role: 'dietitian',
            },
          ]);
        }
        if (endpoint === '/auth/providers') {
          return Promise.resolve([]);
        }
        if (endpoint === '/care-team/2/approve') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({});
      });

      render(
        <MemoryRouter>
          <CareTeamPage />
        </MemoryRouter>
      );

      // Verify active provider and pending invite
      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Chen')).toBeInTheDocument();
        expect(screen.getByText('Elena Rostova, RD')).toBeInTheDocument();
      });

      const approveBtn = screen.getByRole('button', { name: /Approve Access/i });
      expect(approveBtn).toBeInTheDocument();

      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(ClientModule.apiRequest).toHaveBeenCalledWith('/care-team/2/approve', { method: 'POST' });
      });
    });

    it('allows revoking an active provider connection', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: {
          id: 5,
          email: 'patient.a@glucotwin.org',
          full_name: 'Patient Alpha',
          role: 'patient',
          patient_id: 1,
          created_at: '2026-01-01',
        },
        token: 'valid.patient.token',
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      vi.spyOn(ClientModule, 'apiRequest').mockImplementation((endpoint: string) => {
        if (endpoint === '/care-team/my-team') {
          return Promise.resolve([
            {
              id: 1,
              patient_id: 1,
              provider_user_id: 2,
              role_in_team: 'lead_endocrinologist',
              status: 'active',
              created_at: '2026-01-01',
              provider_name: 'Dr. Sarah Chen',
              provider_email: 'dr.chen@glucotwin.org',
              provider_role: 'clinician',
            },
          ]);
        }
        if (endpoint === '/auth/providers') {
          return Promise.resolve([]);
        }
        if (endpoint === '/care-team/1/revoke') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({});
      });

      render(
        <MemoryRouter>
          <CareTeamPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Chen')).toBeInTheDocument();
      });

      const revokeBtn = screen.getByTitle('Revoke access');
      fireEvent.click(revokeBtn);

      await waitFor(() => {
        expect(ClientModule.apiRequest).toHaveBeenCalledWith('/care-team/1/revoke', { method: 'POST' });
      });
    });
  });
});
