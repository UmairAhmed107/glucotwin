import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Award,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Flame,
  Home,
  Info,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Utensils,
  Wrench,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  usePatientHomeSummary,
  useUpdateDose,
  usePatient,
} from '../api/queries';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';

export const PatientHome: React.FC = () => {
  const { activePatientId } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved' | 'critical'>('all');

  const {
    data: summary,
    isLoading,
    isRefetching,
    refetch,
  } = usePatientHomeSummary(activePatientId);

  const { data: patient } = usePatient(activePatientId);
  const updateDoseMutation = useUpdateDose();

  if (!activePatientId) {
    return (
      <EmptyState
        title="No Active Patient Profile"
        description="Please select or set up your profile to view your personalized metabolic twin home screen."
      />
    );
  }

  if (isLoading && !summary) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
        <LoadingSkeleton height="120px" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LoadingSkeleton height="140px" />
          <LoadingSkeleton height="140px" />
          <LoadingSkeleton height="140px" />
          <LoadingSkeleton height="140px" />
        </div>
        <LoadingSkeleton height="300px" />
      </div>
    );
  }

  const todayGlucose = summary?.today_glucose || {
    current_value: 118,
    min_value: 98,
    max_value: 142,
    mean_value: 116,
    readings_count: 3,
    trend: 'stable',
    unit: 'mg/dL',
    last_reading_time: new Date().toISOString(),
  };

  const tir = summary?.time_in_range_ring || {
    in_range_pct: 78.5,
    below_range_pct: 2.5,
    above_range_pct: 19.0,
    total_readings: 24,
    target_in_range_pct: 70.0,
    status: 'on_track',
    window_label: 'Last 7 Days',
  };

  const lastMeal = summary?.last_meal;
  const circadian = summary?.circadian_suggestion;
  const medications = summary?.medications_today || [];
  const streak = summary?.weekly_streak || {
    current_streak_days: 5,
    target_days: 7,
    is_streak_active_today: true,
    encouragement: 'Great job logging your meals regularly!',
    history: [
      { day: 'Mon', active: true },
      { day: 'Tue', active: true },
      { day: 'Wed', active: true },
      { day: 'Thu', active: true },
      { day: 'Fri', active: true },
      { day: 'Sat', active: false },
      { day: 'Sun', active: false },
    ],
  };

  const handleToggleDose = (doseId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'taken' ? 'pending' : 'taken';
    updateDoseMutation.mutate({ doseId, patientId: activePatientId || 1, status: nextStatus as 'pending' | 'taken' });
  };

  const patientDisplayName = patient?.display_name || user?.full_name || 'Rohit';
  const shortName = patientDisplayName.split(' ')[0];

  return (
    <div className="space-y-8">
      {/* 1. Top Location Tag, Welcome Banner & Primary Action Button (Matches Reference Image 1) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="space-y-3">
          {/* Breadcrumb / Unit Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <Home className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-semibold text-white">Unit A-104</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">Resident Operations Hub</span>
          </div>

          {/* Large Hero Title */}
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Welcome back, {shortName}
          </h1>

          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Track filed maintenance grievances in real time, view technician telemetry, or lodge a new service ticket.
          </p>
        </div>

        {/* Primary CTA Button on Right (Pure White Pill Button from Image 1) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 flex items-center justify-center transition"
            title="Refresh telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => navigate('/log')}
            className="btn-white text-xs sm:text-sm font-bold shadow-lg shadow-white/5 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-black stroke-[3]" />
            <span>Lodge Maintenance Ticket</span>
          </button>
        </div>
      </div>

      {/* 2. 4 Primary Stat Cards Grid (Pixel-matching Reference Image 1) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL REGISTERED */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                TOTAL REGISTERED
              </span>
              <span className="text-xs text-zinc-500 font-medium">Facility Record</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
              <FileText className="w-4 h-4 text-zinc-400" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
              2
            </span>
          </div>
        </div>

        {/* Card 2: PENDING REVIEW */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                PENDING REVIEW
              </span>
              <span className="text-xs text-zinc-500 font-medium">Pending Action</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 font-mono">
              0
            </span>
          </div>
        </div>

        {/* Card 3: FIELD DISPATCHED */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider block">
                FIELD DISPATCHED
              </span>
              <span className="text-xs text-zinc-500 font-medium">Technician Active</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <Wrench className="w-4 h-4 text-zinc-300" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
              1
            </span>
          </div>
        </div>

        {/* Card 4: RESOLVED & CLOSED */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                RESOLVED & CLOSED
              </span>
              <span className="text-xs text-zinc-500 font-medium">Completed</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono">
              1
            </span>
          </div>
        </div>
      </div>

      {/* 2.5 Metabolic Insights: Last Meal & Twin Forecast */}
      <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                <Utensils className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Last Meal & Twin Forecast
                </h3>
                <p className="text-[11px] text-zinc-500">Postprandial glycemic trajectory validation</p>
              </div>
            </div>
            {lastMeal && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {lastMeal.response_badge || 'Matched twin forecast'}
              </span>
            )}
          </div>

          {lastMeal ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Pre-meal</span>
                <span className="text-base font-bold text-zinc-200 font-mono">
                  {lastMeal.pre_glucose ? `${lastMeal.pre_glucose} mg/dL` : '104 mg/dL'}
                </span>
              </div>
              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Observed Rise</span>
                <span className="text-base font-bold text-white font-mono">
                  {`+${lastMeal.observed_peak_rise} mg/dL`}
                </span>
              </div>
              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Twin Forecast</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  {`+${lastMeal.predicted_peak_rise} mg/dL`}
                </span>
              </div>
              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Variance</span>
                <span className="text-base font-bold text-zinc-300 font-mono">
                  {lastMeal.delta_mgdl !== undefined ? `${lastMeal.delta_mgdl} mg/dL` : '0.0 mg/dL'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 py-4">No recent meal logged today.</p>
          )}
        </div>

        {circadian && (
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="font-semibold text-zinc-200">Optimal Diurnal Window: </span>
                <span className="font-mono text-amber-400 font-bold">{circadian.optimal_window}</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-mono shrink-0">
              {circadian.circadian_advantage}
            </span>
          </div>
        )}
      </div>

      {/* 3. Maintenance Incident Tickets Section (Pixel-matching Reference Image 1) */}
      <div className="space-y-4">
        {/* Section Header & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Maintenance Incident Tickets
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select any card to inspect full telemetry audit lifecycle
            </p>
          </div>

          {/* Filter Bar with Search and Pills */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                placeholder="Search token, title, category..."
                className="bg-zinc-950 border border-zinc-800 rounded-full pl-9 pr-4 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition w-56 sm:w-64"
              />
            </div>

            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-full border border-zinc-850 text-xs">
              <button
                type="button"
                onClick={() => setTicketFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  ticketFilter === 'all'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                All Tickets
              </button>
              <button
                type="button"
                onClick={() => setTicketFilter('pending')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  ticketFilter === 'pending'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setTicketFilter('in_progress')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  ticketFilter === 'in_progress'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                In Progress
              </button>
              <button
                type="button"
                onClick={() => setTicketFilter('resolved')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  ticketFilter === 'resolved'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Resolved
              </button>
              <button
                type="button"
                onClick={() => setTicketFilter('critical')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
                  ticketFilter === 'critical'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>🚨 P1 - Critical</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2-Column Tickets Grid (Matching Image 1 cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ticket Card 1 */}
          <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-4">
            <div>
              {/* Card Top Row: Icon + Title + Version + Tags */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
                    <Wrench className="w-5 h-5 text-zinc-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      kitchen pvc pipe leakage
                    </h3>
                    <p className="text-[11px] font-mono text-zinc-500">
                      v1.2 • CMS 1041
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    Assigned
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
                    Plumbing
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                water leakage from pipe
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Meta token footer */}
              <div className="text-[11px] font-mono text-zinc-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Token: <strong className="text-zinc-300 font-bold">IKN-802789</strong></span>
                <span>•</span>
                <span>Priority: <strong className="text-zinc-300">P2</strong></span>
                <span>•</span>
                <span>SLA: <strong className="text-zinc-300">12h</strong></span>
                <span>•</span>
                <span>Unit: <strong className="text-zinc-300">A-A-104</strong></span>
              </div>

              {/* Full Width Inspect Button */}
              <button
                type="button"
                onClick={() => navigate('/timeline')}
                className="w-full py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-200 border border-zinc-800/80 hover:border-zinc-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <span>+ Inspect Ticket Lifecycle</span>
              </button>
            </div>
          </div>

          {/* Ticket Card 2 */}
          <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-4">
            <div>
              {/* Card Top Row: Icon + Title + Version + Tags */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
                    <Activity className="w-5 h-5 text-zinc-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      first floor lift
                    </h3>
                    <p className="text-[11px] font-mono text-zinc-500">
                      v1.2 • CMS 1045
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Resolved
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
                    HVAC & Lift
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                lift not working
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Meta token footer */}
              <div className="text-[11px] font-mono text-zinc-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Token: <strong className="text-zinc-300 font-bold">IKN-494108</strong></span>
                <span>•</span>
                <span>Priority: <strong className="text-zinc-300">P3</strong></span>
                <span>•</span>
                <span>SLA: <strong className="text-emerald-400 font-bold">Met</strong></span>
                <span>•</span>
                <span>Unit: <strong className="text-zinc-300">A-A-104</strong></span>
              </div>

              {/* Full Width Inspect Button */}
              <button
                type="button"
                onClick={() => navigate('/twin')}
                className="w-full py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-200 border border-zinc-800/80 hover:border-zinc-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <span>+ Inspect Ticket Lifecycle</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Live Metabolic Telemetry, Time In Range, & Medications */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Glucose Summary */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-white" />
              Today's Glucose
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-zinc-900 text-zinc-300 border border-zinc-800">
              {todayGlucose.trend.toUpperCase()}
            </span>
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white font-mono">
                {todayGlucose.current_value}
              </span>
              <span className="text-xs font-medium text-zinc-500">mg/dL</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {todayGlucose.readings_count} reading{todayGlucose.readings_count !== 1 ? 's' : ''} recorded today
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-zinc-850 text-center">
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase font-mono">Min</span>
              <span className="text-xs font-bold text-zinc-200 font-mono">{todayGlucose.min_value}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase font-mono">Average</span>
              <span className="text-xs font-bold text-zinc-200 font-mono">{todayGlucose.mean_value}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase font-mono">Max</span>
              <span className="text-xs font-bold text-zinc-200 font-mono">{todayGlucose.max_value}</span>
            </div>
          </div>
        </div>

        {/* Time In Range Ring */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-emerald-400" />
              Time-in-Range (70-180)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {tir.status === 'on_track' ? 'Target Met (≥70%)' : 'Below Target'}
            </span>
          </div>

          <div className="flex items-center justify-around py-2">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#18181b" strokeWidth="10" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#10b981"
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={`${(tir.in_range_pct / 100) * 251.2} 251.2`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-xl font-bold text-white font-mono">{tir.in_range_pct}%</span>
                <span className="text-[9px] text-zinc-500">In Range</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span className="text-zinc-400">Target (70-180):</span>
                <span className="font-bold text-white font-mono">{tir.in_range_pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                <span className="text-zinc-400">Above (&gt;180):</span>
                <span className="font-bold text-white font-mono">{tir.above_range_pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                <span className="text-zinc-400">Below (&lt;70):</span>
                <span className="font-bold text-white font-mono">{tir.below_range_pct}%</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 text-center border-t border-zinc-850 pt-2">
            Clinical standard: target ≥70% in 70-180 mg/dL.
          </p>
        </div>

        {/* Weekly Streak */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" />
              Logging Streak
            </span>
            <span className="text-xs font-mono font-semibold text-amber-400">
              {streak.current_streak_days} Days Active
            </span>
          </div>

          <div className="flex items-center gap-3 my-2">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400">
              <Flame className="w-6 h-6 fill-amber-500/20" />
            </div>
            <div>
              <div className="text-xl font-bold text-white font-mono">
                {streak.current_streak_days} Days Streak
              </div>
              <p className="text-xs text-zinc-400">Goal: 7-day complete cycle</p>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-zinc-850">
            <div className="flex justify-between items-center px-1">
              {streak.history?.map((h, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-zinc-500 font-mono">{h.day}</span>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      h.active
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                    }`}
                  >
                    {h.active ? '✓' : '•'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Medication Checklist */}
      <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-850">
          <div className="flex items-center gap-2.5">
            <Pill className="w-5 h-5 text-white" />
            <h2 className="text-base font-bold text-white">Today's Medication Checklist</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">
              {medications.filter((m) => m.status === 'taken').length} of {medications.length} doses logged
            </span>
            <button
              onClick={() => navigate('/treatment')}
              className="text-xs text-zinc-300 hover:text-white font-semibold flex items-center gap-1"
            >
              Manage Schedule <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {medications.length === 0 ? (
          <div className="py-6 text-center text-zinc-500 text-xs">
            No active prescriptions requiring confirmation today.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {medications.map((dose) => {
              const isTaken = dose.status === 'taken';
              return (
                <div
                  key={dose.id}
                  className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                    isTaken
                      ? 'bg-zinc-950/40 border-zinc-850 text-zinc-400'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleDose(dose.id, dose.status)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        isTaken
                          ? 'bg-white text-black font-bold shadow-sm'
                          : 'bg-zinc-900 border border-zinc-700 text-transparent hover:text-zinc-400'
                      }`}
                      title={isTaken ? 'Mark as pending' : 'Mark as taken'}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>
                    <div>
                      <h3 className={`text-sm font-semibold ${isTaken ? 'line-through text-zinc-500' : 'text-white'}`}>
                        {dose.medication_name || 'Medication'}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span>{dose.dose}</span>
                        <span>•</span>
                        <span>
                          {new Date(dose.scheduled_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {isTaken ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-900 text-zinc-400 border border-zinc-800">
                        Taken ✓
                      </span>
                    ) : (
                      <button
                        onClick={() => handleToggleDose(dose.id, dose.status)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white hover:bg-zinc-200 text-black transition shadow-sm"
                      >
                        Take Dose
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
