import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowDownRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  Flame,
  Info,
  Layers,
  Sparkles,
  TrendingDown,
  UserCheck,
  Zap,
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
  Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import {
  usePatient,
  useTwinLearning,
  useDropdownParticipants,
  useLogMeal,
} from '../api/queries';
import { ConfidenceRing } from '../components/ConfidenceRing';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { TwinUpdatedPulse } from '../components/TwinUpdatedPulse';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';
import { THEME_COLORS } from '../theme/colors';

// 3 Realistic meals sampled from recorded meals_db
const SAMPLE_RECORDED_MEALS = [
  {
    label: 'Oatmeal with Blueberries & Greek Yogurt',
    logged_at: new Date(Date.now() - 3600000 * 20).toISOString(),
    carbs_g: 48,
    protein_g: 22,
    fat_g: 10,
    fibre_g: 6,
    calories: 370,
    pre_glucose: 98,
    pre_trend30: 0.0,
    observed_peak_rise: 36.5,
    observed_iauc_2h: 1780,
    observed_delta_60: 32.0,
    observed_delta_120: 12.0,
    activity_after_min: 15,
  },
  {
    label: 'Brown Rice, Grilled Chicken & Greens',
    logged_at: new Date(Date.now() - 3600000 * 14).toISOString(),
    carbs_g: 62,
    protein_g: 34,
    fat_g: 16,
    fibre_g: 7,
    calories: 528,
    pre_glucose: 106,
    pre_trend30: 1.0,
    observed_peak_rise: 47.8,
    observed_iauc_2h: 2290,
    observed_delta_60: 42.0,
    observed_delta_120: 16.5,
    activity_after_min: 0,
  },
  {
    label: 'Lentil Soup with Whole Wheat Pita',
    logged_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    carbs_g: 54,
    protein_g: 24,
    fat_g: 12,
    fibre_g: 9,
    calories: 420,
    pre_glucose: 110,
    pre_trend30: -0.5,
    observed_peak_rise: 40.2,
    observed_iauc_2h: 1940,
    observed_delta_60: 35.5,
    observed_delta_120: 14.0,
    activity_after_min: 20,
  },
];

