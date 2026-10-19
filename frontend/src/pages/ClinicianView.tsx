import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  FileCheck,
  FileText,
  HelpCircle,
  History,
  Lock,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  usePatient,
  useAuditLog,
  useClinicalPlan,
  usePredictMeal,
} from '../api/queries';
import { AuditLogEntry, ClinicalPlanResponse, PredictResponse } from '../api/types';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { ConfidenceRing } from '../components/ConfidenceRing';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';
import { getRuleExplanation } from '../constants/governorRules';
import { showToast } from '../api/client';

export const ClinicianViewPage: React.FC = () => {
  const { activePatientId, setViewMode } = useApp();
  const { data: patient, isLoading: loadingPatient } = usePatient(activePatientId);
  const { data: auditEntries, isLoading: loadingAudit } = useAuditLog(activePatientId);
  const clinicalPlanMutation = useClinicalPlan(activePatientId || 0);
  const predictMutation = usePredictMeal(activePatientId || 0);

  const [activePlan, setActivePlan] = useState<ClinicalPlanResponse | null>(null);
  const [activePred, setActivePred] = useState<PredictResponse | null>(null);

  const handleDownloadReport = () => {
    if (!activePatientId) return;
    const url = `/patients/${activePatientId}/report.pdf`;
    showToast({
      type: 'info',
      title: 'Generating Report',
      message: `Downloading clinical PDF report for Patient #${activePatientId}...`,
    });
    window.open(url, '_blank');
  };

  const handleQuickPredict = async () => {
    if (!activePatientId) return;
    try {
      const res = await predictMutation.mutateAsync({
        carbs_g: 50,
        protein_g: 22,
        fat_g: 14,
        fibre_g: 5,
        pre_glucose: 105,
        pre_trend30: 0.0,
        time_of_day: 12.5,
      });
      setActivePred(res);
    } catch (err) {
      console.error('Quick prediction failed', err);
    }
  };

  const handleQuickPlan = async () => {
    if (!activePatientId) return;
    try {
      const res = await clinicalPlanMutation.mutateAsync();
      setActivePlan(res);
    } catch (err) {
      console.error('Quick plan failed', err);
    }
  };

  if (!activePatientId) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          title="No Active Patient Selected"
          description="Select or create a patient to view the dense clinician workstation."
          actionText="Go to Patient Setup"
          onAction={() => (window.location.href = '/patient-setup')}
        />
      </div>
    );
  }

  const twin = patient?.twin_state;
  const memN = twin?.mem_n ?? 0;
  const conf = twin?.confidence_score ?? 0.1;
  const isHypoActive = patient?.hypoglycemia_history === true;
  const isHypoUnknown = patient?.hypoglycemia_history === null;

  return (
    <div className="space-y-5">
      {/* Clinician Command Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-teal-500/30 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Stethoscope className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-white tracking-tight">{patient?.display_name}</h1>
                <span className="text-xs font-mono text-slate-400">ID #{patient?.id}</span>
                {patient?.is_synthetic && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Synthetic Demo
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                <span>
                  Age: <strong className="text-white">{patient?.age}y</strong> ({patient?.sex})
                </span>
                <span>•</span>
                <span>
                  BMI: <strong className="text-white">{patient?.bmi}</strong> kg/m²
                </span>
                <span>•</span>
                <span>
                  Baseline HbA1c: <strong className="text-teal-400">{patient?.hba1c_pct}%</strong>
                </span>
                <span>•</span>
                <span>
                  Fasting: <strong className="text-white">{patient?.fasting_glucose_mgdl}</strong> mg/dL
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-end md:self-auto">
          <button
            onClick={handleDownloadReport}
            id="download-clinical-report-btn"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-md shadow-teal-500/10 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Clinical Report (PDF)</span>
          </button>
        </div>
      </div>

      {/* Dense Risk Flags Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {/* Hypoglycemia Status */}
        <div
          className={`p-3 rounded-xl border flex items-center justify-between ${
            isHypoActive
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              : isHypoUnknown
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Hypoglycemia Risk
            </span>
            <span className="font-semibold text-xs">
              {isHypoActive
                ? 'Reported Active History (High)'
                : isHypoUnknown
                ? 'History Unknown (Needs Inquiry)'
                : 'No Prior Episodes Recorded'}
            </span>
          </div>
          {isHypoActive ? (
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          ) : isHypoUnknown ? (
            <HelpCircle className="w-5 h-5 text-amber-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          )}
        </div>

        {/* Renal Risk Flag */}
        <div
          className={`p-3 rounded-xl border flex items-center justify-between ${
            patient?.kidney_flag
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Renal Impairment</span>
            <span className="font-semibold text-xs">
              {patient?.kidney_flag ? 'Active Flag: Review Renal Labs' : 'No Renal Risk Flag'}
            </span>
          </div>
          {patient?.kidney_flag ? (
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          )}
        </div>

        {/* Current Medications */}
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5 text-slate-300">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Medications</span>
          <div className="font-mono text-xs truncate">
            {patient?.current_meds && patient.current_meds.length > 0
              ? patient.current_meds.join(', ')
              : 'None documented'}
          </div>
        </div>
      </div>

      {/* Main 2-Column Dense Clinician Workstation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 cols): Twin Memory & Rapid Excursion Audit */}
        <div className="lg:col-span-5 space-y-5">
          {/* Twin State Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-white text-sm">Metabolic Twin Memory State</h3>
              </div>
              <ProvenanceBadge provenance="TWIN_PREDICTED" safetyChecked={true} size="sm" />
            </div>

            <div className="flex items-center space-x-4">
              <ConfidenceRing score={conf} size={64} strokeWidth={6} />
              <div className="text-xs space-y-0.5">
                <div className="text-white font-bold">{Math.round(conf * 100)}% Ensemble Reliability</div>
                <div className="text-slate-400 font-mono">
                  mem_n: <strong className="text-teal-400">{memN}</strong> observed meals
                </div>
                <div className="text-slate-400 font-mono">
                  Running Rise:{' '}
                  <strong className="text-white">
                    {twin?.mem_mean_rise != null ? `${twin.mem_mean_rise} mg/dL` : 'Population Prior'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Conditioning Prior:</span>
              <span
                className={`font-semibold ${
                  memN === 0 ? 'text-amber-400' : 'text-teal-400'
                }`}
              >
                {memN === 0 ? 'Population Baseline (meals_db)' : 'Personalised Dynamic Memory'}
              </span>
            </div>
          </div>

          {/* Quick Simulation Probe */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white text-sm">Standard Meal Excursion Probe</h3>
              <button
                onClick={handleQuickPredict}
                disabled={predictMutation.isPending}
                className="text-xs text-teal-400 hover:text-teal-300 font-semibold cursor-pointer"
              >
                {predictMutation.isPending ? 'Simulating...' : 'Test 50g Carb Meal'}
              </button>
            </div>

            {activePred && activePred.targets.peak_rise ? (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Ensemble Median Peak Rise:</span>
                  <span className="font-bold text-teal-400">
                    +{activePred.targets.peak_rise.median} mg/dL
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>80% Bootstrap Envelope:</span>
                  <span className="text-slate-200">
                    [{activePred.targets.peak_rise.p10} - {activePred.targets.peak_rise.p90}] mg/dL
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Ensemble Dispersion:</span>
                  <span className="text-slate-300">{activePred.targets.peak_rise.band_width} mg/dL</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Click "Test 50g Carb Meal" to probe the bootstrap ensemble's current postprandial trajectory.
              </p>
            )}
          </div>

          {/* Patient Audit Trail */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center space-x-2 text-slate-300 text-sm font-bold">
              <History className="w-4 h-4 text-teal-400" />
              <span>Immutable Audit Trail (Last 100 Events)</span>
            </div>

            {loadingAudit ? (
              <LoadingSkeleton className="h-36 w-full" />
            ) : auditEntries && auditEntries.length > 0 ? (
              <div className="max-h-60 overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 divide-y divide-slate-800/80 text-[11px] font-mono">
                {auditEntries.slice(0, 15).map((entry: AuditLogEntry) => (
                  <div key={entry.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="text-white font-semibold truncate">{entry.endpoint}</div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(entry.ts).toLocaleTimeString()} • SHA:{' '}
                        {entry.inputs_hash.slice(0, 8)}
                      </div>
                    </div>
                    {entry.rules_triggered && entry.rules_triggered.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-teal-300 flex-shrink-0">
                        {entry.rules_triggered.length} rules
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-4">No audit events recorded yet.</div>
            )}
          </div>
        </div>

        {/* Right Column (7 cols): Clinical Guidance & Governor Review */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Clinical Plan */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">Active Clinical Plan & Safety Synthesis</h3>
              </div>
              <button
                onClick={handleQuickPlan}
                disabled={clinicalPlanMutation.isPending}
                className="text-xs font-semibold text-teal-400 hover:text-teal-300 cursor-pointer"
              >
                {clinicalPlanMutation.isPending ? 'Synthesizing...' : 'Run Plan Synthesis'}
              </button>
            </div>

            {activePlan ? (
              <div className="space-y-4">
                {/* Red Flags if any */}
                {activePlan.plan.red_flags && activePlan.plan.red_flags.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-1">
                    <div className="font-semibold flex items-center space-x-1.5 text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Active Red Flags</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {activePlan.plan.red_flags.map((rf, idx) => (
                        <li key={idx}>{rf}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Patient Summary */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans">
                  {activePlan.plan.patient_summary}
                </div>

                {/* Therapy Options Summary Table */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
                    Permitted Therapeutic Classes ({activePlan.plan.therapy_options.length})
                  </span>
                  <div className="divide-y divide-slate-800 rounded-xl bg-slate-950 border border-slate-800 text-xs overflow-hidden">
                    {activePlan.plan.therapy_options.map((opt, oIdx) => (
                      <div key={oIdx} className="p-3 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white capitalize">
                            {opt.drug_class.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-indigo-400 font-mono">
                            {opt.guideline_ids.join(', ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{opt.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Governor Trace Breakdown */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300 font-semibold">
                    <span className="flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Deterministic Governor Execution Rules</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {activePlan.governor_trace.rules_triggered.length} Evaluated
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                    {activePlan.governor_trace.rules_triggered.map((ruleId) => {
                      const exp = getRuleExplanation(ruleId);
                      return (
                        <div key={ruleId} className="p-2 rounded bg-slate-900 border border-slate-800">
                          <div className="font-bold text-teal-400">{exp.id}</div>
                          <div className="text-slate-300 font-medium">{exp.title}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <FileCheck className="w-8 h-8 text-slate-600 mx-auto" />
                <p>Click "Run Plan Synthesis" to review active therapy candidates and rule audit traces.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
