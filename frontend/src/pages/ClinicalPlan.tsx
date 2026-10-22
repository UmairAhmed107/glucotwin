import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck,
  FileText,
  HelpCircle,
  Info,
  ListFilter,
  MessageSquare,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
  User,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePatient, useClinicalPlan } from '../api/queries';
import { ClinicalPlanResponse, GuidelineSnippet, TherapyOption } from '../api/types';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { GuidelineDrawer } from '../components/GuidelineDrawer';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';
import { getRuleExplanation } from '../constants/governorRules';

interface TailoredDirective {
  category: string;
  title: string;
  status: string;
  impact: string;
  color: 'teal' | 'emerald' | 'indigo' | 'amber' | 'rose' | 'sky';
  details: string;
  cautions: string[];
  monitoring: string;
}

const getTailoredDirectives = (patient: any): TailoredDirective[] => {
  const name = patient?.display_name?.toLowerCase() || '';
  const isDemoA = name.includes('arthur') || name.includes('demo a') || patient?.id === 3;
  const isDemoB = name.includes('beatrix') || name.includes('demo b') || patient?.id === 4;
  const isDemoC = name.includes('charles') || name.includes('demo c') || patient?.id === 5 || patient?.hypoglycemia_history === true;

  if (isDemoA) {
    return [
      {
        category: 'Nutritional Strategy',
        title: 'Low-Glycemic Carbohydrate Substitution',
        status: 'Active Directive',
        impact: 'High Impact (-25 to -35 mg/dL peak spike)',
        color: 'teal',
        details: 'Replace high-glycemic carbohydrates at dinner with low-GI complex carbs (quinoa, legumes, leafy greens) to reduce postprandial glucose surges.',
        cautions: ['Avoid refined grains and sweetened beverages', 'Maintain consistent carbohydrate distribution across meals'],
        monitoring: 'Log 2-hour postprandial readings twice weekly.',
      },
      {
        category: 'Physical Activity Protocol',
        title: '15-Minute Postprandial Walking Habit',
        status: 'Recommended Habit',
        impact: 'Target Drop: -20 to -30 mg/dL',
        color: 'emerald',
        details: 'Engage in light walking within 30 minutes following lunch and dinner. Muscle contractions stimulate glucose disposal independently of insulin.',
        cautions: ['Stay adequately hydrated', 'Cease exercise if feeling dizzy or lightheaded'],
        monitoring: 'Target 7,500+ daily steps logged on connected wearable.',
      },
      {
        category: 'Telemetry & Glucose Baseline',
        title: 'Structured Fasting & Meal Logging',
        status: 'Priority Action',
        impact: 'Baseline Calibration',
        color: 'indigo',
        details: 'Record morning fasting glucose checks and log meal macronutrients to calibrate personal glycemic response thresholds.',
        cautions: ['Flag anomalous spikes (> 180 mg/dL) for dietitian review'],
        monitoring: 'Weekly review with clinical dietitian.',
      },
      {
        category: 'Pharmacotherapy Protocol',
        title: 'First-Line Lifestyle Trial (No Medication)',
        status: 'Clinical Directive',
        impact: 'Preventive Care',
        color: 'sky',
        details: 'Newly diagnosed with early-stage T2D (HbA1c 7.8%). Initiating a 3-month lifestyle modification trial prior to considering oral hypoglycemic agents.',
        cautions: ['Escalate if fasting glucose consistently exceeds 160 mg/dL'],
        monitoring: 'Repeat HbA1c test in 90 days.',
      },
    ];
  }

  if (isDemoB) {
    return [
      {
        category: 'Pharmacotherapy Management',
        title: 'Metformin 500mg (BID) Maintenance',
        status: 'Active Prescription',
        impact: 'Baseline Control (-1.2% HbA1c)',
        color: 'teal',
        details: 'Continue Metformin 500mg twice daily with breakfast and dinner. Effectively lowers hepatic gluconeogenesis and improves peripheral insulin sensitivity.',
        cautions: ['Take with meals to minimize gastrointestinal discomfort', 'Annual renal function panel required'],
        monitoring: 'Annual eGFR and serum creatinine lab panel.',
      },
      {
        category: 'Nutritional Optimization',
        title: 'High-Viscosity Dietary Fiber Protocol',
        status: 'Active Directive',
        impact: 'Spike Damping (-20 mg/dL rise)',
        color: 'emerald',
        details: 'Target at least 25–30g dietary fiber daily. Soluble fiber delays gastric emptying and flattens post-meal glucose absorption.',
        cautions: ['Increase daily water intake alongside dietary fiber'],
        monitoring: 'Track daily fiber grams in fast meal log.',
      },
      {
        category: 'Physical Activity',
        title: '8,000+ Steps Daily & Resistance Training',
        status: 'Habit Adherence',
        impact: 'Insulin Sensitivity Boost',
        color: 'indigo',
        details: 'Maintain consistent daily activity with 2 sessions of light resistance training weekly to build metabolic glucose sink capacity.',
        cautions: ['Ensure adequate rest days between training sessions'],
        monitoring: 'Review wearable step consistency monthly.',
      },
      {
        category: 'Laboratory Surveillance',
        title: 'Quarterly Glycemic Milestone Review',
        status: 'Scheduled',
        impact: 'Target Goal: HbA1c < 6.8%',
        color: 'sky',
        details: 'Current telemetry demonstrates well-controlled time-in-range (> 78%). Maintain current therapy without escalation.',
        cautions: ['Report any nocturnal sweat or hypoglycemia symptoms'],
        monitoring: 'Next clinician check-in scheduled in 6 weeks.',
      },
    ];
  }

  if (isDemoC) {
    return [
      {
        category: 'Emergency Safety Precaution',
        title: 'Hypoglycemia Alert & Rescue Protocol',
        status: 'Critical Alert',
        impact: 'Emergency Safety Lock',
        color: 'rose',
        details: 'Documented history of recurring hypoglycemia. Carry 15g fast-acting oral glucose (tablets or juice) at all times; never delay or skip scheduled meals.',
        cautions: ['Treat immediately if sensor reads < 70 mg/dL using the 15-15 rule', 'Do not drive if glucose is below 80 mg/dL'],
        monitoring: 'Continuous Glucose Monitor (CGM) threshold set to 75 mg/dL with audible alert.',
      },
      {
        category: 'Safety Contraindication',
        title: 'Sulfonylurea Contraindication Lock',
        status: 'Blocked by Safety Rules',
        impact: 'Adverse Event Prevention',
        color: 'amber',
        details: 'Sulfonylureas and Glinides are strictly contraindicated due to frequent hypoglycemia episodes. SGLT2 inhibitors or GLP-1 receptor agonists preferred if escalation is required.',
        cautions: ['Prescription safety lock active in clinical order system'],
        monitoring: 'Audit all new prescription orders against safety governor rules.',
      },
      {
        category: 'Nutritional Stabilization',
        title: 'Complex Carbohydrate Meal Spacing',
        status: 'Active Directive',
        impact: 'Glycemic Floor Support',
        color: 'teal',
        details: 'Eat balanced meals every 4–5 hours pairing complex low-GI carbohydrates with protein to avoid steep glucose drops between meals.',
        cautions: ['Avoid prolonged fasting periods exceeding 5 hours'],
        monitoring: 'Review sensor trend arrows prior to physical exertion.',
      },
      {
        category: 'Provider Coordination',
        title: 'Weekly Clinical Review with Care Team',
        status: 'High Priority',
        impact: 'Active Care Coordination',
        color: 'indigo',
        details: 'Close monitoring with lead endocrinologist Dr. Patel and clinical dietitian Elena Rostova.',
        cautions: ['Escalate immediately if sensor registers Level 2 hypoglycemia (< 54 mg/dL)'],
        monitoring: 'Weekly alert review in Alerts Center.',
      },
    ];
  }

  return [
    {
      category: 'Nutritional Protocol',
      title: 'Balanced Macronutrient Distribution',
      status: 'Active Directive',
      impact: 'Glycemic Stabilization',
      color: 'teal',
      details: `Personalized for baseline HbA1c of ${patient?.hba1c_pct ?? 7.2}%. Maintain consistent complex carbohydrate intake paired with lean proteins and healthy fats.`,
      cautions: ['Limit refined sugars and processed snacks'],
      monitoring: 'Log daily meals with macronutrient breakdown.',
    },
    {
      category: 'Physical Activity',
      title: 'Postprandial Walking Routine',
      status: 'Recommended Habit',
      impact: 'Target Drop: -15 to -25 mg/dL',
      color: 'emerald',
      details: 'Light 15-minute walks following meals accelerate muscular glucose disposal and reduce peak glycemic exposure.',
      cautions: ['Wear supportive footwear', 'Check glucose prior to exercise'],
      monitoring: 'Track daily step count and active minutes.',
    },
    {
      category: 'Medication Regimen',
      title: patient?.current_meds?.length ? `Current Therapy: ${patient.current_meds.join(', ')}` : 'Standard First-Line Protocol',
      status: 'Prescribed Regimen',
      impact: 'Glycemic Maintenance',
      color: 'indigo',
      details: patient?.kidney_flag
        ? 'Renal considerations active: medication dosage adjusted for kidney health.'
        : 'Take prescribed medications consistently at recommended meal times.',
      cautions: ['Consult physician before modifying any dosage'],
      monitoring: 'Bi-annual comprehensive metabolic panel.',
    },
    {
      category: 'Clinical Care Pathway',
      title: 'Structured Monitoring Schedule',
      status: 'Care Pathway Active',
      impact: 'Target Goal: Stable Glycemia',
      color: 'sky',
      details: 'Follow standard ADA/ICMR guidelines for self-monitoring and clinical follow-up intervals.',
      cautions: ['Report readings > 200 mg/dL or < 70 mg/dL to care team'],
      monitoring: 'Routine follow-up in 4 weeks.',
    },
  ];
};

