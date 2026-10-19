import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Plus,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  TrendingDown,
  TrendingUp,
  Utensils,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from 'recharts';
import { useApp } from '../context/AppContext';
import {
  usePatient,
  useCompareMeals,
  useBestTime,
  useDailyPlan,
} from '../api/queries';
import {
  CompareMealsResponse,
  DailyPlanMeal,
  DailyPlanResponse,
  PredictMealInput,
} from '../api/types';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';

export const MealToolsPage: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: patient } = usePatient(activePatientId);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'compare' | 'best-time' | 'daily-plan'>('compare');

  // ============================================================================
  // Tab 1: Compare Meals State
  // ============================================================================
  const [candidateMeals, setCandidateMeals] = useState<Array<PredictMealInput & { label: string }>>([
    {
      label: 'Mediterranean Salmon & Quinoa',
      carbs_g: 38,
      protein_g: 32,
      fat_g: 14,
      fibre_g: 6,
      pre_glucose: 105,
      pre_trend30: 0.0,
      time_of_day: 13.0,
      calories: 38 * 4 + 32 * 4 + 14 * 9,
    },
    {
      label: 'Pasta Bolognese & Garlic Bread',
      carbs_g: 88,
      protein_g: 24,
      fat_g: 22,
      fibre_g: 4,
      pre_glucose: 105,
      pre_trend30: 0.0,
      time_of_day: 13.0,
      calories: 88 * 4 + 24 * 4 + 22 * 9,
    },
    {
      label: 'Tofu Vegetable Stir-Fry with Brown Rice',
      carbs_g: 52,
      protein_g: 22,
      fat_g: 12,
      fibre_g: 8,
      pre_glucose: 105,
      pre_trend30: 0.0,
      time_of_day: 13.0,
      calories: 52 * 4 + 22 * 4 + 12 * 9,
    },
  ]);

  const compareMutation = useCompareMeals(activePatientId || 0);
  const [compareResult, setCompareResult] = useState<CompareMealsResponse | null>(null);

  const handleAddCandidate = () => {
    if (candidateMeals.length >= 4) return;
    setCandidateMeals((prev) => [
      ...prev,
      {
        label: `Candidate Meal #${prev.length + 1}`,
        carbs_g: 45,
        protein_g: 20,
        fat_g: 12,
        fibre_g: 5,
        pre_glucose: 105,
        pre_trend30: 0.0,
        time_of_day: 13.0,
        calories: 45 * 4 + 20 * 4 + 12 * 9,
      },
    ]);
  };

  const handleRemoveCandidate = (index: number) => {
    if (candidateMeals.length <= 2) return;
    setCandidateMeals((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRunComparison = async () => {
    if (!activePatientId) return;
    try {
      const res = await compareMutation.mutateAsync({
        meals: candidateMeals,
        labels: candidateMeals.map((m) => m.label),
      });
      setCompareResult(res);
    } catch (err) {
      console.error('Compare meals failed', err);
    }
  };

  // ============================================================================
  // Tab 2: Best Time to Eat State
  // ============================================================================
  const [bestTimeMeal, setBestTimeMeal] = useState({
    carbs_g: 55,
    protein_g: 24,
    fat_g: 15,
    fibre_g: 5,
    pre_glucose: 105,
    pre_trend30: 0.0,
  });

  const { data: bestTimeData, isLoading: loadingBestTime } = useBestTime(
    activePatientId,
    bestTimeMeal,
    activeTab === 'best-time'
  );

  // ============================================================================
  // Tab 3: Daily Planner State
  // ============================================================================
  const [planMeals, setPlanMeals] = useState<DailyPlanMeal[]>([
    {
      label: 'Breakfast (Oats & Berries)',
      time_of_day: 8.0,
      carbs_g: 45,
      protein_g: 18,
      fat_g: 8,
      fibre_g: 6,
      pre_glucose: 95,
      pre_trend30: 0.0,
      calories: 45 * 4 + 18 * 4 + 8 * 9,
    },
    {
      label: 'Morning Snack',
      time_of_day: 9.5, // 90 min apart to trigger the < 120m overlap warning!
      carbs_g: 25,
      protein_g: 6,
      fat_g: 6,
      fibre_g: 3,
      pre_glucose: 115,
      pre_trend30: 0.5,
      calories: 25 * 4 + 6 * 4 + 6 * 9,
    },
    {
      label: 'Lunch (Chicken Wrap)',
      time_of_day: 13.0,
      carbs_g: 60,
      protein_g: 32,
      fat_g: 16,
      fibre_g: 5,
      pre_glucose: 105,
      pre_trend30: 0.0,
      calories: 60 * 4 + 32 * 4 + 16 * 9,
    },
    {
      label: 'Dinner (Stir-Fry & Rice)',
      time_of_day: 19.5,
      carbs_g: 65,
      protein_g: 28,
      fat_g: 18,
      fibre_g: 7,
      pre_glucose: 108,
      pre_trend30: -0.2,
      calories: 65 * 4 + 28 * 4 + 18 * 9,
    },
  ]);

  const dailyPlanMutation = useDailyPlan(activePatientId || 0);
  const [dailyPlanResult, setDailyPlanResult] = useState<DailyPlanResponse | null>(null);

  const handleAddPlanMeal = () => {
    setPlanMeals((prev) => [
      ...prev,
      {
        label: `Meal #${prev.length + 1}`,
        time_of_day: 15.0,
        carbs_g: 35,
        protein_g: 15,
        fat_g: 10,
        fibre_g: 4,
        pre_glucose: 100,
        pre_trend30: 0.0,
        calories: 35 * 4 + 15 * 4 + 10 * 9,
      },
    ]);
  };

  const handleRemovePlanMeal = (index: number) => {
    if (planMeals.length <= 1) return;
    setPlanMeals((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEvaluateDailyPlan = async () => {
    if (!activePatientId) return;
    try {
      const res = await dailyPlanMutation.mutateAsync({ meals: planMeals });
      setDailyPlanResult(res);
    } catch (err) {
      console.error('Daily plan evaluation failed', err);
    }
  };

  if (!activePatientId) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          title="No Active Patient Selected"
          description="Select or create a patient to utilize the Metabolic Twin meal tools."
          actionText="Go to Patient Setup"
          onAction={() => (window.location.href = '/patient-setup')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Metabolic Meal Tools</h1>
            <ProvenanceBadge provenance="TWIN_PREDICTED" safetyChecked={true} />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Compare candidate meals side-by-side, determine the circadian optimal meal slot, and evaluate full daily
            meal sequences.
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex space-x-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('compare')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'compare'
              ? 'border-teal-500 text-teal-400 bg-teal-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Compare Candidate Meals</span>
        </button>

        <button
          onClick={() => setActiveTab('best-time')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'best-time'
              ? 'border-teal-500 text-teal-400 bg-teal-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Best Time to Eat (Circadian Sweep)</span>
        </button>

        <button
          onClick={() => setActiveTab('daily-plan')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'daily-plan'
              ? 'border-teal-500 text-teal-400 bg-teal-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sun className="w-4 h-4" />
          <span>Daily Meal Planner</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: COMPARE MEALS */}
      {/* ==================================================================== */}
      {activeTab === 'compare' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-white">Candidate Meal Comparison</h2>
              <p className="text-xs text-slate-400">
                Evaluate 2 to 4 candidate meals simultaneously to identify the option with lowest glycemic impact.
              </p>
            </div>
            {candidateMeals.length < 4 && (
              <button
                onClick={handleAddCandidate}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Candidate</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidateMeals.map((meal, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 relative group"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                    Option #{idx + 1}
                  </span>
                  {candidateMeals.length > 2 && (
                    <button
                      onClick={() => handleRemoveCandidate(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                      title="Remove candidate"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={meal.label}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCandidateMeals((prev) =>
                      prev.map((m, i) => (i === idx ? { ...m, label: val } : m))
                    );
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-semibold focus:outline-none focus:border-teal-500"
                  placeholder="Meal description"
                />

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block">Carbs (g)</label>
                    <input
                      type="number"
                      min="0"
                      value={meal.carbs_g}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCandidateMeals((prev) =>
                          prev.map((m, i) => (i === idx ? { ...m, carbs_g: val } : m))
                        );
                      }}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Protein (g)</label>
                    <input
                      type="number"
                      min="0"
                      value={meal.protein_g}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCandidateMeals((prev) =>
                          prev.map((m, i) => (i === idx ? { ...m, protein_g: val } : m))
                        );
                      }}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Fat (g)</label>
                    <input
                      type="number"
                      min="0"
                      value={meal.fat_g}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCandidateMeals((prev) =>
                          prev.map((m, i) => (i === idx ? { ...m, fat_g: val } : m))
                        );
                      }}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 font-mono flex justify-between">
                  <span>Energy: {meal.carbs_g * 4 + meal.protein_g * 4 + meal.fat_g * 9} kcal</span>
                  <span>Pre-G: {meal.pre_glucose} mg/dL</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center pt-2">
            <button
              onClick={handleRunComparison}
              disabled={compareMutation.isPending}
              className="inline-flex items-center space-x-2 py-2.5 px-6 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 disabled:opacity-50 text-slate-950 font-semibold rounded-lg shadow-lg shadow-teal-500/20 transition-all cursor-pointer text-sm"
            >
              {compareMutation.isPending ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Evaluating Candidate Ensembles...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Rank Candidate Meals</span>
                </>
              )}
            </button>
          </div>

          {/* Ranked Results Display */}
          {compareResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                Ranked Comparison Results (Lowest Peak Rise)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {compareResult.ranked_meals.map((item) => {
                  const isBest = item.rank === 1;
                  return (
                    <div
                      key={item.index}
                      className={`p-5 rounded-2xl border transition-all ${
                        isBest
                          ? 'bg-teal-500/10 border-teal-500/40 shadow-lg shadow-teal-500/5'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isBest ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          Rank #{item.rank}
                        </span>

                        {isBest && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            <Award className="w-3.5 h-3.5" />
                            <span>Best Choice</span>
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-white text-sm mb-2">{item.label}</h4>

                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Predicted Peak Rise</span>
                          <span className="text-2xl font-bold font-mono text-white">
                            +{item.prediction.median}{' '}
                            <span className="text-xs font-normal text-slate-400">mg/dL</span>
                          </span>
                        </div>

                        <div className="text-xs font-mono text-teal-400/90">
                          80% envelope: [{item.prediction.p10} - {item.prediction.p90}] mg/dL
                        </div>

                        <div className="pt-2 border-t border-slate-800 text-xs flex justify-between">
                          <span className="text-slate-400">Delta vs Best:</span>
                          <span
                            className={`font-mono font-semibold ${
                              isBest ? 'text-teal-400' : 'text-amber-400'
                            }`}
                          >
                            {isBest ? '0.0 mg/dL (Baseline)' : `+${item.delta_vs_best} mg/dL`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: BEST TIME TO EAT */}
      {/* ==================================================================== */}
      {activeTab === 'best-time' && (
        <div className="space-y-6">
          <SectionCard
            title="Circadian Peak Rise Sweep (24-Hour Diurnal Clock)"
            description="Simulates the fixed meal across 48 half-hour slots to measure insulin sensitivity variation across the circadian cycle"
          >
            {/* Macro Configuration for Time Sweep */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <label className="text-[10px] text-slate-400 block">Carbs (g)</label>
                <input
                  type="number"
                  value={bestTimeMeal.carbs_g}
                  onChange={(e) =>
                    setBestTimeMeal((p) => ({ ...p, carbs_g: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Protein (g)</label>
                <input
                  type="number"
                  value={bestTimeMeal.protein_g}
                  onChange={(e) =>
                    setBestTimeMeal((p) => ({ ...p, protein_g: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Fat (g)</label>
                <input
                  type="number"
                  value={bestTimeMeal.fat_g}
                  onChange={(e) =>
                    setBestTimeMeal((p) => ({ ...p, fat_g: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Pre-Glucose (mg/dL)</label>
                <input
                  type="number"
                  value={bestTimeMeal.pre_glucose}
                  onChange={(e) =>
                    setBestTimeMeal((p) => ({ ...p, pre_glucose: parseFloat(e.target.value) || 100 }))
                  }
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                />
              </div>
            </div>

            {loadingBestTime ? (
              <LoadingSkeleton className="h-72 w-full" />
            ) : bestTimeData ? (
              <div className="space-y-6">
                {/* 3 Metric Cards: Best, Worst, Spread */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Best Slot */}
                  <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 space-y-1">
                    <div className="flex items-center justify-between text-xs text-teal-300">
                      <span>Optimal Eating Slot</span>
                      <TrendingDown className="w-4 h-4 text-teal-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-white">
                      {bestTimeData.best_slot.hour_label}
                    </div>
                    <div className="text-xs text-teal-300 font-mono">
                      +{bestTimeData.best_slot.median_rise} mg/dL rise (Lowest)
                    </div>
                  </div>

                  {/* Worst Slot */}
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                    <div className="flex items-center justify-between text-xs text-amber-300">
                      <span>Suboptimal Slot</span>
                      <TrendingUp className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-white">
                      {bestTimeData.worst_slot.hour_label}
                    </div>
                    <div className="text-xs text-amber-300 font-mono">
                      +{bestTimeData.worst_slot.median_rise} mg/dL rise (Highest)
                    </div>
                  </div>

                  {/* Diurnal Spread */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Diurnal Spread</span>
                      <Clock className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-white">
                      {bestTimeData.spread} <span className="text-xs font-normal text-slate-400">mg/dL</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Max circadian excursion delta
                    </div>
                  </div>
                </div>

                {/* 24h Chronological Curve */}
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={bestTimeData.slots}
                      margin={{ top: 15, right: 20, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="circadianGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#14B8A6" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                      <XAxis
                        dataKey="hour_label"
                        stroke="#64748B"
                        fontSize={11}
                        interval={3}
                        tickLine={false}
                        axisLine={{ stroke: '#1E293B' }}
                      />
                      <YAxis
                        stroke="#64748B"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#1E293B' }}
                        domain={['auto', 'auto']}
                        label={{
                          value: 'Peak Rise (mg/dL)',
                          angle: -90,
                          position: 'insideLeft',
                          fontSize: 10,
                          fill: '#64748B',
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#334155',
                          borderRadius: '0.5rem',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [`+${val} mg/dL`, 'Median Predicted Rise']}
                        labelFormatter={(lbl) => `Time: ${lbl}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="median_rise"
                        stroke="#14B8A6"
                        strokeWidth={2.5}
                        fill="url(#circadianGrad)"
                      />
                      {/* Highlight Best Slot */}
                      <ReferenceDot
                        x={bestTimeData.best_slot.hour_label}
                        y={bestTimeData.best_slot.median_rise}
                        r={6}
                        fill="#14B8A6"
                        stroke="#0F172A"
                        strokeWidth={2}
                      />
                      {/* Highlight Worst Slot */}
                      <ReferenceDot
                        x={bestTimeData.worst_slot.hour_label}
                        y={bestTimeData.worst_slot.median_rise}
                        r={6}
                        fill="#F59E0B"
                        stroke="#0F172A"
                        strokeWidth={2}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </SectionCard>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: DAILY PLANNER */}
      {/* ==================================================================== */}
      {activeTab === 'daily-plan' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-white">Daily Meal Schedule Sequence</h2>
              <p className="text-xs text-slate-400">
                Plan a chronological series of meals across the day to locate peak excursion risks and check meal
                isolation.
              </p>
            </div>
            <button
              onClick={handleAddPlanMeal}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Meal to Plan</span>
            </button>
          </div>

          {/* Meals Input Cards */}
          <div className="space-y-3">
            {planMeals.map((meal, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
              >
                <div className="sm:col-span-4">
                  <label className="text-[10px] text-slate-400 block mb-0.5">Meal Name</label>
                  <input
                    type="text"
                    value={meal.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPlanMeals((prev) => prev.map((m, i) => (i === idx ? { ...m, label: val } : m)));
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs font-semibold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-0.5">Time of Day (h)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="23.5"
                    value={meal.time_of_day}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setPlanMeals((prev) => prev.map((m, i) => (i === idx ? { ...m, time_of_day: val } : m)));
                    }}
                    className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-0.5">Carbs (g)</label>
                  <input
                    type="number"
                    value={meal.carbs_g}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setPlanMeals((prev) => prev.map((m, i) => (i === idx ? { ...m, carbs_g: val } : m)));
                    }}
                    className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-3">
                  <div className="text-[10px] text-slate-400 block mb-0.5">Protein / Fat / Pre-G</div>
                  <div className="text-xs font-mono text-slate-300">
                    {meal.protein_g}g P • {meal.fat_g}g F • {meal.pre_glucose} mg/dL
                  </div>
                </div>

                <div className="sm:col-span-1 text-right">
                  {planMeals.length > 1 && (
                    <button
                      onClick={() => handleRemovePlanMeal(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition-colors"
                      title="Remove meal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center pt-2">
            <button
              onClick={handleEvaluateDailyPlan}
              disabled={dailyPlanMutation.isPending}
              className="inline-flex items-center space-x-2 py-2.5 px-6 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 disabled:opacity-50 text-slate-950 font-semibold rounded-lg shadow-lg shadow-teal-500/20 transition-all cursor-pointer text-sm"
            >
              {dailyPlanMutation.isPending ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Evaluating Daily Schedule...</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4" />
                  <span>Evaluate Full Daily Plan</span>
                </>
              )}
            </button>
          </div>

          {/* Daily Plan Evaluation Results */}
          {dailyPlanResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-4">
              {/* Overlap Model Assumption Warnings */}
              {dailyPlanResult.warnings && dailyPlanResult.warnings.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-400 font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Prandial Window Overlap Warning (&lt; 120 Minutes)</span>
                  </div>
                  {dailyPlanResult.warnings.map((warn, wIdx) => (
                    <p key={wIdx} className="leading-relaxed pl-6 border-l-2 border-amber-500/40">
                      {warn}
                    </p>
                  ))}
                </div>
              )}

              {/* Per-Meal Output Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {dailyPlanResult.plan.map((item, pIdx) => {
                  const isWorst = item.is_worst_meal;
                  const hrInt = Math.floor(item.time_of_day);
                  const minInt = Math.round((item.time_of_day - hrInt) * 60);
                  const timeLabel = `${hrInt.toString().padStart(2, '0')}:${minInt
                    .toString()
                    .padStart(2, '0')}`;

                  return (
                    <div
                      key={pIdx}
                      className={`p-4 rounded-xl border space-y-2 transition-all ${
                        isWorst
                          ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono text-slate-400 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{timeLabel}</span>
                        </span>

                        {isWorst && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Worst Meal
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-white text-sm truncate">{item.label}</h4>

                      <div className="pt-2 border-t border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase block">Predicted Rise</span>
                        <span className="text-xl font-bold font-mono text-white">
                          +{item.prediction.median}{' '}
                          <span className="text-xs font-normal text-slate-400">mg/dL</span>
                        </span>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          80% envelope: [{item.prediction.p10} - {item.prediction.p90}] mg/dL
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};
