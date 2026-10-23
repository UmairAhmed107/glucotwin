import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Building,
  Lock,
  Mail,
  Sun,
  Moon,
  User,
  Users,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { TokenResponse, UserRole } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export const Register: React.FC = () => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await apiRequest<TokenResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          role,
        }),
      });

      login(res.access_token, res.user);
      navigate('/', { replace: true });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Registration failed. Please check inputs and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] bg-dot-grid flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-12 text-zinc-100 font-sans">
      {/* Top Simple Bar */}
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between pb-6 border-b border-zinc-850/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white">
              GlucoTwin CMS
            </span>
            <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-700/80">
              REGISTRATION
            </span>
            <p className="text-[10px] text-zinc-400 font-medium">Facility & Incident Operations Console</p>
          </div>
        </div>

        <button
          id="theme-toggle-btn"
          type="button"
          onClick={toggleTheme}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            theme === 'dark'
              ? 'bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
              : 'bg-slate-100 border border-slate-300 text-indigo-600 hover:text-indigo-800 hover:border-slate-400 shadow-sm'
          }`}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600 fill-indigo-100" />
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-md w-full mx-auto my-auto py-10">
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-3xl p-7 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Card Header */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-white text-black flex items-center justify-center font-bold shadow-md shrink-0">
              <Building className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Portal Access</h2>
              <p className="text-xs text-zinc-400">Register new authorized account</p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-850 flex items-center mb-6">
            <Link
              to="/login"
              className="flex-1 py-2 text-xs font-medium rounded-lg text-zinc-400 hover:text-white text-center transition"
            >
              Sign In
            </Link>
            <button
              type="button"
              className="flex-1 py-2 text-xs font-semibold rounded-lg bg-white text-black shadow-sm text-center transition"
            >
              Register Resident
            </button>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Jane Doe or Alex Smith"
                  className="w-full bg-[#050508] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-normal"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.org"
                  className="w-full bg-[#050508] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-normal"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-[#050508] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-normal"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                System Role
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'patient', label: 'Patient' },
                  { id: 'clinician', label: 'Clinician' },
                  { id: 'dietitian', label: 'Dietitian' },
                  { id: 'admin', label: 'Admin' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRole(item.id as UserRole)}
                    className={`py-2 px-2.5 text-xs font-semibold rounded-xl border transition-all text-center cursor-pointer ${
                      role === item.id
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-5 rounded-xl btn-white font-bold text-xs tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Registering Account...</span>
              ) : (
                <>
                  <span>Create Account & Enter Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Protected by Enterprise Role-Based Access Control</span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl w-full mx-auto text-center pt-6 border-t border-zinc-850/80 text-[11px] text-zinc-500">
        Residential Society Complaint Management System • Facility Operations OS
      </div>
    </div>
  );
};
