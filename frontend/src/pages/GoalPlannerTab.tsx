import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Footprints,
  Layers,
  Plus,
  PlusCircle,
  Scale,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePlanGoal, useApplyGoalPlan } from '../api/queries';
import { GoalPlanOption, PlanGoalResponse } from '../api/types';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';

interface CandidateMealItem {
  id: string;
  name: string;
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  time_of_day: number;
  pre_glucose: number;
}

const DEFAULT_CANDIDATES: CandidateMealItem[] = [
  {
    id: 'm1',
    name: 'Lunch: Chicken Biryani with Raita',
    carbs_g: 75,
    protein_g: 32,
    fat_g: 20,
    time_of_day: 13.0,
    pre_glucose: 115,
  },
  {
    id: 'm2',
    name: 'Dinner: Dal Tadka with Steamed Rice',
    carbs_g: 68,
    protein_g: 24,
    fat_g: 14,
    time_of_day: 20.0,
    pre_glucose: 110,
  },
  {
    id: 'm3',
    name: 'Lunch: Paneer Tikka with Naan & Mint Salad',
    carbs_g: 62,
    protein_g: 28,
    fat_g: 24,
    time_of_day: 13.5,
    pre_glucose: 105,
  },
];

export const GoalPlannerTab: React.FC = () => {
  const { activePatientId } = useApp();
  const planGoalMutation = usePlanGoal();
  const applyGoalMutation = useApplyGoalPlan(activePatientId || 0);

  // Goal & Constraint inputs
  const [targetPeakRise, setTargetPeakRise] = useState<number>(35);
  const [carbCeiling, setCarbCeiling] = useState<number | ''>(65);
  const [foodsToAvoidStr, setFoodsToAvoidStr] = useState<string>('naan, refined sugar');
  const [minPortionPct, setMinPortionPct] = useState<number>(70);
  const [allowTimingShift, setAllowTimingShift] = useState<boolean>(true);
  const [allowWalk, setAllowWalk] = useState<boolean>(true);
  const [allowMealOrder, setAllowMealOrder] = useState<boolean>(true);

  // Candidate Meals list
  const [candidateMeals, setCandidateMeals] = useState<CandidateMealItem[]>(DEFAULT_CANDIDATES);
  const [newMealName, setNewMealName] = useState('');
  const [newMealCarbs, setNewMealCarbs] = useState<number>(55);
  const [newMealProtein, setNewMealProtein] = useState<number>(25);
  const [newMealFat, setNewMealFat] = useState<number>(15);

  // Planner Output State
  const [plannerResult, setPlannerResult] = useState<PlanGoalResponse | null>(null);
  const [appliedPlanIds, setAppliedPlanIds] = useState<string[]>([]);

  const handleAddCandidateMeal = () => {
    if (!newMealName.trim()) return;
    const item: CandidateMealItem = {
      id: `m_${Date.now()}`,
      name: newMealName.trim(),
      carbs_g: newMealCarbs,
      protein_g: newMealProtein,
      fat_g: newMealFat,
      time_of_day: 13.0,
      pre_glucose: 110,
    };
    setCandidateMeals((prev) => [...prev, item]);
    setNewMealName('');
  };

  const handleRemoveCandidateMeal = (id: string) => {
    setCandidateMeals((prev) => prev.filter((m) => m.id !== id));
  };

  const handleGeneratePlans = async () => {
    if (!activePatientId || candidateMeals.length === 0) return;

    const avoidList = foodsToAvoidStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      const res = await planGoalMutation.mutateAsync({
        patient_id: activePatientId,
        target_peak_rise_limit: targetPeakRise,
        candidate_meals: candidateMeals.map((m) => ({
          name: m.name,
          carbs_g: m.carbs_g,
          protein_g: m.protein_g,
          fat_g: m.fat_g,
          calories: m.carbs_g * 4 + m.protein_g * 4 + m.fat_g * 9,
          time_of_day: m.time_of_day,
          pre_glucose: m.pre_glucose,
          pre_trend30: 0.0,
        })),
        carb_ceiling_g: typeof carbCeiling === 'number' ? carbCeiling : null,
        foods_to_avoid: avoidList,
        min_portion_pct: minPortionPct,
        max_portion_pct: 100.0,
        allow_timing_shift: allowTimingShift,
        allow_walk: allowWalk,
        allow_meal_order: allowMealOrder,
        seed: 42,
      });
      setPlannerResult(res);
    } catch (err) {
      console.error('Failed to generate goal plans:', err);
    }
  };

  const handleApplyPlan = async (plan: GoalPlanOption) => {
    try {
      await applyGoalMutation.mutateAsync({
        planId: plan.plan_id,
        tasks: plan.care_plan_tasks,
      });
      setAppliedPlanIds((prev) => [...prev, plan.plan_id]);
    } catch (err) {
      console.error('Failed to add plan to care plan:', err);
    }
  };

  if (!activePatientId) {
    return (
      <EmptyState
        title="No Active Patient Selected"
        description="Select a patient to use the Goal-Based Lifestyle Planner."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-teal-400" />
              <span>Goal-Based Glycemic Lifestyle Planner</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>Safety Governor Enforced</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Specify a target postprandial peak rise limit, candidate meals, and constraints. The twin searches combinations of portion scaling, food sequencing, walk options, and timing to return the top 3 governor-approved plans.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Constraints & Candidate Meals */}
        <div className="lg:col-span-5 space-y-5">
          {/* Goal & Constraints Card */}
          <SectionCard
            title="Glycemic Goal & Constraints"
            description="Configure the target threshold and boundary rules"
          >
            <div className="space-y-4">
              {/* Target Limit */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-teal-400" />
                    <span>Target Peak Rise Limit:</span>
                  </label>
                  <span className="font-mono text-teal-300 font-bold text-sm">
                    &le; {targetPeakRise} mg/dL
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="60"
                  step="1"
                  value={targetPeakRise}
                  onChange={(e) => setTargetPeakRise(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-900 rounded appearance-none cursor-pointer accent-teal-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>20 mg/dL (Aggressive)</span>
                  <span>35 mg/dL (Standard)</span>
                  <span>60 mg/dL</span>
                </div>
              </div>

              {/* Carb Ceiling & Min Portion */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Max Carbs / Meal (g):</label>
                  <input
                    type="number"
                    min="20"
                    max="120"
                    value={carbCeiling}
                    onChange={(e) => setCarbCeiling(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    placeholder="e.g. 60"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Min Portion Allowed:</label>
                  <select
                    value={minPortionPct}
                    onChange={(e) => setMinPortionPct(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                  >
                    <option value={70}>70% (Hypo-safe R4)</option>
                    <option value={85}>85% (Mild Cut)</option>
                    <option value={50}>50% (Max Cut)</option>
                  </select>
                </div>
              </div>

              {/* Foods to Avoid */}
              <div className="text-xs">
                <label className="text-slate-400 block mb-1">Foods to Avoid (comma-separated):</label>
                <input
                  type="text"
                  value={foodsToAvoidStr}
                  onChange={(e) => setFoodsToAvoidStr(e.target.value)}
                  placeholder="e.g. naan, potatoes, white rice"
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Allowed Levers Toggles */}
              <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Allowed Action Levers:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowMealOrder}
                      onChange={(e) => setAllowMealOrder(e.target.checked)}
                      className="rounded text-teal-500 bg-slate-950 border-slate-700"
                    />
                    <span className="text-[11px] text-slate-300">Food Order</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowWalk}
                      onChange={(e) => setAllowWalk(e.target.checked)}
                      className="rounded text-teal-500 bg-slate-950 border-slate-700"
                    />
                    <span className="text-[11px] text-slate-300">Walk Options</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowTimingShift}
                      onChange={(e) => setAllowTimingShift(e.target.checked)}
                      className="rounded text-teal-500 bg-slate-950 border-slate-700"
                    />
                    <span className="text-[11px] text-slate-300">Timing Shift</span>
                  </label>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Candidate Meals Card */}
          <SectionCard
            title="Candidate Meals"
            description="Meals to be optimized in the combinatorial search"
          >
            <div className="space-y-3">
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {candidateMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{meal.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {meal.carbs_g}g C • {meal.protein_g}g P • {meal.fat_g}g F
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveCandidateMeal(meal.id)}
                      className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add custom candidate meal row */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <input
                  type="text"
                  value={newMealName}
                  onChange={(e) => setNewMealName(e.target.value)}
                  placeholder="Meal description (e.g. Roti with Paneer Curry)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                />

                <div className="flex items-center justify-between gap-2">
                  <div className="grid grid-cols-3 gap-1.5 text-xs flex-1">
                    <input
                      type="number"
                      placeholder="Carbs"
                      value={newMealCarbs}
                      onChange={(e) => setNewMealCarbs(parseInt(e.target.value, 10) || 0)}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white text-center font-mono"
                    />
                    <input
                      type="number"
                      placeholder="Pro"
                      value={newMealProtein}
                      onChange={(e) => setNewMealProtein(parseInt(e.target.value, 10) || 0)}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white text-center font-mono"
                    />
                    <input
                      type="number"
                      placeholder="Fat"
                      value={newMealFat}
                      onChange={(e) => setNewMealFat(parseInt(e.target.value, 10) || 0)}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white text-center font-mono"
                    />
                  </div>

                  <button
                    onClick={handleAddCandidateMeal}
                    disabled={!newMealName.trim()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Run Planner Button */}
              <div className="pt-3">
                <button
                  onClick={handleGeneratePlans}
                  disabled={candidateMeals.length === 0 || planGoalMutation.isPending}
                  className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Compass className="w-4 h-4" />
                  <span>
                    {planGoalMutation.isPending
                      ? 'Simulating Combinations Across Twin...'
                      : 'Generate Top 3 Goal Plans'}
                  </span>
                </button>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Top 3 Goal Plan Cards */}
        <div className="lg:col-span-7 space-y-5">
          {planGoalMutation.isPending && (
            <div className="space-y-4">
              <LoadingSkeleton height="140px" />
              <LoadingSkeleton height="140px" />
              <LoadingSkeleton height="140px" />
            </div>
          )}

          {!planGoalMutation.isPending && !plannerResult && (
            <div className="p-8 rounded-2xl bg-[#111C30] border border-slate-800 text-center space-y-3">
              <Compass className="w-10 h-10 text-teal-400/80 mx-auto" />
              <h3 className="text-base font-bold text-white">Combinatorial Goal Search Ready</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Click <strong>"Generate Top 3 Goal Plans"</strong> to evaluate lifestyle combinations across the twin ensemble. The planner will generate 3 distinct strategies (Lifestyle-First, Balanced, and Tight Control) vetted by the Safety Governor.
              </p>
            </div>
          )}

          {plannerResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Returned {plannerResult.plans.length} governor-approved strategy options:</span>
                <span className="font-mono text-teal-400 text-[11px]">Seed: {plannerResult.seed}</span>
              </div>

              {plannerResult.plans.map((plan, idx) => {
                const isApplied = appliedPlanIds.includes(plan.plan_id);

                return (
                  <motion.div
                    key={plan.plan_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-5 rounded-2xl bg-[#111C30] border border-slate-800 hover:border-slate-700 transition-all space-y-4 shadow-sm"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white">{plan.title}</h4>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                              plan.strategy_type === 'lifestyle_first'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : plan.strategy_type === 'balanced'
                                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                                : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {plan.strategy_type.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                          <span>Predicted Peak Rise:</span>
                          <span className="font-mono text-teal-300 font-bold text-sm">
                            +{plan.predicted_peak.median} mg/dL
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            (80% envelope: [{plan.predicted_peak.p10} - {plan.predicted_peak.p90}])
                          </span>
                        </div>
                      </div>

                      {/* Goal Met Badge */}
                      <div className="text-right flex-shrink-0">
                        {plan.goal_met ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Goal Met (&le; {plan.target_peak_rise_limit})</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>Close to Target</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Planned Meals Details */}
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2 text-xs">
                      <div className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">
                        Optimized Meal & Action Actions:
                      </div>

                      {plan.meals.map((m, mIdx) => (
                        <div key={mIdx} className="space-y-1.5">
                          <div className="font-bold text-slate-200">{m.meal_name}</div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-slate-300 pt-1">
                            <div className="p-2 rounded bg-slate-950 border border-slate-800">
                              <span className="text-[10px] text-slate-400 block">Portion Scale</span>
                              <span className="text-teal-300 font-bold">{m.portion_pct}%</span> ({m.scaled_carbs}g C)
                            </div>
                            <div className="p-2 rounded bg-slate-950 border border-slate-800">
                              <span className="text-[10px] text-slate-400 block">Food Sequence</span>
                              <span className="text-slate-200">{m.meal_order_label}</span>
                            </div>
                            <div className="p-2 rounded bg-slate-950 border border-slate-800">
                              <span className="text-[10px] text-slate-400 block">Post-Meal Walk</span>
                              <span className="text-emerald-300">{m.walk_option}</span>
                            </div>
                            <div className="p-2 rounded bg-slate-950 border border-slate-800">
                              <span className="text-[10px] text-slate-400 block">Timing Shift</span>
                              <span className="text-sky-300">
                                {m.timing_shift_hours === 0 ? 'Original Time' : `${m.timing_shift_hours > 0 ? `+${m.timing_shift_hours}h` : `${m.timing_shift_hours}h`}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tradeoffs List */}
                    <div className="space-y-1 text-xs">
                      <div className="text-slate-400 font-semibold text-[11px]">Tradeoffs & Requirements:</div>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[11px]">
                        {plan.tradeoffs.map((to, toIdx) => (
                          <li key={toIdx}>{to}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Footer: Governor Audit Stamp & Action Button */}
                    <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                        <ShieldCheck className="w-4 h-4 text-teal-400" />
                        <span>
                          Governor Audited:{' '}
                          <span className="font-mono text-teal-300">
                            {plan.governor_trace.rules_triggered.join(', ')}
                          </span>
                        </span>
                      </div>

                      <button
                        onClick={() => handleApplyPlan(plan)}
                        disabled={isApplied || applyGoalMutation.isPending}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed ${
                          isApplied
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-sm'
                        }`}
                      >
                        {isApplied ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Added to My Plan</span>
                          </>
                        ) : (
                          <>
                            <PlusCircle className="w-4 h-4" />
                            <span>
                              {applyGoalMutation.isPending ? 'Adding Tasks...' : 'Add to my plan'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
