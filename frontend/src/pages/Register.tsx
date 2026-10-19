import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Lock, Mail, ShieldCheck, Stethoscope, User, Utensils } from 'lucide-react';
import { apiRequest } from '../api/client';
import { TokenResponse, UserRole } from '../api/types';
import { useAuth } from '../context/AuthContext';

export const Register: React.FC = () => {
  const { login } = useAuth();
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
    <div className="min-h-screen bg-[#070D19] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-950/20 via-[#0B1220] to-[#070D19] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-700 text-[#0B1220] shadow-xl shadow-teal-500/20 mb-4">
          <Activity className="w-8 h-8 font-black" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Create GlucoTwin Account
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Register for personalized digital twin simulations and clinical decision support
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
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
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Jane Doe or Alex Smith"
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                />
              </div>
            </div>

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
                  placeholder="name@domain.org"
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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Select Your Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('patient')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === 'patient'
                      ? 'border-teal-500/80 bg-teal-500/15 text-teal-300 shadow-sm'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200">
                    <User className="w-3.5 h-3.5 text-teal-400" />
                    Patient
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Personal metabolic twin & logging</p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('clinician')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === 'clinician'
                      ? 'border-indigo-500/80 bg-indigo-500/15 text-indigo-300 shadow-sm'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200">
                    <Stethoscope className="w-3.5 h-3.5 text-indigo-400" />
                    Clinician
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Decision support & care teams</p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('dietitian')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === 'dietitian'
                      ? 'border-emerald-500/80 bg-emerald-500/15 text-emerald-300 shadow-sm'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200">
                    <Utensils className="w-3.5 h-3.5 text-emerald-400" />
                    Dietitian
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Nutritional planning & guidance</p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === 'admin'
                      ? 'border-amber-500/80 bg-amber-500/15 text-amber-300 shadow-sm'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    Admin
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Global audit & system governance</p>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 py-2.5 px-4 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-[#070D19] font-semibold text-xs rounded-xl shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Registering...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-400 hover:text-teal-300 font-semibold underline underline-offset-2">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