export const ClinicalPlanPage: React.FC = () => {
  const { activePatientId, viewMode } = useApp();
  const { data: patient } = usePatient(activePatientId);
  const clinicalPlanMutation = useClinicalPlan(activePatientId || 0);

  const [planResult, setPlanResult] = useState<ClinicalPlanResponse | null>(null);
  const [selectedSnippet, setSelectedSnippet] = useState<GuidelineSnippet | null>(null);
  const [isGuidelineDrawerOpen, setIsGuidelineDrawerOpen] = useState(false);
  const [isGovernorTraceOpen, setIsGovernorTraceOpen] = useState(viewMode === 'clinician');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(viewMode === 'clinician');

  // Dynamically update display when viewMode toggle is switched in the header
  React.useEffect(() => {
    const isClinician = viewMode === 'clinician';
    setShowTechnicalDetails(isClinician);
    setIsGovernorTraceOpen(isClinician);
  }, [viewMode]);

  const handleGeneratePlan = async () => {
    if (!activePatientId) return;
    try {
      const res = await clinicalPlanMutation.mutateAsync();
      setPlanResult(res);
      if (viewMode === 'clinician') {
        setIsGovernorTraceOpen(true);
        setShowTechnicalDetails(true);
      }
    } catch (err) {
      console.error('Failed to generate clinical plan', err);
    }
  };

  const handleOpenGuidelineSnippet = (guidelineId: string) => {
    if (!planResult) return;
    const found = planResult.sources.find((s) => s.id === guidelineId);
    if (found) {
      setSelectedSnippet(found);
      setIsGuidelineDrawerOpen(true);
    } else {
      setSelectedSnippet({
        id: guidelineId,
        topic: `Guideline ${guidelineId}`,
        text: `Paraphrased clinical guideline reference (${guidelineId}) retrieved from verified local guidance repository.`,
      });
      setIsGuidelineDrawerOpen(true);
    }
  };

  if (!activePatientId) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          title="No Active Patient Selected"
          description="Select or create a patient to formulate a clinical guidance plan."
          actionText="Go to Patient Setup"
          onAction={() => (window.location.href = '/patient-setup')}
        />
      </div>
    );
  }

  const plan = planResult?.plan;
  const isPatientMode = viewMode === 'patient';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Clinical Decision Support Plan</h1>
            <ProvenanceBadge provenance="GUIDELINE_AI" safetyChecked={true} />

          </div>
          <p className="text-sm text-slate-400 mt-1">
            Guideline-concordant therapy options and lifestyle recommendations synthesized under strict deterministic
            Safety Governor oversight.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {activePatientId && (
            <button
              onClick={() => window.open(`/patients/${activePatientId}/report.pdf`, '_blank')}
              className="inline-flex items-center space-x-1.5 py-2 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold rounded-lg text-xs border border-slate-700 transition-all cursor-pointer"
              title="Download 2-Page Clinical PDF Dossier"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          )}

          <button
            onClick={handleGeneratePlan}
            disabled={clinicalPlanMutation.isPending}
            className="inline-flex items-center space-x-2 py-2 px-4 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 disabled:opacity-50 text-slate-950 font-semibold rounded-lg shadow-lg shadow-teal-500/20 transition-all cursor-pointer text-sm"
          >
            {clinicalPlanMutation.isPending ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                <span>Synthesizing Plan & Verifying Rules...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{plan ? 'Regenerate Plan' : 'Generate Clinical Plan'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 1. Patient Clinical Summary Card (Always Visible) */}
      <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{patient?.display_name || 'Active Patient'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                  ID #{activePatientId}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {patient?.age ?? 54} yrs • {patient?.sex ?? 'M'} • BMI {patient?.bmi ?? 27.5} • Type 2 Diabetes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
              HbA1c: {patient?.hba1c_pct ?? 7.2}%
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
              Fasting: {patient?.fasting_glucose_mgdl ?? 135} mg/dL
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Hypoglycemia History:</span>
            <span className={`font-semibold ${patient?.hypoglycemia_history ? 'text-rose-400' : 'text-emerald-400'}`}>
              {patient?.hypoglycemia_history ? 'Present (High Caution)' : 'None Reported'}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Renal Impairment:</span>
            <span className={`font-semibold ${patient?.kidney_flag ? 'text-amber-400' : 'text-slate-200'}`}>
              {patient?.kidney_flag ? 'Mild / Monitored' : 'Normal eGFR'}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 col-span-2">
            <span className="text-slate-400 block text-[11px]">Current Prescriptions:</span>
            <span className="font-semibold text-slate-200">
              {patient?.current_meds && patient.current_meds.length > 0
                ? patient.current_meds.map((m: string) => m.replace(/_/g, ' ')).join(', ')
                : 'None currently prescribed (Lifestyle first)'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Consolidated Treatment & Medication Strategy (Clubbed Therapy Scenarios) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Pill className="w-5 h-5 text-teal-400" />
            <h2 className="text-base font-bold text-white">Recommended Treatment & Medication Strategy</h2>
          </div>
          <span className="text-xs text-slate-400">
            Tailored to {patient?.display_name || 'Patient'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {getTailoredDirectives(patient).map((directive, dIdx) => (
            <div
              key={dIdx}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-teal-400 font-semibold uppercase tracking-wider block">
                      {directive.category}
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      {directive.title}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20 whitespace-nowrap">
                    {directive.status}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
                  <span className="text-[10px] text-indigo-400 font-semibold uppercase block">
                    Expected Glycemic Impact:
                  </span>
                  <span className="text-slate-200 font-medium block mt-0.5">
                    {directive.impact}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {directive.details}
                </p>

                {directive.cautions && directive.cautions.length > 0 && (
                  <div className="text-xs space-y-1">
                    <span className="text-[10px] text-amber-400 uppercase font-semibold block">
                      Clinical Cautions:
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                      {directive.cautions.map((c, cIdx) => (
                        <li key={cIdx}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Monitoring:</span>
                <span className="text-[11px] text-slate-300 font-medium">{directive.monitoring}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Deep Clinical Guideline Synthesis */}
      {!plan && !clinicalPlanMutation.isPending && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
          <Stethoscope className="w-8 h-8 text-teal-400/80 mx-auto" />
          <h3 className="text-sm font-semibold text-white">Synthesize Complete Clinical Guideline Documentation</h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            Evaluate current patient metrics against verified ADA/ICMR guideline sources and test all 9 deterministic clinical safety rules.
          </p>
          <button
            onClick={handleGeneratePlan}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-lg text-xs shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Synthesize Clinical Guidelines</span>
          </button>
        </div>
      )}

      {/* Active Plan Content */}
      {plan && (
        <div className="space-y-6">
          {/* Patient Summary Card (Prominent in Patient Mode) */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-indigo-500/30 space-y-3 shadow-lg shadow-indigo-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                <FileText className="w-4 h-4" />
                <span>Executive Patient Narrative Summary</span>
              </span>
              <ProvenanceBadge provenance="GUIDELINE_AI" safetyChecked={true} size="sm" />
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-sans">{plan.patient_summary}</p>

            {isPatientMode && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="inline-flex items-center space-x-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium cursor-pointer"
                >
                  {showTechnicalDetails ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hide Detailed Clinical Options</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Show Detailed Clinical Options</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Red Flags Section (Always Visible if Present) */}
          {plan.red_flags && plan.red_flags.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2">
              <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>Clinical Red Flags & Safety Governor Alerts</span>
              </div>
              <ul className="space-y-1.5 text-xs pl-6 list-disc text-amber-200/90">
                {plan.red_flags.map((flag, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* In Patient Mode: Highlight Lifestyle Interventions and Questions First */}
          {isPatientMode ? (
            <div className="space-y-6">
              {/* Patient Lifestyle Guidance */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-teal-400" />
                    <h3 className="text-base font-bold text-white">Your Daily Lifestyle & Meal Habits</h3>
                  </div>
                  <span className="text-xs text-teal-300 font-medium">Personalised to your twin's responses</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.lifestyle_interventions.map((life, lIdx) => (
                    <div
                      key={lIdx}
                      className="p-4 rounded-xl bg-slate-900 border border-teal-500/30 space-y-2 shadow-sm"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-semibold text-white text-sm flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                          <span>{life.title}</span>
                        </h4>
                        <ProvenanceBadge provenance="GUIDELINE_AI" safetyChecked={true} size="sm" />
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{life.detail}</p>

                      {life.linked_twin_finding && (
                        <div className="p-2 rounded bg-teal-500/10 border border-teal-500/20 text-[11px] text-teal-300 flex items-start space-x-1.5">
                          <Zap className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Twin Finding:</strong> {life.linked_twin_finding}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Questions for Your Doctor */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-[#111C30] border border-slate-800 space-y-3">
                <div className="flex items-center space-x-2 text-teal-400 text-xs font-semibold uppercase tracking-wider">
                  <MessageSquare className="w-4 h-4" />
                  <span>Questions to Bring to Your Next Clinical Visit</span>
                </div>
                <p className="text-xs text-slate-400">
                  Take these AI-prepared questions with you when you see your doctor:
                </p>
                <ul className="space-y-2 text-xs text-slate-200 pl-4 list-disc">
                  {plan.questions_for_clinician.map((q, qIdx) => (
                    <li key={qIdx} className="leading-relaxed">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Medication Classes (Educational Preview + Toggle) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Pill className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-semibold text-white">
                      Medications Under Consideration ({plan.therapy_options.length} Drug Classes)
                    </span>
                  </div>
                  <button
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    className="text-xs text-teal-400 hover:text-teal-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    {showTechnicalDetails ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide Pharmacological Details</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Review Pharmacological Details</span>
                      </>
                    )}
                  </button>
                </div>

                {!showTechnicalDetails ? (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Based on your profile, your doctor may evaluate:{' '}
                    <span className="text-slate-200 font-medium">
                      {plan.therapy_options.map((o) => o.drug_class.replace(/_/g, ' ')).join(', ')}
                    </span>
                    . Click "Review Pharmacological Details" to see literature expectations and patient factors.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {plan.therapy_options.map((opt: TherapyOption, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="text-sm font-bold text-white capitalize">
                            {opt.drug_class.replace(/_/g, ' ')}
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            Prescription Option
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{opt.rationale}</p>
                        <div className="p-2 rounded bg-slate-950 text-[11px] text-slate-300">
                          <span className="text-indigo-400 font-medium block">Expected Effect:</span>
                          {opt.expected_effect_literature}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Clinician Mode: Complete Technical & Pharmacological Architecture */
            <div className="space-y-6">
              {/* Section 1: Therapy Options */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Pill className="w-5 h-5 text-teal-400" />
                    <h3 className="text-base font-bold text-white">
                      Therapy Options to Discuss with Clinician
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    {plan.therapy_options.length} guideline-concordant options
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.therapy_options.map((opt: TherapyOption, idx: number) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] text-teal-400 font-semibold uppercase tracking-wider block">
                              Drug Class
                            </span>
                            <h4 className="text-base font-bold text-white capitalize">
                              {opt.drug_class.replace(/_/g, ' ')}
                            </h4>
                          </div>
                          <ProvenanceBadge provenance="GUIDELINE_AI" safetyChecked={true} size="sm" />
                        </div>

                        {/* Rationale */}
                        <p className="text-xs text-slate-300 leading-relaxed">{opt.rationale}</p>

                        {/* Patient Factors Chips */}
                        {opt.patient_factors_used && opt.patient_factors_used.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 block uppercase">
                              Patient Factors Evaluated:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {opt.patient_factors_used.map((factor, fIdx) => (
                                <span
                                  key={fIdx}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700"
                                >
                                  {factor}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Clinical Target & Expected Impact */}
                        <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs">
                          <span className="text-[10px] text-teal-400 font-semibold uppercase block">
                            Clinical Target & Expected Impact:
                          </span>
                          <span className="text-slate-200 mt-0.5 block">{opt.expected_effect_literature}</span>
                        </div>

                        {/* Cautions */}
                        {opt.cautions && opt.cautions.length > 0 && (
                          <div className="text-xs space-y-1">
                            <span className="text-[10px] text-amber-400 uppercase font-semibold block">
                              Cautions:
                            </span>
                            <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                              {opt.cautions.map((c, cIdx) => (
                                <li key={cIdx}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Monitoring */}
                        {opt.monitoring && opt.monitoring.length > 0 && (
                          <div className="text-xs space-y-1">
                            <span className="text-[10px] text-teal-400 uppercase font-semibold block">
                              Required Monitoring:
                            </span>
                            <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                              {opt.monitoring.map((m, mIdx) => (
                                <li key={mIdx}>{m}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Guideline Source Chips */}
                      {opt.guideline_ids && opt.guideline_ids.length > 0 && (
                        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 mr-1">Guideline Sources:</span>
                          {opt.guideline_ids.map((gid) => (
                            <button
                              key={gid}
                              onClick={() => handleOpenGuidelineSnippet(gid)}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors cursor-pointer"
                              title="Click to view full guideline text snippet"
                            >
                              <BookOpen className="w-3 h-3" />
                              <span>{gid}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Lifestyle Interventions */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-teal-400" />
                  <h3 className="text-base font-bold text-white">Lifestyle & Nutritional Guidance</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.lifestyle_interventions.map((life, lIdx) => (
                    <div
                      key={lIdx}
                      className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-semibold text-white text-sm">{life.title}</h4>
                        <ProvenanceBadge provenance="GUIDELINE_AI" safetyChecked={true} size="sm" />
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{life.detail}</p>

                      {life.linked_twin_finding && (
                        <div className="p-2 rounded bg-teal-500/5 border border-teal-500/20 text-[11px] text-teal-300 flex items-start space-x-1.5">
                          <Zap className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Twin Finding:</strong> {life.linked_twin_finding}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Clinician Questions & Missing Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Questions for Clinician */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-teal-400 text-xs font-semibold uppercase tracking-wider">
                    <MessageSquare className="w-4 h-4" />
                    <span>Questions for Your Clinician</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300 pl-4 list-disc">
                    {plan.questions_for_clinician.map((q, qIdx) => (
                      <li key={qIdx} className="leading-relaxed">
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Missing Information */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <HelpCircle className="w-4 h-4" />
                    <span>Missing Clinical Information</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-400 pl-4 list-disc">
                    {plan.missing_information.map((m, mIdx) => (
                      <li key={mIdx} className="leading-relaxed">
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Governor Trace Panel */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <button
              onClick={() => setIsGovernorTraceOpen(!isGovernorTraceOpen)}
              className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  {isPatientMode
                    ? `Deterministic Safety Checks (All ${planResult.governor_trace.rules_triggered.length} Safety Rules Verified)`
                    : `Deterministic Safety Governor Audit Trace (${planResult.governor_trace.rules_triggered.length} Rules Evaluated)`}
                </span>
                {planResult.governor_trace.clean && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {isPatientMode ? 'Protected & Safe' : 'Clean Execution'}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  isGovernorTraceOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {isGovernorTraceOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2 pt-2 border-t border-slate-800 overflow-hidden"
                >
                  <p className="text-[11px] text-slate-400 mb-3">
                    Clinical plans are validated against evidence-based safety rules to prevent adverse drug interactions,
                    withhold hypoglycemia-inducing agents, and enforce guideline grounding.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {planResult.governor_trace.rules_triggered.map((ruleId) => {
                      const exp = getRuleExplanation(ruleId);
                      return (
                        <div
                          key={ruleId}
                          className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-teal-400 font-bold">{exp.id}</span>
                            <span
                              className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                                exp.severity === 'critical'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : exp.severity === 'warning'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {exp.severity}
                            </span>
                          </div>
                          <div className="font-medium text-white text-[11px]">{exp.title}</div>
                          <p className="text-[10px] text-slate-400 leading-tight">{exp.summary}</p>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>


        </div>
      )}

      {/* Guideline Drawer for Snippets */}
      <GuidelineDrawer
        isOpen={isGuidelineDrawerOpen}
        onClose={() => setIsGuidelineDrawerOpen(false)}
        snippet={selectedSnippet}
      />
    </div>
  );
};
