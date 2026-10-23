import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Building,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  Stethoscope,
  Sun,
  Moon,
  User,
  Users,
  Utensils,
  Zap,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { TokenResponse } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

interface DemoAccount {
  label: string;
  role: string;
  email: string;
  icon: React.ElementType;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Admin', role: 'admin', email: 'admin@glucotwin.org', icon: ShieldCheck },
  { label: 'Dr. Sarah Chen', role: 'clinician', email: 'dr.chen@glucotwin.org', icon: Stethoscope },
  { label: 'Dr. Rajesh Patel', role: 'clinician', email: 'dr.patel@glucotwin.org', icon: Stethoscope },
  { label: 'Elena (Dietitian)', role: 'dietitian', email: 'elena.diet@glucotwin.org', icon: Utensils },
  { label: 'Patient A', role: 'patient', email: 'patient.a@glucotwin.org', icon: User },
  { label: 'Patient B', role: 'patient', email: 'patient.b@glucotwin.org', icon: User },
  { label: 'Patient C', role: 'patient', email: 'patient.c@glucotwin.org', icon: User },
];

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent, overrideEmail?: string, overridePass?: string) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const submitEmail = overrideEmail || email;
    const submitPass = overridePass || password;

    try {
      const res = await apiRequest<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: submitEmail.trim(),
          password: submitPass,
        }),
      });

      login(res.access_token, res.user);
      navigate('/', { replace: true });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    handleSubmit(undefined, demoEmail, 'Password123!');
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
              METABOLIC OS
            </span>
            <p className="text-[10px] text-zinc-400 font-medium">Facility & Incident Operations Console</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-[11px] text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Facility Services Online</span>
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
      </div>

      {/* Main Two-Column Content (Matches Reference Image 2) */}
      <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center my-auto py-10">
        {/* Left Column: Headline, Description, & Metrics */}
        <div className="lg:col-span-7 space-y-8">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium">GlucoTwin Smart Digital Twin</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">Clinical Operations OS</span>
          </div>

          {/* Large Hero Title */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1]">
              Unified Metabolic <br />
              <span className="text-zinc-100">Incident Operations</span>
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base max-w-xl leading-relaxed">
              An enterprise operations ecosystem connecting patients, clinical dietitians, and endocrinologists. Track glycemic excursions, monitor CGM telemetry, and verify deterministic safety governance in real time.
            </p>
          </div>

          {/* 3 Metric Summary Cards */}
          <div className="grid grid-cols-3 gap-4 max-w-xl pt-2">
            <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Specialists
              </span>
              <span className="text-2xl font-black text-white font-mono block">
                7 Staff
              </span>
              <span className="text-[11px] text-zinc-500 block truncate mt-0.5">
                Endocrinology, RD, MD
              </span>
            </div>

            <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Uptime
              </span>
              <span className="text-2xl font-black text-white font-mono block">
                24/7
              </span>
              <span className="text-[11px] text-zinc-500 block truncate mt-0.5">
                Real-time sensor feed
              </span>
            </div>

            <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Target SLA
              </span>
              <span className="text-2xl font-black text-white font-mono block">
                4 Hours
              </span>
              <span className="text-[11px] text-zinc-500 block truncate mt-0.5">
                P1 critical alert triage
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Portal Access Card */}
        <div className="lg:col-span-5 max-w-md w-full mx-auto">
          <div className="bg-[#09090b] border border-zinc-800/90 rounded-3xl p-7 sm:p-8 shadow-2xl backdrop-blur-xl">
            {/* Card Header */}
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-white text-black flex items-center justify-center font-bold shadow-md shrink-0">
                <Building className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Portal Access</h2>
                <p className="text-xs text-zinc-400">Sign in to access your authorized console</p>
              </div>
            </div>

            {/* Tab Switcher (Sign In vs Register Resident) */}
            <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-850 flex items-center mb-6">
              <span
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-white text-black shadow-sm text-center transition select-none"
              >
                Sign In
              </span>
              <Link
                to="/register"
                className="flex-1 py-2 text-xs font-medium rounded-lg text-zinc-400 hover:text-white text-center transition"
              >
                Register Resident
              </Link>
            </div>

            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="name@glucotwin.org"
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
                    placeholder="••••••••••••"
                    className="w-full bg-[#050508] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-normal"
                  />
                </div>
              </div>

              {/* Submit Pure White Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-5 rounded-xl btn-white font-bold text-xs tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick 1-Click Demo Accounts Selector */}
            <div className="mt-6 pt-5 border-t border-zinc-850">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2.5">
                Quick 1-Click Demo Sign-in
              </p>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {DEMO_ACCOUNTS.map((acc) => {
                  const Icon = acc.icon;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => handleQuickLogin(acc.email)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-left transition text-zinc-300 hover:text-white"
                      title={acc.email}
                    >
                      <Icon className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span className="text-[11px] truncate">{acc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Security Note at Bottom */}
            <div className="mt-5 text-center">
              <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Protected by Enterprise Role-Based Access Control</span>
              </p>
            </div>
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
