import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookmarkPlus,
  CheckCircle2,
  Clock,
  Footprints,
  HelpCircle,
  Info,
  Layers,
  Scale,
  Sliders,
  Sparkles,
  TrendingDown,
  Utensils,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePatient, useTimeline, useWhatIf, useCreateSavedScenario } from '../api/queries';
import { PredictMealInput, WhatIfResponse } from '../api/types';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { UncertaintyChart, CurvePoint } from '../components/UncertaintyChart';
import { CalculationDrawer } from '../components/CalculationDrawer';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';

export const WhatIfLabPage: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: patient } = usePatient(activePatientId);
  const { data: timeline } = useTimeline(activePatientId);
  const whatIfMutation = useWhatIf(activePatientId || 0);
  const createScenarioMutation = useCreateSavedScenario(activePatientId || 0);

  // Intervention control states
  const [carbReductionPct, setCarbReductionPct] = useState<number>(20);
  const [mealOrder, setMealOrder] = useState<'standard' | 'veggies_first' | 'protein_first' | 'veggies_protein_first'>('standard');
  const [walkDurationMin, setWalkDurationMin] = useState<number>(20);
  const [walkIntensity, setWalkIntensity] = useState<'none' | 'light' | 'moderate' | 'brisk'>('moderate');
  const [timingShiftHours, setTimingShiftHours] = useState<number>(0);

  // Save Scenario Modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDesc, setScenarioDesc] = useState('');

  // Estimated Adjustment Disclosure state
  const [showAdjustmentsModal, setShowAdjustmentsModal] = useState(false);

  // Meal input state (prefilled from last meal or standard baseline)
  const [mealInput, setMealInput] = useState<PredictMealInput>({
    carbs_g: 65,
    protein_g: 26,
    fat_g: 18,
    fibre_g: 6,
    calories: 65 * 4 + 26 * 4 + 18 * 9,
    time_of_day: 13.0,
    meal_type: 'lunch',
    pre_glucose: 110,
    pre_trend30: 0.0,
  });

  const [hasPrefilled, setHasPrefilled] = useState(false);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [outOfBoundsError, setOutOfBoundsError] = useState<string | null>(null);

  // Prefill from last recorded meal in timeline if available
  useEffect(() => {
    if (timeline && timeline.events.length > 0 && !hasPrefilled) {
      const mealEvents = timeline.events.filter((e) => e.type === 'meal');
      if (mealEvents.length > 0) {
        const lastMeal = mealEvents[mealEvents.length - 1].data;
        setMealInput({
          carbs_g: lastMeal.carbs_g ?? 60,
          protein_g: lastMeal.protein_g ?? 24,
          fat_g: lastMeal.fat_g ?? 16,
          fibre_g: lastMeal.fibre_g ?? 5,
          calories: lastMeal.calories ?? 60 * 4 + 24 * 4 + 16 * 9,
          time_of_day: 13.0,
          meal_type: 'lunch',
          pre_glucose: lastMeal.pre_glucose ?? 105,
          pre_trend30: lastMeal.pre_trend30 ?? 0.0,
        });
        setHasPrefilled(true);
      }
    }
  }, [timeline, hasPrefilled]);

  // Debounced execution of /whatif (400ms)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activePatientId) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setOutOfBoundsError(null);
      try {
        const res = await whatIfMutation.mutateAsync({
          meal: mealInput,
          interventions: {
            carb_reduction_pct: carbReductionPct,
            post_meal_walk: walkDurationMin > 0 && walkIntensity !== 'none',
            meal_order: mealOrder,
            walk_duration_min: walkDurationMin,
            walk_intensity: walkIntensity,
            timing_shift_hours: timingShiftHours,
            margin: 0.0,
          },
        });
        setWhatIfResult(res);
      } catch (err: any) {
        if (err?.code === 'OUT_OF_RANGE') {
          setOutOfBoundsError(err.message || 'Inputs are outside allowable distribution bounds.');
          setWhatIfResult(null);
        }
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [
    activePatientId,
    carbReductionPct,
    mealOrder,
    walkDurationMin,
    walkIntensity,
    timingShiftHours,
    mealInput,
  ]);

  // Construct dual postprandial curves for UncertaintyChart (baseline grey vs intervention teal)
  const chartCurves: CurvePoint[] = React.useMemo(() => {
    if (!whatIfResult || !whatIfResult.baseline) return [];

    const basePeak = whatIfResult.baseline;
    const intervPeak = whatIfResult.intervention;
    const preG = mealInput.pre_glucose;

    const times = [0, 15, 30, 45, 60, 75, 90, 120, 150, 180];

    return times.map((t) => {
      // Shape Gaussian-like postprandial profile peaking at ~60-75 min
      const shape = Math.exp(-Math.pow(t - 65, 2) / (2 * Math.pow(38, 2)));

      return {
        time_min: t,
        time_label: `+${t}m`,
        baseline_median: Math.round(preG + basePeak.median * shape),
        baseline_p10: Math.round(preG + basePeak.p10 * shape),
        baseline_p90: Math.round(preG + basePeak.p90 * shape),
        intervention_median: intervPeak ? Math.round(preG + intervPeak.median * shape) : undefined,
        intervention_p10: intervPeak ? Math.round(preG + intervPeak.p10 * shape) : undefined,
        intervention_p90: intervPeak ? Math.round(preG + intervPeak.p90 * shape) : undefined,
      };
    });
  }, [whatIfResult, mealInput.pre_glucose]);

  const handleSaveScenario = async () => {
    if (!scenarioName.trim() || !whatIfResult) return;
    await createScenarioMutation.mutateAsync({
      name: scenarioName.trim(),
      description: scenarioDesc.trim() || null,
      inputs: {
        meal: mealInput,
        interventions: {
          carb_reduction_pct: carbReductionPct,
          meal_order: mealOrder,
          walk_duration_min: walkDurationMin,
          walk_intensity: walkIntensity,
          timing_shift_hours: timingShiftHours,
        },
      },
      baseline_output: whatIfResult.baseline,
      intervention_output: whatIfResult.intervention || null,
    });
    setSaveModalOpen(false);
    setScenarioName('');
    setScenarioDesc('');
  };

  if (!activePatientId) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          title="No Active Patient Selected"
          description="Select or create a patient to experiment with lifestyle interventions."
          actionText="Go to Patient Setup"
          onAction={() => (window.location.href = '/patient-setup')}
        />
      </div>
    );
  }

  const isSupported = whatIfResult?.gains?.label === 'supported';
  const medianGain = whatIfResult?.gains?.median_gain ?? 0;
  const pessimisticGain = whatIfResult?.gains?.pessimistic_gain ?? 0;
  const adjustments = whatIfResult?.adjustments || [];
  const isEstimated = Boolean(whatIfResult?.is_estimated_adjustment);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">What-If Simulation Lab</h1>
            <ProvenanceBadge provenance="TWIN_PREDICTED" safetyChecked={true} />
            {isEstimated && (
              <button
                onClick={() => setShowAdjustmentsModal(true)}
                className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-amber-500/25 transition-all cursor-pointer"
                title="Non-native levers evaluated via bounded physiological adjustments"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Estimated Adjustment</span>
              </button>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Simulate prospective meal interventions in real-time: food sequencing, walk intensity & duration, timing shifts, and carbohydrate scaling.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {whatIfResult && (
            <button
              onClick={() => setSaveModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>Save Scenario</span>
            </button>
          )}

          {whatIfResult && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 hover:text-teal-300 text-xs font-medium border border-slate-700 transition-colors shadow-sm cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              <span>How was this calculated?</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interventions & Meal Parameters */}
        <div className="lg:col-span-5 space-y-4">
          <SectionCard
            title="What-If Intervention Levers"
            description="Adjust lifestyle parameters to simulate prospective glycemic response"
          >
            <div className="space-y-5">
              {/* 1. Carb Reduction Slider */}
              <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-200 flex items-center space-x-1.5">
                    <Sliders className="w-3.5 h-3.5 text-teal-400" />
                    <span>Carbohydrate Scaling:</span>
                  </label>
                  <span className="font-mono text-teal-400 font-bold text-sm">
                    {carbReductionPct > 0 ? `-${carbReductionPct}%` : '100% (No cut)'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={carbReductionPct}
                  onChange={(e) => setCarbReductionPct(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0%</span>
                  <span>-25%</span>
                  <span>-50% (Max)</span>
                </div>
              </div>

              {/* 2. Meal Order / Food Sequencing */}
              <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-200 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-400" />
                    <span>Meal Order (Food Sequencing):</span>
                  </label>
                  {mealOrder !== 'standard' && (
                    <span className="text-[10px] text-amber-300 font-medium px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                      Estimated
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { id: 'standard', label: 'Standard (All together)', sub: 'Default' },
                    { id: 'veggies_first', label: 'Veggies First', sub: '-18% spike' },
                    { id: 'protein_first', label: 'Protein First', sub: '-12% spike' },
                    { id: 'veggies_protein_first', label: 'Veggies + Protein First', sub: '-24% spike' },
                  ].map((ord) => (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => setMealOrder(ord.id as any)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        mealOrder === ord.id
                          ? 'bg-teal-500/20 border-teal-500 text-teal-200 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-medium text-[11px] leading-tight">{ord.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{ord.sub}</div>
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Pre-meal vegetables/protein slow gastric emptying via GLP-1, flattening postprandial glucose absorption (Shukla et al.).
                </div>
              </div>

              {/* 3. Walk Intensity & Duration */}
              <div className="space-y-2.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-200 flex items-center space-x-1.5">
                    <Footprints className="w-3.5 h-3.5 text-teal-400" />
                    <span>Post-Meal Physical Activity:</span>
                  </label>
                  <span className="font-mono text-teal-400 font-bold text-xs">
                    {walkDurationMin === 0 || walkIntensity === 'none'
                      ? 'No walk'
                      : `${walkDurationMin} min (${walkIntensity})`}
                  </span>
                </div>

                {/* Intensity selector */}
                <div className="grid grid-cols-4 gap-1 text-[11px]">
                  {(['none', 'light', 'moderate', 'brisk'] as const).map((intensity) => (
                    <button
                      key={intensity}
                      type="button"
                      onClick={() => {
                        setWalkIntensity(intensity);
                        if (intensity === 'none') setWalkDurationMin(0);
                        else if (walkDurationMin === 0) setWalkDurationMin(20);
                      }}
                      className={`py-1.5 px-1 rounded-lg border text-center capitalize transition-all cursor-pointer ${
                        walkIntensity === intensity
                          ? 'bg-teal-500 text-slate-950 font-bold border-teal-500'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {intensity}
                    </button>
                  ))}
                </div>

                {/* Duration Slider (if not none) */}
                {walkIntensity !== 'none' && (
                  <div className="pt-1 space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Walk Duration:</span>
                      <span className="font-mono text-teal-300 font-semibold">{walkDurationMin} minutes</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={walkDurationMin}
                      onChange={(e) => setWalkDurationMin(parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-slate-950 rounded appearance-none cursor-pointer accent-teal-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>5m</span>
                      <span>20m</span>
                      <span>40m</span>
                      <span>60m</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Meal Timing Shift */}
              <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-200 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-400" />
                    <span>Meal Timing Shift:</span>
                  </label>
                  <span className="font-mono text-teal-400 font-bold text-xs">
                    {timingShiftHours === 0
                      ? 'No shift (Original hour)'
                      : `${timingShiftHours > 0 ? `+${timingShiftHours}h later` : `${timingShiftHours}h earlier`}`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-4"
                  max="4"
                  step="0.5"
                  value={timingShiftHours}
                  onChange={(e) => setTimingShiftHours(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-950 rounded appearance-none cursor-pointer accent-teal-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>-4.0h (Earlier)</span>
                  <span>0.0h</span>
                  <span>+4.0h (Later)</span>
                </div>
              </div>

              {/* Baseline Meal Reference Details & Preset Picker */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>Baseline Meal Features:</span>
                  <span className="text-[10px] font-mono text-teal-400">15-Model Input</span>
                </div>

                {/* Preset Meal Buttons */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Quick Meal Presets:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {[
                      { label: 'Standard Lunch', carbs: 65, pro: 26, fat: 18, fibre: 6, preG: 110 },
                      { label: 'Pasta Bolognese', carbs: 88, pro: 24, fat: 22, fibre: 4, preG: 105 },
                      { label: 'Chicken Quinoa', carbs: 40, pro: 32, fat: 14, fibre: 7, preG: 100 },
                      { label: 'Low-Carb Salad', carbs: 18, pro: 28, fat: 16, fibre: 6, preG: 95 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setMealInput((prev) => ({
                            ...prev,
                            carbs_g: preset.carbs,
                            protein_g: preset.pro,
                            fat_g: preset.fat,
                            fibre_g: preset.fibre,
                            pre_glucose: preset.preG,
                            calories: preset.carbs * 4 + preset.pro * 4 + preset.fat * 9,
                          }))
                        }
                        className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                          mealInput.carbs_g === preset.carbs && mealInput.protein_g === preset.pro
                            ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="block truncate font-medium">{preset.label}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">{preset.carbs}g C • {preset.preG}mg/dL</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Macro Inputs */}
                <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                  <div>
                    <label className="text-slate-400 block text-[10px] mb-1">Carbs (g):</label>
                    <input
                      type="number"
                      min={5}
                      max={150}
                      value={mealInput.carbs_g}
                      onChange={(e) => {
                        const val = Math.max(5, Math.min(150, parseInt(e.target.value) || 0));
                        setMealInput((prev) => ({
                          ...prev,
                          carbs_g: val,
                          calories: val * 4 + prev.protein_g * 4 + prev.fat_g * 9,
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono text-center text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[10px] mb-1">Protein (g):</label>
                    <input
                      type="number"
                      min={5}
                      max={80}
                      value={mealInput.protein_g}
                      onChange={(e) => {
                        const val = Math.max(5, Math.min(80, parseInt(e.target.value) || 0));
                        setMealInput((prev) => ({
                          ...prev,
                          protein_g: val,
                          calories: prev.carbs_g * 4 + val * 4 + prev.fat_g * 9,
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono text-center text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[10px] mb-1">Fat (g):</label>
                    <input
                      type="number"
                      min={2}
                      max={60}
                      value={mealInput.fat_g}
                      onChange={(e) => {
                        const val = Math.max(2, Math.min(60, parseInt(e.target.value) || 0));
                        setMealInput((prev) => ({
                          ...prev,
                          fat_g: val,
                          calories: prev.carbs_g * 4 + prev.protein_g * 4 + val * 9,
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono text-center text-xs"
                    />
                  </div>
                </div>

                {/* Pre-Meal Glucose input */}
                <div className="pt-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                    <span>Pre-Meal Baseline Glucose:</span>
                    <span className="font-mono text-teal-300 font-bold">{mealInput.pre_glucose} mg/dL</span>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="180"
                    step="1"
                    value={mealInput.pre_glucose}
                    onChange={(e) =>
                      setMealInput((prev) => ({
                        ...prev,
                        pre_glucose: parseInt(e.target.value, 10),
                      }))
                    }
                    className="w-full h-1.5 bg-slate-900 rounded appearance-none cursor-pointer accent-teal-500"
                  />
                </div>

                {whatIfResult?.new_macros && (
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-teal-400/90 font-mono flex justify-between">
                    <span>Simulated Carbs: {whatIfResult.new_macros.carbs_g}g</span>
                    <span>Energy: {whatIfResult.new_macros.kcal} kcal</span>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Comparison Cards & Chart */}
        <div className="lg:col-span-7 space-y-6">
          {outOfBoundsError && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{outOfBoundsError}</span>
            </div>
          )}

          {/* Active Adjustments Badge Bar */}
          {isEstimated && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs text-amber-200">
                <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>
                  <strong>Estimated adjustments active:</strong> Food sequencing or extended activity levers are modeled via bounded clinical literature factors.
                </span>
              </div>
              <button
                onClick={() => setShowAdjustmentsModal(true)}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 ml-2 flex-shrink-0 cursor-pointer"
              >
                View Details ({adjustments.length})
              </button>
            </div>
          )}

          {/* Stat Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Baseline Peak Rise"
              value={whatIfResult ? `+${whatIfResult.baseline.median}` : '...'}
              subValue="mg/dL"
              trendText={whatIfResult ? `Envelope: [${whatIfResult.baseline.p10} - ${whatIfResult.baseline.p90}]` : ''}
              className="border-slate-800"
            />

            <StatCard
              label="Simulated Intervention"
              value={whatIfResult?.intervention ? `+${whatIfResult.intervention.median}` : '...'}
              subValue="mg/dL"
              trendText={
                whatIfResult?.intervention
                  ? `Envelope: [${whatIfResult.intervention.p10} - ${whatIfResult.intervention.p90}]`
                  : 'Adjust levers'
              }
              badge={
                whatIfResult?.intervention ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    Intervention
                  </span>
                ) : null
              }
              className="border-teal-500/30 bg-teal-950/10"
            />

            <StatCard
              label="Projected Glucose Reduction"
              value={whatIfResult?.gains ? `${medianGain > 0 ? '-' : ''}${Math.abs(medianGain)}` : '...'}
              subValue="mg/dL"
              trend={isSupported ? 'up' : 'neutral'}
              trendText={
                whatIfResult?.gains
                  ? isSupported
                    ? 'Clinically supported improvement'
                    : 'Modest / inconclusive change'
                  : ''
              }
              icon={isSupported ? CheckCircle2 : Scale}
              className={isSupported ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-slate-800'}
            />
          </div>

          {/* Uncertainty Curve Comparison Chart */}
          <SectionCard
            title="3-Hour Glycemic Trajectory (Baseline vs Intervention)"
            description="Compare expected glucose response before and after lifestyle adjustments"
          >
            {whatIfMutation.isPending && !whatIfResult && <LoadingSkeleton height="320px" />}

            {whatIfResult && (
              <div className="space-y-4">
                <div className="h-80 w-full">
                  <UncertaintyChart
                    data={chartCurves}
                    showIntervention={true}
                    height={320}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800 gap-2">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3 h-0.5 bg-slate-400"></div>
                      <span>Baseline Curve</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3 h-0.5 bg-teal-400"></div>
                      <span>Intervention Curve</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Shaded bands represent 80% confidence interval.
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Save Scenario Modal */}
      <AnimatePresence>
        {saveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookmarkPlus className="w-5 h-5 text-teal-400" />
                  <span>Save Simulation Scenario</span>
                </h3>
                <button
                  onClick={() => setSaveModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Save the current inputs and simulation outputs for future reference or side-by-side comparison.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Scenario Name *</label>
                  <input
                    type="text"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="e.g. 20m Moderate Walk + Veggies First"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Notes / Description (Optional)</label>
                  <textarea
                    value={scenarioDesc}
                    onChange={(e) => setScenarioDesc(e.target.value)}
                    placeholder="Add rationale, meal context, or clinician instructions..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-teal-500 resize-none"
                  />
                </div>

                {whatIfResult && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1 font-mono text-[11px] text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Baseline Peak Rise:</span>
                      <span>+{whatIfResult.baseline.median} mg/dL</span>
                    </div>
                    <div className="flex justify-between text-teal-300">
                      <span>Intervention Peak:</span>
                      <span>+{whatIfResult.intervention?.median ?? 'N/A'} mg/dL</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Gain:</span>
                      <span>{whatIfResult.gains?.median_gain} mg/dL</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!scenarioName.trim() || createScenarioMutation.isPending}
                  onClick={handleSaveScenario}
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
                >
                  {createScenarioMutation.isPending ? 'Saving...' : 'Save Scenario'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Estimated Adjustments Disclosure Modal */}
      <AnimatePresence>
        {showAdjustmentsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>Documented Estimated Adjustments</span>
                </h3>
                <button
                  onClick={() => setShowAdjustmentsModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                GlucoTwin applies evidence-based clinical adjustments to model behavioral and lifestyle interventions (such as post-meal walks, meal sequencing, and sleep optimization) on your postprandial glucose trajectory.
              </p>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {adjustments.map((adj, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/20 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-amber-300">{adj.name}</span>
                      <span className="font-mono text-xs font-bold text-teal-400">
                        {adj.adjustment_pct > 0 ? `+${adj.adjustment_pct}%` : `${adj.adjustment_pct}%`}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">{adj.description}</p>

                    {adj.citation && (
                      <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-900">
                        <strong>Source:</strong> {adj.citation}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowAdjustmentsModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* How Was This Calculated Drawer */}
      <CalculationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        inputs={{
          base_rise: whatIfResult?.baseline?.median,
          interv_rise: whatIfResult?.intervention?.median,
          median_gain: medianGain,
          pessimistic_gain: pessimisticGain,
          label: whatIfResult?.gains?.label,
          carb_cut: carbReductionPct,
          walk_duration: walkDurationMin,
          walk_intensity: walkIntensity,
          meal_order: mealOrder,
          timing_shift: timingShiftHours,
          new_carbs: whatIfResult?.new_macros?.carbs_g,
          new_kcal: whatIfResult?.new_macros?.kcal,
          is_estimated_adjustment: isEstimated,
        }}
        customNotes={isEstimated ? 'Includes documented post-hoc adjustments for non-native levers.' : undefined}
      />
    </div>
  );
};
