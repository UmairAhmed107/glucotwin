import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  FileText,
  Flame,
  Layers,
  PlusCircle,
  ShieldAlert,
  Sliders,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  User,
  Utensils,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePatient, useTimeline } from '../api/queries';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';
import { ConfidenceRing } from '../components/ConfidenceRing';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { TwinUpdatedPulse } from '../components/TwinUpdatedPulse';

export const TwinOverview: React.FC = () => {
  const { activePatientId, viewMode } = useApp();
  const navigate = useNavigate();

  const { data: patient, isLoading: loadingPatient, error: patientError } = usePatient(activePatientId);
  const { data: timelineData, isLoading: loadingTimeline } = useTimeline(activePatientId);

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
            {patient?.is_synthetic && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                Synthetic demo patient
              </span>
            )}
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
              onClick={() => navigate('/simulation?tab=whatif')}
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
              Deterministic Safety Governor rules R1–R9 are active. Patient #{patient?.id} has an HbA1c of {patient?.hba1c_pct}% and fasting glucose {patient?.fasting_glucose_mgdl} mg/dL. Renal review flag is {patient?.kidney_flag ? 'FLAGGED (Rule R5 eGFR audit active)' : 'CLEAR'}.
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
