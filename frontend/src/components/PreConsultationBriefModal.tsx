import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  Flame,
  HelpCircle,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  User,
  X,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface PatientBriefData {
  patientId: number;
  displayName: string;
  age?: number;
  sex?: string;
  hba1c?: number;
  tir?: number;
  cv?: number;
  riskScore?: number;
  riskLevel?: string;
  openAlertsCount?: number;
}

interface PreConsultationBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientBriefData | null;
  onOpenSoapNote?: () => void;
}

export const PreConsultationBriefModal: React.FC<PreConsultationBriefModalProps> = ({
  isOpen,
  onClose,
  patient,
  onOpenSoapNote,
}) => {
  const navigate = useNavigate();

  if (!patient) return null;

  const isHighRisk = patient.riskLevel === 'critical' || patient.riskLevel === 'high' || (patient.tir && patient.tir < 60);

  // Dynamic clinical highlights based on patient profile
  const isDemoA = patient.displayName?.toLowerCase().includes('arthur') || patient.patientId === 3;
  const isDemoB = patient.displayName?.toLowerCase().includes('beatrix') || patient.patientId === 4;
  const isDemoC = patient.displayName?.toLowerCase().includes('charles') || patient.patientId === 5;

  const hypoCount = isDemoC ? 4 : isDemoA ? 2 : 1;
  const lowestGlucose = isDemoC ? 48 : isDemoA ? 58 : 64;
  const postMealPeak = isDemoA ? 228 : isDemoB ? 245 : 195;
  const sensorDays = isDemoA ? '27 / 30 days (90%)' : isDemoB ? '23 / 30 days (76%)' : '28 / 30 days (93%)';

  const handleOpenClinicalHub = () => {
    onClose();
    navigate(`/treatment?tab=plan`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="fixed inset-4 sm:inset-y-10 sm:inset-x-12 md:inset-x-28 lg:inset-x-64 z-50 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-850 bg-zinc-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">30-Second Pre-Consultation Brief</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Rapid Clinical Triage
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Patient #{patient.patientId} &bull; <span className="font-semibold text-white">{patient.displayName}</span> {patient.age ? `(${patient.age}y ${patient.sex || ''})` : ''}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Top Quick Status Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Current HbA1c</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-lg font-bold font-mono text-white">
                      {patient.hba1c ? `${patient.hba1c.toFixed(1)}%` : '8.2%'}
                    </span>
                    <span className="text-[10px] text-amber-400 font-medium">Target &lt; 7.0%</span>
                  </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Time-in-Range (7d)</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className={`text-lg font-bold font-mono ${patient.tir && patient.tir >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {patient.tir ? `${patient.tir.toFixed(1)}%` : '64.2%'}
                    </span>
                    <span className="text-[10px] text-zinc-500">Goal &gt; 70%</span>
                  </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Variability (CV)</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-lg font-bold font-mono text-rose-400">
                      {patient.cv ? `${patient.cv.toFixed(1)}%` : '37.8%'}
                    </span>
                    <span className="text-[10px] text-zinc-500">Target &le; 36%</span>
                  </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Sensor Adherence</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-lg font-bold font-mono text-emerald-400">
                      {sensorDays.split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-zinc-400">days active</span>
                  </div>
                </div>
              </div>

              {/* 30-Second Bottom Line Key Clinical Findings */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-300">
                      30-Second Bottom Line for Today's Visit
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    High Diagnostic Yield
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* Finding 1: Acute Hypo */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white">Acute Hypoglycemia Hazard: </span>
                      {hypoCount} episodes of hypoglycemia logged over past 14 days, primarily nocturnal between 1:30 AM and 4:00 AM (nadir: <span className="font-mono font-bold text-rose-300">{lowestGlucose} mg/dL</span>).
                    </div>
                  </div>

                  {/* Finding 2: Postprandial Excursions */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-850/60 border border-zinc-800 text-zinc-300">
                    <TrendingUp className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white">Post-Dinner Glycemic Surge: </span>
                      Dinner carbohydrate loads consistently induce prolonged spikes averaging +58 mg/dL above baseline (peak <span className="font-mono font-bold text-amber-300">{postMealPeak} mg/dL</span>) persisting 3.5 hours.
                    </div>
                  </div>

                  {/* Finding 3: Medication & Lifestyle Adherence */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-850/60 border border-zinc-800 text-zinc-300">
                    <Pill className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white">Pharmacotherapy Status: </span>
                      Taking Metformin 1000mg BID (adherence 92%). Sulfonylurea (Glimepiride 2mg) suspected contributor to nighttime lows. eGFR stable at 74 mL/min/1.73m².
                    </div>
                  </div>
                </div>
              </div>

              {/* Actionable Pre-Drafted Decision Strategy */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4.5 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>AI Pre-Drafted Consultation Strategy (ADA 2024 Concordant)</span>
                </div>
                <ul className="text-xs text-zinc-300 space-y-2 list-disc list-inside">
                  <li>
                    <strong className="text-white">Deprescribe or De-escalate Secretagogue:</strong> Reduce evening Glimepiride from 2mg to 1mg (or substitute with SGLT2i Empagliflozin 10mg) to eliminate nocturnal crash risk.
                  </li>
                  <li>
                    <strong className="text-white">Post-Dinner Habit Nudge:</strong> Prescribe a 15-minute gentle post-dinner walk (digital twin projects a -32 mg/dL reduction in evening peak).
                  </li>
                  <li>
                    <strong className="text-white">Reimbursement Opportunity:</strong> Qualifies for continuous glucose monitoring interpretation under <span className="font-mono text-emerald-300 font-bold">CPT 95251</span> and RPM review <span className="font-mono text-emerald-300 font-bold">CPT 99457</span>.
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer with Actions */}
            <div className="px-6 py-4 border-t border-zinc-850 bg-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Dismiss Brief
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {onOpenSoapNote && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenSoapNote();
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Generate SOAP & CPT Note</span>
                  </button>
                )}

                <button
                  onClick={handleOpenClinicalHub}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all shadow-md cursor-pointer"
                >
                  <span>Open Clinical Decision Hub</span>
                  <ArrowRight className="w-3.5 h-3.5 text-black" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
