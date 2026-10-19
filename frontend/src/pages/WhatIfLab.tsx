import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Footprints,
  HelpCircle,
  Info,
  Scale,
  Sliders,
  Sparkles,
  TrendingDown,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePatient, useTimeline, useWhatIf } from '../api/queries';
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

  // Intervention control states
  const [carbReductionPct, setCarbReductionPct] = useState<number>(25);
  const [postMealWalk, setPostMealWalk] = useState<boolean>(true);

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
            post_meal_walk: postMealWalk,
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
  }, [activePatientId, carbReductionPct, postMealWalk, mealInput]);

  // Construct dual postprandial curves for UncertaintyChart (baseline grey vs intervention teal)
  const curvePoints: CurvePoint[] = React.useMemo(() => {
    if (!whatIfResult || !whatIfResult.baseline) return [];

    const basePeak = whatIfResult.baseline;
    const intervPeak = whatIfResult.intervention;
    const baseG = mealInput.pre_glucose;

    const steps = [
      { t: 0, label: '0 min (Meal)', frac: 0.0 },
      { t: 30, label: '30 min', frac: 0.65 },
      { t: 60, label: '60 min (Peak)', frac: 1.0 },
      { t: 90, label: '90 min', frac: 0.68 },
      { t: 120, label: '120 min', frac: 0.32 },
    ];

    return steps.map((s) => ({
      time_min: s.t,
      time_label: s.label,
      baseline_median: Math.round(baseG + basePeak.median * s.frac),
      baseline_p10: Math.round(baseG + basePeak.p10 * s.frac),
      baseline_p90: Math.round(baseG + basePeak.p90 * s.frac),
      intervention_median: intervPeak ? Math.round(baseG + intervPeak.median * s.frac) : undefined,
      intervention_p10: intervPeak ? Math.round(baseG + intervPeak.p10 * s.frac) : undefined,
      intervention_p90: intervPeak ? Math.round(baseG + intervPeak.p90 * s.frac) : undefined,
    }));
  }, [whatIfResult, mealInput.pre_glucose]);

  if (!activePatientId) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          title="No Active Patient Selected"
          description="Select or create a patient to experiment with lifestyle counterfactuals."
          actionText="Go to Patient Setup"
          onAction={() => (window.location.href = '/patient-setup')}
        />
      </div>
    );
  }

  const isSupported = whatIfResult?.gains?.label === 'supported';
  const medianGain = whatIfResult?.gains?.median_gain ?? 0;
  const pessimisticGain = whatIfResult?.gains?.pessimistic_gain ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Meal Forecast & What-If Simulation Lab</h1>
            <ProvenanceBadge provenance="TWIN_PREDICTED" safetyChecked={true} />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Predict baseline postprandial glycemic excursions and simulate prospective lifestyle modifications (15–20m post-meal walking and carbohydrate swaps) in real-time.
          </p>
        </div>

        {whatIfResult && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 hover:text-teal-300 text-xs font-medium border border-slate-700 transition-colors shadow-sm self-start sm:self-auto"
          >
            <HelpCircle className="w-4 h-4" />
            <span>How was this calculated?</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interventions & Meal Parameters */}
        <div className="lg:col-span-4 space-y-4">
          <SectionCard
            title="Lifestyle Interventions"
            description="Adjust counterfactual levers to simulate predicted glucose reduction"
          >
            <div className="space-y-6">
              {/* 1. Carb Reduction Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-medium text-slate-300 flex items-center space-x-1.5">
                    <Sliders className="w-3.5 h-3.5 text-teal-400" />
                    <span>Carbohydrate Reduction:</span>
                  </label>
                  <span className="font-mono text-teal-400 font-bold text-sm">-{carbReductionPct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={carbReductionPct}
                  onChange={(e) => setCarbReductionPct(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0% (No change)</span>
                  <span>-25%</span>
                  <span>-50% (Max)</span>
                </div>
              </div>

              {/* 2. Post-Meal Walk Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-white flex items-center space-x-1.5">
                    <Footprints className="w-3.5 h-3.5 text-teal-400" />
                    <span>15–20m Post-Meal Walk</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Modulates physical activity feature vector (post_act_60)
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postMealWalk}
                    onChange={(e) => setPostMealWalk(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                </label>
              </div>

              {/* Baseline Meal Reference Details & Preset Picker */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>Meal Excursion Forecast Target:</span>
                  <span className="text-[10px] font-mono text-teal-400">Interactive</span>
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
                    <span>Pre-Meal Glucose (Baseline):</span>
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
                    <span>Energy: {whatIfResult.new_macros.kcal} kcal (4/4/9)</span>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Comparison Cards & Chart */}
        <div className="lg:col-span-8 space-y-6">
          {outOfBoundsError && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{outOfBoundsError}</span>
            </div>
          )}

          {whatIfMutation.isPending && !whatIfResult && (
            <LoadingSkeleton className="h-96 w-full" />
          )}

          {whatIfResult && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${carbReductionPct}-${postMealWalk}`}
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0.8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Decision Summary Card: Supported / Not Supported */}
                <div
                  className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                    isSupported
                      ? 'bg-teal-500/10 border-teal-500/30 text-teal-200'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    {isSupported ? (
                      <div className="p-3 rounded-xl bg-teal-500/20 text-teal-400">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
                        <XCircle className="w-8 h-8" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-lg font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                            isSupported ? 'bg-teal-500/20 text-teal-300' : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {isSupported ? 'Supported' : 'Not Supported'}
                        </span>
                        <div
                          className="relative group cursor-help text-slate-400 hover:text-white"
                          title="Rule: Intervention is supported when the 10th percentile (pessimistic gain) across the 15 bootstrap models is > 0 mg/dL, guaranteeing that at least 90% of model members predict a net glucose reduction."
                        >
                          <HelpCircle className="w-4 h-4" />
                        </div>
                      </div>
                      <p className="text-xs mt-1 text-slate-300 leading-relaxed">
                        {whatIfResult.reason ||
                          (isSupported
                            ? 'Robust benefit: at least 90% of ensemble models predict a significant glucose reduction.'
                            : 'Uncertainty band overlaps baseline: pessimistic gain does not meet the significance threshold.')}
                      </p>
                    </div>
                  </div>

                  {/* Quantitative Gain Metrics */}
                  <div className="flex items-center space-x-4 self-end sm:self-auto border-t sm:border-t-0 sm:border-l border-slate-700/50 pt-3 sm:pt-0 sm:pl-4">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Median Gain
                      </span>
                      <span className="text-xl font-bold font-mono text-white">
                        -{medianGain.toFixed(1)}{' '}
                        <span className="text-xs font-normal text-slate-400">mg/dL</span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Pessimistic Gain (p10)
                      </span>
                      <span
                        className={`text-xl font-bold font-mono ${
                          pessimisticGain > 0 ? 'text-teal-400' : 'text-amber-400'
                        }`}
                      >
                        -{pessimisticGain.toFixed(1)}{' '}
                        <span className="text-xs font-normal text-slate-400">mg/dL</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stat Cards: Baseline vs Intervention */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Baseline Card (Grey) */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-medium text-slate-300">Baseline Meal Prediction</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        Grey Curve
                      </span>
                    </div>
                    <div className="text-2xl font-bold font-mono text-slate-200">
                      +{whatIfResult.baseline.median}{' '}
                      <span className="text-xs font-normal text-slate-400">mg/dL rise</span>
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      80% envelope: [{whatIfResult.baseline.p10} - {whatIfResult.baseline.p90}] mg/dL
                    </div>
                  </div>

                  {/* Intervention Card (Teal) */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-teal-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs text-teal-400">
                      <span className="font-medium text-teal-300">Counterfactual Intervention</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        Teal Curve
                      </span>
                    </div>
                    <div className="text-2xl font-bold font-mono text-white">
                      {whatIfResult.intervention ? (
                        <>
                          +{whatIfResult.intervention.median}{' '}
                          <span className="text-xs font-normal text-slate-400">mg/dL rise</span>
                        </>
                      ) : (
                        <span className="text-sm font-normal text-slate-400">Not computable</span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-teal-400/80">
                      {whatIfResult.intervention
                        ? `80% envelope: [${whatIfResult.intervention.p10} - ${whatIfResult.intervention.p90}] mg/dL`
                        : 'Uncertainty band'}
                    </div>
                  </div>
                </div>

                {/* Dual Trajectory Overlay Chart */}
                <SectionCard
                  title="Counterfactual Trajectory Comparison (Baseline vs Intervention)"
                  description="Grey indicates baseline meal; Teal shows predicted response after carb reduction and post-meal walk"
                >
                  <UncertaintyChart
                    data={curvePoints}
                    height={320}
                    showIntervention={true}
                    baselineLabel="Baseline Meal"
                    interventionLabel="With Lifestyle Intervention"
                    yAxisLabel="Glucose (mg/dL)"
                  />
                </SectionCard>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Calculation Drawer */}
      <CalculationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="What-If Calculation Transparency"
        ensembleSize={15}
        inputs={{
          baseline_carbs: mealInput.carbs_g,
          carb_reduction_pct: carbReductionPct,
          post_meal_walk: postMealWalk,
          new_carbs: whatIfResult?.new_macros?.carbs_g,
          new_kcal: whatIfResult?.new_macros?.kcal,
          pre_glucose: mealInput.pre_glucose,
        }}
        customNotes="What-If evaluation recomputes calorie totals via the strict 4/4/9 kcal/g formula and shifts the post-meal physical activity indicator (post_act_60) before executing the 15-model bootstrap ensemble."
      />
    </div>
  );
};
