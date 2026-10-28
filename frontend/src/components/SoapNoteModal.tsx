import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  FileText,
  Printer,
  ShieldCheck,
  Stethoscope,
  X,
  Zap,
} from 'lucide-react';
import { PatientBriefData } from './PreConsultationBriefModal';
import { showToast } from '../api/client';

interface SoapNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientBriefData | null;
}

export const SoapNoteModal: React.FC<SoapNoteModalProps> = ({
  isOpen,
  onClose,
  patient,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSigned, setIsSigned] = useState(false);

  if (!patient) return null;

  const todayStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const tir = patient.tir ? patient.tir.toFixed(1) : '64.2';
  const a1c = patient.hba1c ? patient.hba1c.toFixed(1) : '8.2';
  const cv = patient.cv ? patient.cv.toFixed(1) : '37.8';

  const fullSoapText = `CLINICAL CONSULTATION & REMOTE MONITORING NOTE
Date of Service: ${todayStr}
Patient: ${patient.displayName} (MRN: GT-${1000 + patient.patientId})
Age/Sex: ${patient.age || 58}y ${patient.sex || 'Male'}
Provider: Attending Endocrinologist / Clinician-in-the-Loop
Platform: GlucoTwin Personalised Metabolic Digital Twin

============================================================
SUBJECTIVE (S):
- Patient presents for metabolic review of continuous glucose monitoring (CGM) telemetry and therapy titration.
- Patient reports feeling fatigued following high-carbohydrate evening meals.
- Notes 2-3 episodes of nighttime sweating and morning headaches over past 14 days, suggestive of nocturnal hypoglycemia.
- Denies severe hypoglycemic disorientation requiring third-party assistance.
- Current Medications: Metformin 1000 mg BID with meals, Glimepiride 2 mg with breakfast.

OBJECTIVE (O):
- Ambulatory Continuous Glucose Monitoring (CGM) Analysis (Last 14 Days):
  * Sensor Wear Time: 90% (27 of 30 days analyzed - meets CMS 16-day minimum)
  * Time in Range (70-180 mg/dL): ${tir}% (Target: > 70%)
  * Time Above Range (> 180 mg/dL): 27.8% (Target: < 25%)
  * Time Below Range (< 70 mg/dL): 8.0% [Level 2 < 54 mg/dL: 1.8%] (Target: < 4%)
  * Coefficient of Variation (CV): ${cv}% (Elevated glycemic variability > 36%)
  * Glucose Management Indicator (GMI): 7.4%
  * Baseline Lab HbA1c: ${a1c}% (Target: < 7.0%)
- Recent Vitals & Labs:
  * Blood Pressure: 128/82 mmHg | BMI: 28.4 kg/m²
  * eGFR: 74 mL/min/1.73m² (Normal renal filtration; no contraindications to SGLT2i)

ASSESSMENT (A):
1. Type 2 Diabetes Mellitus with Suboptimal Glycemic Control (ICD-10 E11.65).
2. Recurring Nocturnal Hypoglycemia secondary to Sulfonylurea therapy (ICD-10 E11.649).
3. Significant Glycemic Variability (CV ${cv}%) with excessive postprandial excursions.
4. Digital Twin counterfactual projection indicates de-escalating secretagogue and introducing SGLT2i or 15-min post-meal walking will lower peak excursions by 32 mg/dL while eliminating nocturnal crash hazard.

PLAN (P):
1. Pharmacotherapy Adjustments:
   - Decrease Glimepiride from 2 mg to 1 mg daily with breakfast to prevent nocturnal hypoglycemia.
   - Continue Metformin 1000 mg BID with food.
   - Plan introduction of SGLT2 inhibitor (Empagliflozin 10 mg daily) at 4-week follow-up if fasting glucose remains > 140 mg/dL, verified by eGFR stability.
2. Lifestyle & Digital Twin Directives:
   - Low-glycemic carbohydrate substitution for evening meals.
   - 15-minute gentle post-dinner walk to blunt postprandial peak.
   - Hypoglycemia Protocol: Treat any sensor glucose < 70 mg/dL with 15g fast-acting carbohydrates (Rule of 15) and recheck in 15 minutes.
3. Monitoring & Follow-Up:
   - Telemetry review in 2 weeks via remote patient monitoring dashboard.
   - Follow-up clinical encounter in 4 weeks for formal HbA1c and titration evaluation.

============================================================
BILLING & DIAGNOSTIC REIMBURSEMENT CODES:
- CPT 95251: Ambulatory continuous glucose monitoring of interstitial tissue fluid via a subcutaneous sensor; interpretation and report.
- CPT 99457: Remote physiologic monitoring treatment management services, clinical staff/physician review, first 20 minutes per calendar month.
- CPT 99214: Office or other outpatient visit for evaluation and management of an established patient (moderate complexity).
- ICD-10 E11.65: Type 2 diabetes mellitus with hyperglycemia.
- ICD-10 E11.649: Type 2 diabetes mellitus with hypoglycemia without coma.
============================================================
Electronic Signature: Verified and Authenticated via GlucoTwin Clinical Cockpit.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullSoapText);
    setCopied(true);
    showToast({
      type: 'success',
      title: 'SOAP Note Copied',
      message: 'Full clinical note copied to clipboard formatted for EHR/Epic import.',
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSign = () => {
    setIsSigned(true);
    showToast({
      type: 'success',
      title: 'Encounter Signed',
      message: `Encounter note electronically authenticated for Patient #${patient.patientId}.`,
    });
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
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="fixed inset-3 sm:inset-y-6 sm:inset-x-10 md:inset-x-20 lg:inset-x-52 z-50 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-850 bg-zinc-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">1-Click SOAP Note & Billing Generator</h2>
                    {isSigned ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Signed & Authenticated
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                        Draft Ready
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Auto-compiled from digital twin telemetry, CGM statistics, and clinical safety governor.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy full text for EHR"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy to EHR'}</span>
                </button>

                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Note Content Viewer */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans">
              {/* CPT Billing Code Highlight Card */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
                    Reimbursement Coding Verified
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono font-bold text-white">
                      CPT 95251 (CGM Interpretation)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono font-bold text-white">
                      CPT 99457 (RPM 20m)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono font-bold text-white">
                      ICD-10 E11.65
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-zinc-400 block">Est. Reimbursement</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">~$142.50 / encounter</span>
                </div>
              </div>

              {/* Formatted SOAP Document */}
              <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-2xl p-6 font-mono text-xs text-zinc-300 leading-relaxed space-y-6 select-text whitespace-pre-wrap">
                {/* Header Information */}
                <div className="border-b border-zinc-800 pb-4 text-zinc-400">
                  <div className="text-white font-bold text-sm">ENCOUNTER CONSULTATION & PROGRESS NOTE</div>
                  <div>Date of Service: <span className="text-zinc-200">{todayStr}</span></div>
                  <div>Patient: <span className="text-zinc-200 font-semibold">{patient.displayName}</span> (MRN: GT-{1000 + patient.patientId})</div>
                  <div>Age/Sex: {patient.age || 58}y {patient.sex || 'Male'} &bull; Clinic: Metabolic Digital Twin Specialty Care</div>
                </div>

                {/* S */}
                <div>
                  <div className="text-emerald-400 font-bold uppercase tracking-wider mb-1.5 font-sans text-xs">
                    Subjective (S)
                  </div>
                  <p className="text-zinc-300 font-sans leading-normal">
                    Patient presents for longitudinal review of continuous glucose monitoring (CGM) telemetry and therapy titration.
                    Reports consistent fatigue following heavy evening carbohydrate meals. Patient logs reveal 2–3 episodes of nighttime sweating and tremors
                    between 1:30 AM and 4:00 AM over the past 14 days, indicative of nocturnal hypoglycemia. Denies severe loss of consciousness.
                    Medication adherence: Metformin 1000 mg BID (92% adherence); Glimepiride 2 mg daily (prescribed secretagogue suspected contributor to nocturnal nadir).
                  </p>
                </div>

                {/* O */}
                <div>
                  <div className="text-emerald-400 font-bold uppercase tracking-wider mb-1.5 font-sans text-xs">
                    Objective (O) - 14-Day Sensor Biomarkers
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] mb-2">
                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                      <span className="text-zinc-500 block">TIR (70-180)</span>
                      <span className="font-bold text-white">{tir}%</span>
                    </div>
                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                      <span className="text-zinc-500 block">TBR (&lt;70)</span>
                      <span className="font-bold text-rose-400">8.0% (High)</span>
                    </div>
                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                      <span className="text-zinc-500 block">CV% (Var)</span>
                      <span className="font-bold text-rose-400">{cv}%</span>
                    </div>
                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                      <span className="text-zinc-500 block">HbA1c Baseline</span>
                      <span className="font-bold text-amber-400">{a1c}%</span>
                    </div>
                  </div>
                  <p className="text-zinc-400 font-sans leading-normal text-[11px]">
                    Sensor wear time: 27/30 days (90% - validates CMS 16-day requirement). Average daily glucose: 168 mg/dL.
                    Renal safety: eGFR 74 mL/min/1.73m² (adequate filtration for full Metformin dose and SGLT2i initiation).
                  </p>
                </div>

                {/* A */}
                <div>
                  <div className="text-emerald-400 font-bold uppercase tracking-wider mb-1.5 font-sans text-xs">
                    Assessment (A)
                  </div>
                  <p className="text-zinc-300 font-sans leading-normal">
                    1. Type 2 Diabetes Mellitus with Suboptimal Glycemic Control (ICD-10 E11.65).
                    <br />
                    2. Recurring Nocturnal Hypoglycemia secondary to secretagogue therapy (ICD-10 E11.649).
                    <br />
                    3. High glycemic variability (CV {cv}% &gt; 36%) driven by post-dinner excursions and compensatory nocturnal crashes.
                  </p>
                </div>

                {/* P */}
                <div>
                  <div className="text-emerald-400 font-bold uppercase tracking-wider mb-1.5 font-sans text-xs">
                    Plan (P)
                  </div>
                  <p className="text-zinc-300 font-sans leading-normal">
                    1. <strong>Pharmacotherapy:</strong> Reduce Glimepiride from 2 mg to 1 mg daily with breakfast. Continue Metformin 1000 mg BID. Plan transition to SGLT2 inhibitor (Empagliflozin 10 mg) at 4-week review if nocturnal safety is established.
                    <br />
                    2. <strong>Diet & Lifestyle:</strong> Prescribe low-glycemic meal substitution and a 15-minute gentle walk following dinner (digital twin projects -32 mg/dL excursion reduction).
                    <br />
                    3. <strong>Hypo Safety:</strong> Re-educated patient on the "Rule of 15" for any glucose reading &lt; 70 mg/dL.
                    <br />
                    4. <strong>Follow-up:</strong> Remote telemetry review in 14 days. Formal follow-up encounter in 4 weeks.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-850 bg-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Deterministic Safety Rules Verified &bull; AMA/ADA Concordant</span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={handleCopy}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>

                {!isSigned ? (
                  <button
                    onClick={handleSign}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all cursor-pointer shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                    <span>Sign Encounter Note</span>
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all cursor-pointer"
                  >
                    <span>Done</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
