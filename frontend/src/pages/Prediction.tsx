import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calculator,
  ChevronRight,
  Clock,
  HelpCircle,
  Info,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePredictMeal, usePatient } from '../api/queries';
import { PredictResponse, PredictMealInput } from '../api/types';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { ConfidenceRing } from '../components/ConfidenceRing';
import { UncertaintyChart, CurvePoint } from '../components/UncertaintyChart';
import { CalculationDrawer } from '../components/CalculationDrawer';
import { StatCard, SectionCard, EmptyState, LoadingSkeleton } from '../components/Cards';

export const PredictionPage: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: patient, isLoading: loadingPatient } = usePatient(activePatientId);
  const predictMutation = usePredictMeal(activePatientId || 0);

  // Form state prefilled with standard lunch meal
  const [formData, setFormData] = useState<PredictMealInput>({
    carbs_g: 50,
    protein_g: 22,
    fat_g: 14,
    fibre_g: 5,
    calories: 50 * 4 + 22 * 4 + 14 * 9,
    time_of_day: 12.5,
    meal_type: 'lunch',
    pre_glucose: 105,
    pre_trend30: 0.0,
  });

  const [predictionResult, setPredictionResult] = useState<PredictResponse | null>(null);
  const [outOfRangeError, setOutOfRangeError] = useState<{
    code?: string;
    message?: string;
    out_of_bounds?: Record<string, { value: number; min: number; max: number }>;
  } | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto calculate calories on macro change
  const handleMacroChange = (field: keyof PredictMealInput, value: number) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      const c = field === 'carbs_g' ? value : prev.carbs_g;
      const p = field === 'protein_g' ? value : prev.protein_g;
      const f = field === 'fat_g' ? value : prev.fat_g;
      updated.calories = Math.round(c * 4 + p * 4 + f * 9);
      return updated;
    });
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatientId) return;

    setOutOfRangeError(null);
    try {
      const res = await predictMutation.mutateAsync(formData);
      setPredictionResult(res);
    } catch (err: any) {
      if (err?.code === 'OUT_OF_RANGE' || err?.details?.out_of_bounds) {
        setOutOfRangeError({
          code: err.code || 'OUT_OF_RANGE',
          message: err.message || 'Inputs are outside empirical training bounds.',
          out_of_bounds: err.details?.out_of_bounds || {},
        });
        setPredictionResult(null);
      }
    }
  };

  if (!activePatientId) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          title="No Active Patient Selected"
          description="Select or create a patient from the top bar before simulating twin predictions."
          actionText="Open Patient Setup"
          onAction={() => (window.location.href = '/patient-setup')}
        />
      </div>
    );
  }

  // Generate curve data points for UncertaintyChart based on prediction
  const curvePoints: CurvePoint[] = React.useMemo(() => {
    if (!predictionResult?.targets?.peak_rise) return [];
    const peak = predictionResult.targets.peak_rise;
    const baseG = formData.pre_glucose;

    // Build realistic postprandial curve across 120 minutes
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
      baseline_median: Math.round(baseG + peak.median * s.frac),
      baseline_p10: Math.round(baseG + peak.p10 * s.frac),
      baseline_p90: Math.round(baseG + peak.p90 * s.frac),
    }));
  }, [predictionResult, formData.pre_glucose]);

  const peak = predictionResult?.targets?.peak_rise;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Metabolic Twin Prediction</h1>
            <ProvenanceBadge provenance="TWIN_PREDICTED" safetyChecked={true} />
            {predictionResult && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  predictionResult.baseline_used
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                }`}
              >
                {predictionResult.baseline_used ? 'Population baseline' : 'Personalised'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Forecast postprandial glucose response based on meal composition and personalized metabolic history.
          </p>
        </div>

        {predictionResult && (
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
        {/* Left Column: Meal Form */}
        <div className="lg:col-span-4">
          <SectionCard
            title="Candidate Meal Inputs"
            description="Configure nutrient composition and prandial context"
            className="sticky top-20"
          >
            <form onSubmit={handlePredict} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Carbohydrates (g) <span className="text-teal-400 font-mono">4 kcal/g</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  step="1"
                  required
                  value={formData.carbs_g}
                  onChange={(e) => handleMacroChange('carbs_g', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Protein (g)</label>
                  <input
                    type="number"
                    min="0"
                    max="150"
                    step="1"
                    required
                    value={formData.protein_g}
                    onChange={(e) => handleMacroChange('protein_g', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Fat (g)</label>
                  <input
                    type="number"
                    min="0"
                    max="150"
                    step="1"
                    required
                    value={formData.fat_g}
                    onChange={(e) => handleMacroChange('fat_g', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Dietary Fibre (g)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="1"
                    value={formData.fibre_g || 0}
                    onChange={(e) => setFormData((p) => ({ ...p, fibre_g: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Energy (kcal)</label>
                  <input
                    type="number"
                    readOnly
                    value={formData.calories || 0}
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-300 font-mono text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Pre-Glucose (mg/dL)</label>
                  <input
                    type="number"
                    min="50"
                    max="350"
                    step="1"
                    required
                    value={formData.pre_glucose}
                    onChange={(e) => setFormData((p) => ({ ...p, pre_glucose: parseFloat(e.target.value) || 100 }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Pre-Trend 30m (mg/dL)</label>
                  <input
                    type="number"
                    min="-60"
                    max="60"
                    step="0.5"
                    value={formData.pre_trend30}
                    onChange={(e) => setFormData((p) => ({ ...p, pre_trend30: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Time of Day (0–24h)</label>
                  <input
                    type="number"
                    min="0"
                    max="23.9"
                    step="0.5"
                    value={formData.time_of_day}
                    onChange={(e) => setFormData((p) => ({ ...p, time_of_day: parseFloat(e.target.value) || 12 }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Meal Type</label>
                  <select
                    value={formData.meal_type}
                    onChange={(e) => setFormData((p) => ({ ...p, meal_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={predictMutation.isPending}
                className="w-full mt-4 flex items-center justify-center space-x-2 py-2.5 px-4 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 disabled:opacity-50 text-slate-950 font-semibold rounded-lg shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
              >
                {predictMutation.isPending ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin" />
                    <span>Simulating Response...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run Twin Prediction</span>
                  </>
                )}
              </button>
            </form>
          </SectionCard>
        </div>

        {/* Right Column: Prediction Results & Charts */}
        <div className="lg:col-span-8 space-y-6">
          {/* Out of Range Guard Warning Card */}
          {outOfRangeError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3"
            >
              <div className="flex items-center space-x-3 text-amber-400">
                <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-white">Meal Inputs Exceed Standard Range</h3>
                  <p className="text-xs text-amber-300/90 mt-0.5">
                    {outOfRangeError.message} To preserve clinical safety, forecasts are withheld for inputs beyond safe validation bounds.
                  </p>
                </div>
              </div>

              {outOfRangeError.out_of_bounds && Object.keys(outOfRangeError.out_of_bounds).length > 0 && (
                <div className="mt-3 bg-slate-900/80 rounded-lg p-3 border border-amber-500/20 text-xs">
                  <div className="font-medium text-slate-300 mb-2">Offending Features:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(outOfRangeError.out_of_bounds).map(([feat, detail]) => (
                      <div key={feat} className="p-2 rounded bg-slate-950/70 border border-slate-800 flex justify-between">
                        <span className="font-mono text-amber-400">{feat}</span>
                        <span className="text-slate-400">
                          val: <strong className="text-white">{detail.value}</strong> [
                          {detail.min} - {detail.max}]
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Initial Blank State */}
          {!predictionResult && !outOfRangeError && !predictMutation.isPending && (
            <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-4">
              <Calculator className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-white">Ready to Predict Prandial Excursion</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Adjust candidate meal macros on the left and click "Run Twin Prediction" to simulate the expected post-meal glucose curve.
                </p>
              </div>
            </div>
          )}

          {/* Active Prediction Display */}
          {predictionResult && peak && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Confidence & Profile Summary Bar */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <ConfidenceRing score={predictionResult.confidence_score} size={64} strokeWidth={6} />
                  <div>
                    <div className="text-xs text-slate-400 font-medium">Model Confidence</div>
                    <div className="text-sm font-semibold text-white flex items-center space-x-2">
                      <span>{Math.round(predictionResult.confidence_score * 100)}% reliability</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Band: <span className="font-mono text-slate-300">±{Math.round((peak.band_width || 0) / 2)} mg/dL</span> | Logged Meals:{' '}
                      <span className="font-mono text-slate-300">
                        {predictionResult.confidence_components?.mem_n ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <ProvenanceBadge provenance="TWIN_PREDICTED" safetyChecked={true} />
                </div>
              </div>

              {/* 4 Primary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* 1. Peak Rise */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Peak Rise</span>
                    <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    +{peak.median} <span className="text-xs font-normal text-slate-400">mg/dL</span>
                  </div>
                  <div className="text-xs text-teal-400/90 font-mono">
                    p10–p90: [{peak.p10} - {peak.p90}]
                  </div>
                </div>

                {/* 2. iAUC 2h */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>iAUC 2h</span>
                    <Activity className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {predictionResult.targets.iauc_2h ? (
                      <>
                        {predictionResult.targets.iauc_2h.median}{' '}
                        <span className="text-xs font-normal text-slate-400">mg/dL·min</span>
                      </>
                    ) : (
                      <span className="text-sm font-normal text-slate-400" title="Reserved for multi-target model">
                        ~{Math.round(peak.median * 55)}{' '}
                        <span className="text-xs text-slate-500">mg/dL·min*</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {predictionResult.targets.iauc_2h ? 'p10–p90 envelope' : '*Trajectory integral est.'}
                  </div>
                </div>

                {/* 3. Delta 60m */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Delta 60m</span>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {predictionResult.targets.delta_60 ? (
                      <>
                        +{predictionResult.targets.delta_60.median}{' '}
                        <span className="text-xs font-normal text-slate-400">mg/dL</span>
                      </>
                    ) : (
                      <span className="text-sm font-normal text-slate-400">
                        +{Math.round(peak.median * 0.95)}{' '}
                        <span className="text-xs text-slate-500">mg/dL*</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {predictionResult.targets.delta_60 ? 'Measured at 1h' : '*Near-peak proxy'}
                  </div>
                </div>

                {/* 4. Delta 120m */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Delta 120m</span>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {predictionResult.targets.delta_120 ? (
                      <>
                        +{predictionResult.targets.delta_120.median}{' '}
                        <span className="text-xs font-normal text-slate-400">mg/dL</span>
                      </>
                    ) : (
                      <span className="text-sm font-normal text-slate-400">
                        +{Math.round(peak.median * 0.35)}{' '}
                        <span className="text-xs text-slate-500">mg/dL*</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {predictionResult.targets.delta_120 ? 'Measured at 2h' : '*Recovery proxy'}
                  </div>
                </div>
              </div>

              {/* Uncertainty Trajectory Chart */}
              <SectionCard
                title="Postprandial Glucose Trajectory"
                description="Simulated post-meal curve: solid line represents expected glucose; shaded band indicates typical response range."
              >
                <UncertaintyChart
                  data={curvePoints}
                  height={320}
                  baselineLabel="Predicted Response"
                  yAxisLabel="Glucose (mg/dL)"
                />
              </SectionCard>
            </motion.div>
          )}
        </div>
      </div>

      {/* Calculation Details Drawer */}
      <CalculationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Prediction Calculation Transparency"
        ensembleSize={15}
        inputs={predictionResult?.feature_row || formData}
        memory={{
          mem_n: predictionResult?.confidence_components?.mem_n ?? 0,
          mem_mean_rise: predictionResult?.feature_row?.mem_mean_rise,
          mem_mean_iauc: predictionResult?.feature_row?.mem_mean_iauc,
          baseline_used: predictionResult?.baseline_used,
        }}
        boundsChecked={!outOfRangeError}
      />
    </div>
  );
};