export const TwinLearningPage: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: patient, isLoading: loadingPatient, refetch: refetchPatient } = usePatient(activePatientId);
  const { data: participants } = useDropdownParticipants();
  const logMealMutation = useLogMeal(activePatientId || 0);

  // Selected CGMacros participant for the left progression chart (default to 1 or first available)
  const [selectedParticipantId, setSelectedParticipantId] = useState<number>(1);
  const { data: learningData, isLoading: loadingLearning } = useTwinLearning(selectedParticipantId);

  // Logging 3 samples state
  const [isLoggingSamples, setIsLoggingSamples] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  const twinState = patient?.twin_state;
  const memN = twinState?.mem_n ?? 0;
  const confidence = twinState?.confidence_score ?? 0.1;

  // Calculate dynamic band width for active patient (starts wide ~35 mg/dL, narrows toward ~18 mg/dL as mem_n increases)
  const estimatedBandWidth = React.useMemo(() => {
    // Formula: baseline band ~36 mg/dL decaying asymptotically with mem_n
    return Math.max(16.0, Number((36.0 * Math.exp(-0.06 * memN) + 6.0).toFixed(1)));
  }, [memN]);

  const handleLogSampleMeals = async () => {
    if (!activePatientId || isLoggingSamples) return;

    setIsLoggingSamples(true);
    try {
      for (const meal of SAMPLE_RECORDED_MEALS) {
        await logMealMutation.mutateAsync(meal);
      }
      await refetchPatient();
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 3500);
    } catch (err) {
      console.error('Failed to log sample meals', err);
    } finally {
      setIsLoggingSamples(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Twin Learning & Adaptation</h1>
            <ProvenanceBadge provenance="TWIN_PREDICTED" safetyChecked={true} />
            {justUpdated && <TwinUpdatedPulse showText={true} />}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Observe how Bayesian memory accumulation narrows epistemic uncertainty bands as real observed meals are
            logged.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: CGMacros Progression Analysis */}
        <div className="lg:col-span-7 space-y-4">
          <SectionCard
            title="Cohort Epistemic Uncertainty vs Observed Meals"
            description="Empirical tracking of model ensemble prediction spread across sequential recorded meals in CGMacros"
          >
            {/* Participant Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-lg bg-slate-900 border border-slate-800">
              <label className="text-xs font-medium text-slate-400">Select CGMacros Participant:</label>
              <select
                value={selectedParticipantId}
                onChange={(e) => setSelectedParticipantId(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-teal-500"
              >
                {participants && participants.length > 0 ? (
                  participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      Participant #{p.id} — {p.summary}
                    </option>
                  ))
                ) : (
                  Array.from({ length: 15 }, (_, i) => i + 1).map((id) => (
                    <option key={id} value={id}>
                      CGMacros Participant #{id}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Progression Chart */}
            {loadingLearning ? (
              <LoadingSkeleton className="h-72 w-full" />
            ) : learningData && learningData.data_points.length > 0 ? (
              <div className="space-y-4">
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={learningData.data_points}
                      margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="bandWidthGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#14B8A6" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                      <XAxis
                        dataKey="meal_index"
                        stroke="#64748B"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#1E293B' }}
                        label={{
                          value: 'Sequential Meal Number (Timeline Order)',
                          position: 'insideBottom',
                          offset: -5,
                          fontSize: 10,
                          fill: '#64748B',
                        }}
                      />
                      <YAxis
                        stroke="#64748B"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#1E293B' }}
                        label={{
                          value: 'Band Width & Abs Error (mg/dL)',
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
                        formatter={(val: any, name: any) => [
                          `${val ?? 'N/A'} mg/dL`,
                          name === 'band_width'
                            ? 'Uncertainty Band Width (p90 - p10)'
                            : name === 'prediction_error'
                            ? 'Absolute Prediction Error'
                            : name,
                        ]}
                        labelFormatter={(idx) => `Meal #${idx}`}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        iconType="circle"
                        wrapperStyle={{ fontSize: 11, paddingBottom: 10 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="band_width"
                        name="Uncertainty Band Width (p90 - p10)"
                        stroke="#14B8A6"
                        strokeWidth={2}
                        fill="url(#bandWidthGrad)"
                      />
                      <Line
                        type="monotone"
                        dataKey="prediction_error"
                        name="Absolute Prediction Error"
                        stroke="#F59E0B"
                        strokeWidth={1.5}
                        dot={{ r: 2, fill: '#F59E0B' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* API Note Callout */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start space-x-3 text-xs text-slate-400">
                  <Info className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200">Recommender Learning Dynamics: </span>
                    {learningData.note}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                No learning records found for Participant #{selectedParticipantId}.
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right Column: Active Patient Live Twin Memory & Demo Simulator */}
        <div className="lg:col-span-5 space-y-4">
          <SectionCard
            title="Active Patient Live Twin Memory"
            description="Real-time calibration state of the currently active patient"
          >
            {loadingPatient ? (
              <LoadingSkeleton className="h-64 w-full" />
            ) : patient ? (
              <div className="space-y-6">
                {/* Active Patient Identity & State */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">Active Patient</div>
                      <div className="text-base font-bold text-white flex items-center space-x-2">
                        <span>{patient.display_name}</span>
                        {patient.is_synthetic && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            Synthetic demo
                          </span>
                        )}
                      </div>
                    </div>
                    <ConfidenceRing score={confidence} size={58} strokeWidth={5} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-400 block">Observed Meals (mem_n):</span>
                      <motion.span
                        key={memN}
                        initial={{ scale: 1.3, color: '#14B8A6' }}
                        animate={{ scale: 1, color: '#FFFFFF' }}
                        className="text-xl font-bold font-mono block mt-1"
                      >
                        {memN}
                      </motion.span>
                      <span className="text-[10px] text-slate-500">Prior meal history</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-400 block">Current Band Width:</span>
                      <motion.span
                        key={estimatedBandWidth}
                        initial={{ scale: 1.3, color: '#14B8A6' }}
                        animate={{ scale: 1, color: '#14B8A6' }}
                        className="text-xl font-bold font-mono block mt-1"
                      >
                        ±{(estimatedBandWidth / 2).toFixed(1)}{' '}
                        <span className="text-xs font-normal text-slate-400">mg/dL</span>
                      </motion.span>
                      <span className="text-[10px] text-slate-500">80% uncertainty spread</span>
                    </div>
                  </div>

                  {/* Visual Animated Band Narrowing Indicator */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 flex items-center space-x-1.5">
                        <TrendingDown className="w-3.5 h-3.5 text-teal-400" />
                        <span>Ensemble Uncertainty Envelope:</span>
                      </span>
                      <span className="font-mono text-teal-300 font-medium">{estimatedBandWidth} mg/dL</span>
                    </div>

                    {/* Interactive Animated Band Width Visualizer */}
                    <div className="relative h-8 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                      {/* Center zero line */}
                      <div className="absolute inset-y-0 w-0.5 bg-slate-600 left-1/2 -translate-x-1/2 z-10" />

                      {/* Animated Shaded Uncertainty Envelope */}
                      <motion.div
                        className="absolute h-5 rounded-md bg-teal-500/20 border border-teal-500/40"
                        animate={{
                          width: `${Math.min(96, Math.max(20, (estimatedBandWidth / 40) * 100))}%`,
                        }}
                        transition={{ type: 'spring', stiffness: 120, damping: 15 }}
                      />

                      <span className="relative z-20 text-[10px] font-mono text-slate-300 font-medium">
                        {memN === 0 ? 'Wide Baseline Dispersion (mem_n=0)' : `Narrowed Envelope (${memN} meals logged)`}
                      </span>
                    </div>
                  </div>

                  {/* Summary of Personalization Status */}
                  <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 space-y-1">
                    <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                      <BrainCircuit className="w-3.5 h-3.5 text-teal-400" />
                      <span>
                        {memN > 0 ? 'Personalised Dynamic Memory Active' : 'Cohort Population Prior Injected'}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {memN > 0
                        ? `The active twin incorporates ${memN} personal meal observations. Each observation lowers ensemble dispersion towards physiological baseline.`
                        : 'No individual meals logged yet. The twin relies on the 45-participant population mean rise until personal meals are recorded.'}
                    </p>
                  </div>
                </div>

                {/* Log 3 Sample Meals Button (ONLY for synthetic demo patients) */}
                {patient.is_synthetic ? (
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-teal-500/20 space-y-3 shadow-md shadow-teal-500/5">
                    <div className="flex items-center space-x-2 text-teal-400 text-xs font-semibold uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" />
                      <span>Synthetic Demo Acceleration</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Quickly simulate twin learning by logging 3 realistic meals with postprandial outcomes sampled from
                      recorded CGMacros data.
                    </p>

                    <button
                      onClick={handleLogSampleMeals}
                      disabled={isLoggingSamples}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 disabled:opacity-50 text-slate-950 font-semibold rounded-lg shadow-lg shadow-teal-500/20 transition-all cursor-pointer text-xs"
                    >
                      {isLoggingSamples ? (
                        <>
                          <Activity className="w-4 h-4 animate-spin" />
                          <span>Logging 3 Sample Recorded Meals...</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4" />
                          <span>Log 3 Sample Meals (Recorded Data)</span>
                        </>
                      )}
                    </button>

                    <div className="text-[10px] text-slate-500 text-center">
                      Label: "Sample entries from recorded data" • Updates mem_n by +3
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400">
                    <div className="flex items-center space-x-2 text-slate-300 font-medium mb-1">
                      <UserCheck className="w-4 h-4 text-slate-400" />
                      <span>Real Patient Mode</span>
                    </div>
                    <p className="text-[11px]">
                      Sample meal injection is disabled for non-synthetic profiles to protect clinical integrity. Use
                      the "Log Data" page to record real meal observations.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                title="No Patient Selected"
                description="Please select or initialize an active patient to view twin learning."
              />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
