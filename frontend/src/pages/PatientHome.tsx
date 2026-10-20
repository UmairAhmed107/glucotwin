import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  Heart,
  HelpCircle,
  Info,
  Pill,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Utensils,
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <LoadingSkeleton height="200px" />
          <LoadingSkeleton height="200px" />
          <LoadingSkeleton height="200px" />
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
    history: [],
    encouragement: 'Consistent logging keeps your twin calibrated and accurate.',
  };

  const handleToggleDose = (doseId: number, currentStatus: string) => {
    if (!activePatientId) return;
    const newStatus = currentStatus === 'taken' ? 'pending' : 'taken';
    const takenAt = newStatus === 'taken' ? new Date().toISOString() : null;

    updateDoseMutation.mutate({
      doseId,
      patientId: activePatientId,
      status: newStatus,
      takenAt,
    });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950/60 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Live Patient Twin
            </span>
            <span className="text-xs text-slate-400">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {patient?.display_name || user?.full_name || 'Patient'}
          </h1>
          <p className="text-sm text-slate-300">
            Your metabolic digital twin is actively learning from your meals, glucose trends, and circadian cycles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh Home Summary"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/log')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-medium text-sm shadow-lg shadow-teal-500/20 transition hover:scale-[1.02]"
          >
            <Utensils className="w-4 h-4" />
            <span>Fast Log Meal</span>
          </button>
          <button
            onClick={() => navigate('/simulation')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm transition"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Twin What-If</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards: Glucose Today, Time In Range Ring, Weekly Streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Glucose Summary */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-teal-400" />
              Today's Glucose
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                todayGlucose.trend === 'rising'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : todayGlucose.trend === 'falling'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {todayGlucose.trend === 'rising' && <TrendingUp className="w-3 h-3" />}
              {todayGlucose.trend === 'falling' && <TrendingDown className="w-3 h-3" />}
              {todayGlucose.trend === 'stable' && <Check className="w-3 h-3" />}
              {todayGlucose.trend.toUpperCase()}
            </span>
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl md:text-5xl font-black text-white font-mono">
                {todayGlucose.current_value}
              </span>
              <span className="text-sm font-semibold text-slate-400">mg/dL</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {todayGlucose.readings_count} reading{todayGlucose.readings_count !== 1 ? 's' : ''} recorded today
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-800/80 text-center">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-mono">Min</span>
              <span className="text-sm font-bold text-slate-200 font-mono">{todayGlucose.min_value}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-mono">Average</span>
              <span className="text-sm font-bold text-slate-200 font-mono">{todayGlucose.mean_value}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-mono">Max</span>
              <span className="text-sm font-bold text-slate-200 font-mono">{todayGlucose.max_value}</span>
            </div>
          </div>
        </motion.div>

        {/* Time In Range Ring */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-emerald-400" />
              Time-in-Range (70-180)
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                tir.status === 'on_track'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {tir.status === 'on_track' ? 'Target Met (≥70%)' : 'Below Target'}
            </span>
          </div>

          <div className="flex items-center justify-around py-3">
            {/* SVG Circular Donut Ring */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#1e293b"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#10b981"
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={`${(tir.in_range_pct / 100) * 251.2} 251.2`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-white font-mono">{tir.in_range_pct}%</span>
                <span className="text-[10px] text-slate-400">In Range</span>
              </div>
            </div>

            {/* Sub stats */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span className="text-slate-400">Target (70-180):</span>
                <span className="font-bold text-white font-mono">{tir.in_range_pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span className="text-slate-400">Above (&gt;180):</span>
                <span className="font-bold text-white font-mono">{tir.above_range_pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span className="text-slate-400">Below (&lt;70):</span>
                <span className="font-bold text-white font-mono">{tir.below_range_pct}%</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center border-t border-slate-800/80 pt-2">
            Clinical standard: aiming for ≥70% readings in 70-180 mg/dL.
          </p>
        </motion.div>

        {/* Weekly Streak */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" />
              Logging Streak
            </span>
            <span className="text-xs font-mono font-semibold text-amber-400">
              {streak.current_streak_days} Days Active
            </span>
          </div>

          <div className="flex items-center gap-3 my-2">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Flame className="w-8 h-8 fill-amber-500/20" />
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">
                {streak.current_streak_days} Days
              </div>
              <p className="text-xs text-slate-400">Goal: 7-day complete cycle</p>
            </div>
          </div>

          {/* 7-Day Dots */}
          <div className="space-y-2 pt-3 border-t border-slate-800/80">
            <div className="flex justify-between items-center px-1">
              {streak.history?.map((h, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-mono">{h.day}</span>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      h.active
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    {h.active ? '✓' : '•'}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-2">
              {streak.encouragement}
            </p>
          </div>
        </motion.div>
      </div>

      {/* 3. Middle Section: Last Meal Response & Circadian Diurnal Recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Last Meal Predicted vs Actual Response */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">Last Meal & Twin Forecast</h2>
            </div>
            {lastMeal && (
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  lastMeal.badge_color === 'emerald'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : lastMeal.badge_color === 'teal'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {lastMeal.response_badge}
              </span>
            )}
          </div>

          {lastMeal ? (
            <div className="py-4 space-y-4">
              {/* Macro Pills */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block uppercase">Carbs</span>
                  <span className="text-sm font-bold text-teal-300 font-mono">{lastMeal.carbs_g}g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block uppercase">Protein</span>
                  <span className="text-sm font-bold text-blue-300 font-mono">{lastMeal.protein_g}g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block uppercase">Fat</span>
                  <span className="text-sm font-bold text-amber-300 font-mono">{lastMeal.fat_g}g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block uppercase">Calories</span>
                  <span className="text-sm font-bold text-purple-300 font-mono">{lastMeal.calories}</span>
                </div>
              </div>

              {/* Observed vs Predicted Comparison */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Baseline Starting Glucose:</span>
                  <span className="font-mono font-semibold text-slate-200">{lastMeal.pre_glucose} mg/dL</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 font-medium">Observed Peak Rise:</span>
                  <span className="font-mono font-bold text-white">+{lastMeal.observed_peak_rise} mg/dL</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 font-medium">Twin Model Forecast:</span>
                  <span className="font-mono font-bold text-teal-400">+{lastMeal.predicted_peak_rise} mg/dL</span>
                </div>
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Excursion Delta:</span>
                  <span
                    className={`font-mono font-bold ${
                      Math.abs(lastMeal.delta_mgdl) <= 8
                        ? 'text-emerald-400'
                        : lastMeal.delta_mgdl < 0
                        ? 'text-teal-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {lastMeal.delta_mgdl > 0 ? `+${lastMeal.delta_mgdl}` : lastMeal.delta_mgdl} mg/dL
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400 text-sm">
              No recent meal logged yet. Log your first meal to compare with twin predictions.
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => navigate('/log')}
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1"
            >
              Log next meal & compare <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Circadian Diurnal Meal Window Recommendation */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white">Next Suggested Meal Window</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Circadian Diurnal Sweep
            </span>
          </div>

          <div className="py-4 space-y-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-indigo-300 uppercase tracking-wider font-semibold block">
                    Optimal {circadian?.meal_type || 'Dinner'} Slot
                  </span>
                  <span className="text-2xl font-black text-white font-mono">
                    {circadian?.optimal_window || '18:00 - 19:15'}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono">
                  {circadian?.circadian_advantage || '16.5 mg/dL lower peak rise'}
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {circadian?.rationale ||
                  'Diurnal peripheral insulin sensitivity is significantly higher earlier in the evening. Scheduling your meal in this window prevents nocturnal glucose elevation.'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center gap-3 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Based on your metabolic twin's 48-slot circadian sweep algorithm.
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => navigate('/meal-tools')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
            >
              Explore 24h circadian sweep tool <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Medication Checklist Today */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">Today's Medication Checklist</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {medications.filter((m) => m.status === 'taken').length} of {medications.length} doses taken
            </span>
            <button
              onClick={() => navigate('/treatment')}
              className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
            >
              Manage Schedule <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {medications.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm">
            No medications scheduled for today.
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
                      ? 'bg-emerald-950/20 border-emerald-800/40'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleDose(dose.id, dose.status)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        isTaken
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                          : 'bg-slate-800 border border-slate-600 text-transparent hover:text-slate-400 hover:border-slate-500'
                      }`}
                      title={isTaken ? 'Mark as pending' : 'Mark as taken'}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>
                    <div>
                      <h3
                        className={`text-sm font-semibold ${
                          isTaken ? 'text-slate-300 line-through' : 'text-white'
                        }`}
                      >
                        {dose.medication_name || 'Medication'}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
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
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Taken ✓
                      </span>
                    ) : (
                      <button
                        onClick={() => handleToggleDose(dose.id, dose.status)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
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
