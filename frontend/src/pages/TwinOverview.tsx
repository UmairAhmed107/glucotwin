import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Download,
  FileText,
  Flame,
  Layers,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Sparkles,
  Stethoscope,
  Target,
  TrendingDown,
  TrendingUp,
  User,
  Utensils,
  Zap,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { usePatient, useTimeline, useTwinAccuracy, useTwinMaturity, useReconcileTwin } from '../api/queries';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';
import { ConfidenceRing } from '../components/ConfidenceRing';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { TwinUpdatedPulse } from '../components/TwinUpdatedPulse';

export const TwinOverview: React.FC = () => {
  const { activePatientId, viewMode } = useApp();
  const navigate = useNavigate();

  const { data: patient, isLoading: loadingPatient, error: patientError } = usePatient(activePatientId);
  const { data: timelineData, isLoading: loadingTimeline } = useTimeline(activePatientId);
  const { data: accuracyData, isLoading: loadingAccuracy } = useTwinAccuracy(activePatientId);
  const { data: maturityData, isLoading: loadingMaturity } = useTwinMaturity(activePatientId);
  const reconcileMutation = useReconcileTwin(activePatientId || 0);

  if (!activePatientId || (!loadingPatient && !patient)) {
    return (
      <EmptyState
        title="No Active Patient Selected"
        description="Choose a patient from the top bar or initialize a new metabolic digital twin."
        icon={User}
        action={
          <button
            onClick={() => navigate('/patients/setup')}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-[#0B1220] font-semibold text-xs rounded-lg transition-colors shadow-lg shadow-teal-500/20"
          >
            Setup New Patient
          </button>
        }
      />
    );
  }

  if (loadingPatient) {
    return <LoadingSkeleton count={4} height="h-32" />;
  }

  const twinState = patient?.twin_state;
  const memN = twinState?.mem_n ?? 0;
  const isPersonalised = memN > 0;
  const confidence = twinState?.confidence_score ?? 0.2;

  // BMI Interpretation
  const bmiVal = patient?.bmi ?? 25;
  const bmiStatus =
    bmiVal < 18.5
      ? 'Underweight'
      : bmiVal < 25
      ? 'Normal'
      : bmiVal < 30
      ? 'Overweight'
      : 'Obese';

  return (
    <div className="space-y-6">
      {/* Top Banner / Pulse */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-slate-100">
              {patient?.display_name}
            </h2>
            <ProvenanceBadge kind="TWIN_PREDICTED" size="sm" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Patient ID #{patient?.id} • Source:{' '}
            <span className="font-mono text-slate-300">{patient?.source}</span> • Registered:{' '}
            {new Date(patient?.created_at || '').toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <TwinUpdatedPulse trigger={twinState?.updated_at} />
          <button
            onClick={() => navigate('/log')}
            className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-600 text-[#0B1220] font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-teal-500/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Log Meal</span>
          </button>
        </div>
      </div>

      {/* Mode Perspective Dashboard Banner */}
      {viewMode === 'patient' ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-[#111C30] border border-teal-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-teal-400 font-bold text-sm">
              <User className="w-4 h-4" />
              <span>Patient Health & Lifestyle Portal</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              Your metabolic digital twin is actively calibrated to your body. Logging meals helps it predict your glycemic response more accurately. You can also explore lifestyle walks or review questions prepared for your doctor.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/log?tab=whatif')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold rounded-lg border border-teal-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>What-If Lab</span>
            </button>
            <button
              onClick={() => navigate('/treatment?tab=plan')}
              className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-[#0B1220] text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Doctor Guidance</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-[#111C30] border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
              <Stethoscope className="w-4 h-4" />
              <span>Clinician Decision Support Console (CDS)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              Deterministic Safety Governor rules are active. Patient #{patient?.id} has an HbA1c of {patient?.hba1c_pct}% and fasting glucose {patient?.fasting_glucose_mgdl} mg/dL. Renal status is {patient?.kidney_flag ? 'MONITORING REQUIRED (eGFR review)' : 'NORMAL'}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/treatment?tab=plan')}
              className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Formulate CDS Plan</span>
            </button>
            <button
              onClick={() => navigate('/governance?tab=cohort')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Cohort Position</span>
            </button>
          </div>
        </div>
      )}

      {/* Grid: Profile & Confidence Ring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Clinical Profile Card */}
        <SectionCard
          title="Clinical Baseline Profile"
          subtitle={
            viewMode === 'clinician'
              ? 'Biochemical markers and risk variables for glycemic decision support.'
              : 'Your health overview and current treatment factors.'
          }
          className="lg:col-span-2"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <StatCard
              label="Age & Sex"
              value={`${patient?.age}y`}
              subValue={patient?.sex === 'M' ? 'Male' : patient?.sex === 'F' ? 'Female' : patient?.sex}
            />
            <StatCard
              label="Body Mass Index"
              value={patient?.bmi.toFixed(1) || '--'}
              subValue={bmiStatus}
            />
            <StatCard
              label="HbA1c Lab"
              value={`${patient?.hba1c_pct.toFixed(1)}%`}
              subValue={patient && patient.hba1c_pct >= 8.0 ? 'Elevated' : 'Moderate'}
            />
            <StatCard
              label="Fasting Blood Glucose"
              value={`${patient?.fasting_glucose_mgdl.toFixed(0)}`}
              subValue="mg/dL"
            />
            <StatCard
              label="Renal / Kidney Flag"
              value={patient?.kidney_flag ? 'Flagged' : 'Clear'}
              subValue={patient?.kidney_flag ? 'Review eGFR' : 'Normal'}
            />
            <StatCard
              label="Hypo Risk History"
              value={
                patient?.hypoglycemia_history === true
                  ? 'Present'
                  : patient?.hypoglycemia_history === false
                  ? 'None'
                  : 'Unknown'
              }
              subValue={patient?.hypoglycemia_history === true ? 'Caution' : 'Standard'}
            />
          </div>

          {/* Current Meds */}
          <div className="pt-3 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block mb-2">
              Active Prescribed Drug Classes:
            </span>
            {patient?.current_meds && patient.current_meds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {patient.current_meds.map((med) => (
                  <span
                    key={med}
                    className="px-2.5 py-1 bg-slate-800 text-teal-300 rounded-md text-xs font-mono border border-slate-700"
                  >
                    {med.replace('_', ' ')}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">
                No active anti-hyperglycemic medications recorded.
              </span>
            )}
          </div>
        </SectionCard>

        {/* Right: Twin Memory & Confidence */}
        <SectionCard
          title="Digital Twin State"
          subtitle="Model calibration and uncertainty status."
          headerAction={<ProvenanceBadge kind="TWIN_PREDICTED" size="sm" />}
        >
          <div className="flex flex-col items-center justify-center py-2 text-center">
            <ConfidenceRing
              score={confidence}
              size={120}
              components={{
                mem_n: memN,
                band_width: 32.5,
              }}
            />

            <div className="mt-4 w-full border-t border-slate-800 pt-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Personalisation Status:</span>
                {isPersonalised ? (
                  <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-teal-500/15 text-teal-300 border border-teal-500/30">
                    Personalised ({memN} meals)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Population baseline
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Mean Historical Rise:</span>
                <span className="font-mono text-slate-200">
                  {twinState?.mem_mean_rise ? `${twinState.mem_mean_rise.toFixed(1)} mg/dL` : '37.8 mg/dL (pop)'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Mean 2h iAUC:</span>
                <span className="font-mono text-slate-200">
                  {twinState?.mem_mean_iauc ? `${twinState.mem_mean_iauc.toFixed(0)} mg·min/dL` : '2,642 (pop)'}
                </span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Top Clinical & Twin Alert Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {patient?.hba1c_pct && patient.hba1c_pct >= 8.0 && (
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-100">Elevated Glycated Hemoglobin</h4>
              <p className="text-[11px] text-amber-300/80 mt-1 leading-relaxed">
                HbA1c of {patient.hba1c_pct}% warrants comprehensive clinical review of pharmacotherapy and postprandial physical activity.
              </p>
            </div>
          </div>
        )}

        {patient?.kidney_flag && (
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 text-indigo-200 text-xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-indigo-100">Renal Biomarker Review Flag</h4>
              <p className="text-[11px] text-indigo-300/80 mt-1 leading-relaxed">
                Safety Governor rule R5 active: metformin & SGLT2 inhibitor recommendations require clinician eGFR review.
              </p>
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30 text-teal-200 text-xs flex items-start gap-3">
          <Zap className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-teal-100">Metabolic Twin Ready</h4>
            <p className="text-[11px] text-teal-300/80 mt-1 leading-relaxed">
              15-model bootstrap ensemble loaded and calibrated. Ready for meal response predictions and lifestyle simulations.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Twin Health & Calibration Section */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Target className="w-5 h-5 text-teal-400" />
                <span>Twin Health & Calibration</span>
              </h3>
              <ProvenanceBadge kind="TWIN_PREDICTED" size="sm" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Longitudinal tracking of predicted vs actual peak rise, rolling error, interval coverage, and physiological drift.
            </p>
          </div>

          <button
            onClick={() => reconcileMutation.mutate()}
            disabled={reconcileMutation.isPending}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 hover:border-teal-500/50 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconcileMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{reconcileMutation.isPending ? 'Reconciling...' : 'Reconcile Predictions'}</span>
          </button>
        </div>

        {/* 1. Drift Banner When Active */}
        {accuracyData?.drift_detected && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs space-y-2.5 shadow-lg shadow-amber-950/20">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-amber-100 text-sm">Digital Twin Model Drift Active</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Attention Required
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                    {accuracyData.drift_details?.reason || 'Prediction errors exceed the acceptable baseline threshold.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-500/20 text-[11px]">
              <span className="text-amber-400 font-semibold">Possible causes to explore:</span>
              {(accuracyData.drift_details?.suggested_causes || ['medication change', 'illness', 'sensor issue']).map(
                (cause) => (
                  <span
                    key={cause}
                    className="px-2 py-0.5 rounded-full bg-slate-900/90 text-amber-200 border border-amber-500/30 font-medium"
                  >
                    • {cause}
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {/* 2. Maturity Level & Timeline Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Twin Maturity Tier
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                    maturityData?.level === 'Well-calibrated'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : maturityData?.level === 'Personalized'
                      ? 'bg-teal-500/15 text-teal-300 border-teal-500/40'
                      : maturityData?.level === 'Learning'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                  }`}
                >
                  {maturityData?.level || 'Population'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                {maturityData?.description || 'Twin relies predominantly on population-wide metabolic priors.'}
              </p>
            </div>

            {/* Score & Progress */}
            <div className="text-left md:text-right shrink-0">
              <div className="text-2xl font-bold font-mono text-white flex items-baseline md:justify-end gap-1">
                <span>{maturityData?.score ?? 0}</span>
                <span className="text-xs text-slate-400 font-normal">/ 100 pts</span>
              </div>
              <div className="w-44 h-2 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, maturityData?.score ?? 0))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Component Score Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 block text-[11px]">Memory Volume (40 pts)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-mono text-slate-200 font-bold">
                  {maturityData?.components?.memory_score ?? 0} pts
                </span>
                <span className="font-mono text-teal-400 text-[11px]">
                  {maturityData?.components?.mem_n ?? 0} observed meals
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 block text-[11px]">Recent Accuracy (30 pts)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-mono text-slate-200 font-bold">
                  {maturityData?.components?.accuracy_score ?? 15} pts
                </span>
                <span className="font-mono text-cyan-400 text-[11px]">
                  MAE: {maturityData?.components?.recent_mae ? `${maturityData.components.recent_mae} mg/dL` : 'Nominal'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 block text-[11px]">Interval Calibration (30 pts)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-mono text-slate-200 font-bold">
                  {maturityData?.components?.calibration_score ?? 15} pts
                </span>
                <span className="font-mono text-emerald-400 text-[11px]">
                  Coverage: {maturityData?.components?.coverage_pct ? `${maturityData.components.coverage_pct}%` : 'Nominal'}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline of Level Changes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Milestone Progression Timeline</span>
              <span className="text-[11px] text-teal-400 font-medium">
                Next: {maturityData?.next_milestone || 'Log more meals with glucose readings.'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
              {(maturityData?.timeline || [
                { level: 'Population', unlocked: true, description: 'Population priors active', reached_at: patient?.created_at },
                { level: 'Learning', unlocked: false, description: 'Requires 5 reconciled meals' },
                { level: 'Personalized', unlocked: false, description: 'Requires 15 reconciled meals' },
                { level: 'Well-calibrated', unlocked: false, description: 'Requires score >= 80 & 20+ meals' },
              ]).map((step, idx) => (
                <div
                  key={step.level}
                  className={`p-3 rounded-xl border transition-all text-xs ${
                    step.unlocked
                      ? 'bg-teal-950/15 border-teal-500/30 text-teal-200'
                      : 'bg-slate-950/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{step.level}</span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step.unlocked
                          ? 'bg-teal-500 text-slate-950'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {step.unlocked ? '✓' : idx + 1}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                    {step.description}
                  </p>
                  {step.reached_at && (
                    <span className="text-[10px] font-mono text-teal-400/80 block mt-1">
                      {new Date(step.reached_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Side-by-Side: Predicted vs Actual Scatter & Rolling MAE Line */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Scatter Chart: Predicted vs Actual */}
          <SectionCard
            title="Predicted vs Actual Peak Rise"
            subtitle="Scatter comparison against ideal y = x line (dashed)."
            headerAction={
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400">
                  {accuracyData?.reconciled_count ?? 0} Reconciled Pairs
                </span>
                <button
                  onClick={() => reconcileMutation.mutate()}
                  disabled={reconcileMutation.isPending}
                  className="px-2 py-0.5 text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 rounded transition-colors disabled:opacity-50"
                  title="Scan sensor readings and reconcile with logged meals"
                >
                  {reconcileMutation.isPending ? 'Reconciling...' : 'Reconcile'}
                </button>
              </div>
            }
          >
            {accuracyData && accuracyData.history.filter((h) => h.actual_peak_rise != null).length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      type="number"
                      dataKey="predicted_peak_rise"
                      name="Predicted Rise"
                      unit=" mg/dL"
                      stroke="#64748b"
                      fontSize={11}
                      domain={[0, (dataMax: number) => Math.max(dataMax || 0, 60)]}
                    />
                    <YAxis
                      type="number"
                      dataKey="actual_peak_rise"
                      name="Actual Rise"
                      unit=" mg/dL"
                      stroke="#64748b"
                      fontSize={11}
                      domain={[0, (dataMax: number) => Math.max(dataMax || 0, 60)]}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1 font-mono">
                              <p className="text-white font-bold">Meal ID #{data.meal_id || data.id}</p>
                              <p className="text-teal-400">Predicted: +{data.predicted_peak_rise} mg/dL</p>
                              <p className="text-blue-400">Actual: +{data.actual_peak_rise} mg/dL</p>
                              <p className="text-slate-300">
                                Error: {data.error > 0 ? `+${data.error}` : data.error} mg/dL
                              </p>
                              <p className={data.in_range ? 'text-emerald-400' : 'text-amber-400'}>
                                {data.in_range ? '✓ In Range (P10-P90)' : '⚠ Out of Range'}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      segment={[
                        { x: 0, y: 0 },
                        { x: 60, y: 60 },
                      ]}
                      stroke="#0d9488"
                      strokeDasharray="4 4"
                      label={{ value: 'Ideal y=x', fill: '#0d9488', fontSize: 10, position: 'top' }}
                    />
                    <Scatter
                      name="In Range"
                      data={accuracyData.history
                        .filter((h) => h.actual_peak_rise != null && h.in_range)
                        .map((h) => ({ ...h }))}
                      fill="#14b8a6"
                    />
                    <Scatter
                      name="Out of Range"
                      data={accuracyData.history
                        .filter((h) => h.actual_peak_rise != null && !h.in_range)
                        .map((h) => ({ ...h }))}
                      fill="#f59e0b"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
                {(accuracyData?.reconciled_count ?? 0) <= 1 && (
                  <p className="text-[10px] text-slate-500 text-center mt-1">
                    Initial reconciled meal recorded. Log and reconcile additional meals to build a multi-point scatter distribution.
                  </p>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-xs text-slate-400">
                <Target className="w-8 h-8 text-slate-600 mb-2" />
                <p className="font-semibold text-slate-300">No Reconciled Meal Forecasts Yet</p>
                <p className="max-w-xs text-[11px] text-slate-500 mt-1">
                  Once post-meal glucose readings are recorded covering the 3-hour window, forecasts will automatically reconcile and plot here.
                </p>
              </div>
            )}
          </SectionCard>

          {/* Rolling MAE Line Chart & Coverage Meter */}
          <SectionCard
            title="Rolling MAE & Interval Coverage"
            subtitle="Trailing 20-prediction Mean Absolute Error progression."
            headerAction={
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400">
                  Coverage:
                </span>
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                    (accuracyData?.interval_coverage_pct ?? 100) >= 80
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : (accuracyData?.interval_coverage_pct ?? 100) >= 60
                      ? 'bg-teal-500/15 text-teal-300'
                      : 'bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {accuracyData?.interval_coverage_pct != null
                    ? `${accuracyData.interval_coverage_pct}%`
                    : '80% (Nominal)'}
                </span>
              </div>
            }
          >
            {accuracyData && accuracyData.history.filter((h) => h.rolling_mae != null).length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={accuracyData.history
                      .filter((h) => h.rolling_mae != null)
                      .map((h, i) => ({
                        index: i + 1,
                        rolling_mae: h.rolling_mae,
                        abs_error: Math.abs(h.error || 0),
                      }))}
                    margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="index"
                      stroke="#64748b"
                      fontSize={11}
                      label={{ value: 'Reconciled Meal #', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#64748b' }}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      unit=" mg/dL"
                      domain={[0, (dataMax: number) => Math.max(dataMax || 0, 20)]}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1 font-mono">
                              <p className="text-white font-bold">Meal #{data.index}</p>
                              <p className="text-teal-400">Rolling MAE: {data.rolling_mae} mg/dL</p>
                              <p className="text-slate-400">Meal Error: {data.abs_error} mg/dL</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={15}
                      stroke="#14b8a6"
                      strokeDasharray="4 4"
                      label={{ value: 'Target 15 mg/dL', fill: '#14b8a6', fontSize: 10, position: 'right' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rolling_mae"
                      name="Rolling MAE"
                      stroke="#2dd4bf"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#2dd4bf' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                {(accuracyData?.reconciled_count ?? 0) <= 1 && (
                  <p className="text-[10px] text-slate-500 text-center mt-1">
                    Single data point plotted. Minimum 2 reconciled meals required to render a longitudinal trend line.
                  </p>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-xs text-slate-400">
                <Activity className="w-8 h-8 text-slate-600 mb-2" />
                <p className="font-semibold text-slate-300">No Rolling Error History Yet</p>
                <p className="max-w-xs text-[11px] text-slate-500 mt-1">
                  Once post-meal forecasts reconcile, rolling MAE tracking will render dynamically here.
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Recent Activity / Timeline Preview */}
      <SectionCard
        title="Recent Timeline Activity"
        subtitle="Chronological sequence of logged meals, glucose readings, and recommendations."
        headerAction={
          <button
            onClick={() => navigate('/timeline')}
            className="text-xs text-teal-400 hover:text-teal-300 font-medium"
          >
            View Full Timeline →
          </button>
        }
      >
        {loadingTimeline ? (
          <LoadingSkeleton count={3} height="h-14" />
        ) : timelineData?.events && timelineData.events.length > 0 ? (
          <div className="space-y-2.5">
            {timelineData.events.slice(0, 5).map((ev) => (
              <div
                key={`${ev.type}-${ev.id}`}
                className="p-3 bg-[#0B1220] border border-slate-800 rounded-lg flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center ${
                      ev.type === 'meal'
                        ? 'bg-teal-500/10 text-teal-400'
                        : ev.type === 'reading'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-purple-500/10 text-purple-400'
                    }`}
                  >
                    {ev.type === 'meal' ? (
                      <Utensils className="w-4 h-4" />
                    ) : ev.type === 'reading' ? (
                      <Activity className="w-4 h-4" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-200 capitalize">
                      {ev.type === 'meal'
                        ? `Meal Log: ${ev.data?.carbs_g}g carbs, ${ev.data?.calories} kcal`
                        : ev.type === 'reading'
                        ? `Glucose Check: ${ev.data?.value_mgdl} mg/dL (${ev.data?.source})`
                        : `Recommendation (${ev.data?.kind})`}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      {new Date(ev.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  {ev.type === 'meal' && ev.data?.observed_peak_rise && (
                    <span className="font-mono text-teal-300 font-bold">
                      +{ev.data.observed_peak_rise} mg/dL rise
                    </span>
                  )}
                  {ev.type === 'reading' && (
                    <span className="font-mono text-blue-300 font-bold">
                      {ev.data.value_mgdl} mg/dL
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400">
            No meals or glucose readings logged yet for this patient. Click "Log Meal" to get started!
          </div>
        )}
      </SectionCard>
    </div>
  );
};
