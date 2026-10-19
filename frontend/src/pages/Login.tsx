import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Lock, Mail, ShieldCheck, Stethoscope, User, Utensils } from 'lucide-react';
import { apiRequest } from '../api/client';
import { TokenResponse } from '../api/types';
import { useAuth } from '../context/AuthContext';

interface DemoAccount {
  label: string;
  role: string;
  email: string;
  icon: React.ElementType;
  color: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Admin', role: 'admin', email: 'admin@glucotwin.org', icon: ShieldCheck, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { label: 'Dr. Sarah Chen', role: 'clinician', email: 'dr.chen@glucotwin.org', icon: Stethoscope, color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' },
  { label: 'Dr. Rajesh Patel', role: 'clinician', email: 'dr.patel@glucotwin.org', icon: Stethoscope, color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' },
  { label: 'Elena (Dietitian)', role: 'dietitian', email: 'elena.diet@glucotwin.org', icon: Utensils, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { label: 'Patient A', role: 'patient', email: 'patient.a@glucotwin.org', icon: User, color: 'text-teal-400 border-teal-500/30 bg-teal-500/10' },
  { label: 'Patient B', role: 'patient', email: 'patient.b@glucotwin.org', icon: User, color: 'text-teal-400 border-teal-500/30 bg-teal-500/10' },
  { label: 'Patient C', role: 'patient', email: 'patient.c@glucotwin.org', icon: User, color: 'text-teal-400 border-teal-500/30 bg-teal-500/10' },
];

export const Login: React.FC = () => {
  const { login } = useAuth();
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
    <div className="min-h-screen bg-[#070D19] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-950/20 via-[#0B1220] to-[#070D19] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-700 text-[#0B1220] shadow-xl shadow-teal-500/20 mb-4">
          <Activity className="w-8 h-8 font-black" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          GlucoTwin Platform
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Metabolic Digital Twin & Role-Based Clinical Decision Support
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-[#0F172A]/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@glucotwin.org"
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-[#070D19] font-semibold text-xs rounded-xl shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins Section */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                1-Click Quick Demo Sign-In
              </span>
              <span className="text-[10px] text-teal-400/80 font-mono">seed=42</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const Icon = acc.icon;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleQuickLogin(acc.email)}
                    className={`p-2 rounded-xl border text-left transition-all hover:scale-[1.02] flex flex-col justify-between ${acc.color}`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[9px] uppercase font-mono font-bold tracking-wider opacity-80">
                        {acc.role}
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-semibold truncate text-slate-100">
                        {acc.label}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate font-mono">
                        {acc.email}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400">
            Need an account?{' '}
            <Link to="/register" className="text-teal-400 hover:text-teal-300 font-semibold underline underline-offset-2">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
