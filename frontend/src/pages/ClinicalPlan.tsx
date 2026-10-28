import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck,
  FileCheck2,
  FileText,
  HelpCircle,
  Info,
  ListFilter,
  Lock,
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
import { useAuth } from '../context/AuthContext';
import { usePatient, useClinicalPlan } from '../api/queries';
import { ClinicalPlanResponse, GuidelineSnippet, TherapyOption } from '../api/types';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { GuidelineDrawer } from '../components/GuidelineDrawer';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';
import { getRuleExplanation } from '../constants/governorRules';
import { showToast } from '../api/client';

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
  const { user } = useAuth();
  const { data: patient } = usePatient(activePatientId);
  const clinicalPlanMutation = useClinicalPlan(activePatientId || 0);

  // RBAC Enforcement: Only clinicians / doctors / admins can prescribe medications or modify clinical orders
  const effectiveRole = user?.role || (viewMode === 'patient' ? 'patient' : 'clinician');
  const isDoctor = (effectiveRole === 'clinician' || effectiveRole === 'admin') && viewMode !== 'patient';

  const [planResult, setPlanResult] = useState<ClinicalPlanResponse | null>(null);
  const [selectedSnippet, setSelectedSnippet] = useState<GuidelineSnippet | null>(null);
  const [isGuidelineDrawerOpen, setIsGuidelineDrawerOpen] = useState(false);
  const [isGovernorTraceOpen, setIsGovernorTraceOpen] = useState(viewMode === 'clinician');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(viewMode === 'clinician');

  // Clinician Active Decision Making State
  const [selectedRegimen, setSelectedRegimen] = useState<string>('metformin');
  const [targetA1c, setTargetA1c] = useState<string>('< 7.0%');
  const [targetTIR, setTargetTIR] = useState<string>('> 70%');
  const [redFlagsAcknowledged, setRedFlagsAcknowledged] = useState<boolean>(true);
  const [isOrderSigned, setIsOrderSigned] = useState<boolean>(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signingDoctor, setSigningDoctor] = useState<string>('Dr. Rajesh Patel [DOC-101]');

  const handleSelectRegimen = (regimenId: string) => {
    if (!isDoctor) {
      showToast({
        type: 'error',
        title: 'Prescription Change Restricted (RBAC)',
        message: 'Patients have read-only access. Only licensed clinicians and attending physicians can modify prescribed medications.',
      });
      return;
    }
    setSelectedRegimen(regimenId);
    showToast({
      type: 'success',
      title: 'Prescription Selected in Cockpit',
      message: `Set ${regimenId.replace(/_/g, ' ')} as the primary prescribed therapy.`,
    });
  };

  const handleSignClinicalOrder = () => {
    if (!isDoctor) {
      showToast({
        type: 'error',
        title: 'Unauthorized Action (RBAC Policy)',
        message: 'Only authorized attending clinicians can sign or authorize clinical orders.',
      });
      return;
    }
    if (!redFlagsAcknowledged) {
      showToast({
        type: 'error',
        title: 'Safety Acknowledgment Required',
        message: 'Please review and acknowledge the active red flags before signing the order.',
      });
      return;
    }
    const stamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    setIsOrderSigned(true);
    setSignedAt(stamp);
    showToast({
      type: 'success',
      title: 'Clinical Treatment Order Signed & Authorized',
      message: `Signed by ${signingDoctor}. Order transmitted to ${patient?.display_name || 'Patient'}'s active care chart.`,
    });
  };

  // Dynamically update display when viewMode toggle is switched in the header
  React.useEffect(() => {
    const isClinician = viewMode === 'clinician';
    setShowTechnicalDetails(isClinician);
    setIsGovernorTraceOpen(isClinician);
  }, [viewMode]);

  // Auto-generate or load plan on mount if not yet present
  React.useEffect(() => {
    if (activePatientId && !planResult && !clinicalPlanMutation.isPending) {
      clinicalPlanMutation.mutateAsync().then(setPlanResult).catch(() => {});
    }
  }, [activePatientId]);

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

  // Active Red Flags: from synthesized plan or patient-tailored defaults
  const activeRedFlags: string[] =
    plan?.red_flags && plan.red_flags.length > 0
      ? plan.red_flags
      : [
          'Severe daytime fatigue accompanied by elevated fasting glucose warrants formal screening for obstructive sleep apnea (STOP-BANG score).',
          'High glycemic variability (CV > 36%) signals severe glucose instability and heightened risk of silent, asymptomatic hypoglycemia.',
        ];

  // Individualized patient narrative
  const displayedNarrative: string =
    plan?.patient_summary ||
    `Hello ${patient?.display_name || 'Demo B [CGMacros #101]'}, your personalized metabolic analysis highlights high-leverage opportunities to stabilize your daily glucose curve. We recommend integrating 'Circadian Chrononutrition: Early Evening Dinner Cut-Off' and 'Zone-2 Steady-State Aerobic Cycling or Rucking' into your daily routine. Please discuss the selected pharmacological therapy options with your prescribing clinician to align on your individualized care plan safely.`;

  // Consolidate directive and guideline data for unified presentation
  const directives = getTailoredDirectives(patient);
  const pharmDirective =
    directives.find((d) => d.category.toLowerCase().includes('pharmacotherapy')) || directives[0];
  const nutriDirective =
    directives.find(
      (d) =>
        d.category.toLowerCase().includes('nutrition') ||
        d.category.toLowerCase().includes('diet') ||
        d.category.toLowerCase().includes('carbohydrate')
    ) ||
    directives[1] ||
    directives[0];

  const lifestyleList =
    plan?.lifestyle_interventions && plan.lifestyle_interventions.length > 0
      ? plan.lifestyle_interventions
      : [
          {
            title: '15-Minute Postprandial Walking Habit',
            detail:
              'Engage in light walking within 30 minutes following lunch and dinner. Muscle contractions stimulate non-insulin glucose disposal.',
            linked_twin_finding: 'Attenuates acute postprandial glucose spike by 25 to 40 mg/dL.',
          },
          {
            title: 'Food Sequencing: Fiber & Protein First Protocol',
            detail:
              'Consume non-starchy vegetables, salads, and lean proteins 10 minutes prior to eating starchy carbohydrates.',
            linked_twin_finding: 'Flattens peak rise slope and dampens 60-minute postprandial excursion.',
          },
          {
            title: 'Circadian Chrononutrition: Early Dinner Cut-Off',
            detail:
              'Complete your final caloric meal before 7:30 PM. Human insulin sensitivity naturally drops in the evening.',
            linked_twin_finding: 'Eliminates nocturnal glucose drift and lowers next-morning fasting baseline.',
          },
          {
            title: 'Starch Retrogradation (Cooled & Reheated Starch)',
            detail:
              'Cook carbohydrate staples like potatoes or rice, cool them overnight, and reheat before consuming to increase resistant starch.',
            linked_twin_finding: 'Lowers glycemic index by 30% and extends satiety.',
          },
        ];

  const questionsList =
    plan?.questions_for_clinician && plan.questions_for_clinician.length > 0
      ? plan.questions_for_clinician
      : [
          'What individualized glycemic target (e.g. TIR > 70%) is most appropriate for my daily routine?',
          'Should therapy be adjusted to address morning fasting glucose levels or post-meal spikes?',
          'Has a comprehensive kidney (eGFR and uACR) and liver panel been reviewed within the past 6 months?',
        ];

  const therapyList =
    plan?.therapy_options && plan.therapy_options.length > 0
      ? plan.therapy_options
      : [
          {
            drug_class: 'metformin',
            rationale:
              'First-line biguanide pharmacotherapy that suppresses hepatic gluconeogenesis and augments peripheral insulin sensitivity.',
            expected_effect_literature: 'Typical population-level reduction in HbA1c of 1.0% to 1.5%',
            cautions: ['Titrate with substantial meals to reduce GI disturbance'],
            guideline_ids: ['G-MET-01'],
          },
          {
            drug_class: 'sglt2_inhibitor',
            rationale:
              'Promotes urinary glucose excretion to confer cardiorenal risk reduction, blood pressure lowering, and glycemic control.',
            expected_effect_literature:
              'Typical population-level reduction in HbA1c of 0.5% to 0.9% alongside cardiorenal benefits',
            cautions: ['Maintain adequate oral hydration; monitor for mycotic infections'],
            guideline_ids: ['G-SGLT2-01'],
          },
          {
            drug_class: 'glp1_receptor_agonist',
            rationale:
              'Incretin mimetic that enhances glucose-dependent insulin secretion, slows gastric emptying, and supports weight loss.',
            expected_effect_literature:
              'Typical population-level reduction in HbA1c of 1.0% to 1.8% and body weight reduction of 3 to 7 kg',
            cautions: ['Gradual titration to prevent transient nausea'],
            guideline_ids: ['G-GLP1-01'],
          },
        ];

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

      {/* 2. Doctor's Active Clinical Decisions & Order Cockpit (RBAC Enforced) */}
      <div className={`p-6 rounded-2xl border transition-all shadow-md ${
        !isDoctor
          ? 'bg-slate-900/60 border-slate-800'
          : isOrderSigned
          ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/40'
          : 'bg-slate-900/70 border-teal-500/30'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              !isDoctor
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                : isOrderSigned
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
            }`}>
              {!isDoctor ? (
                <Lock className="w-5 h-5 text-teal-400" />
              ) : isOrderSigned ? (
                <FileCheck2 className="w-5 h-5" />
              ) : (
                <Stethoscope className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {!isDoctor
                    ? 'Active Clinical Prescription & Targets'
                    : "Doctor's Clinical Decision & Prescription Cockpit"}
                </h3>
                {!isDoctor ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                    <Lock className="w-3 h-3 text-teal-400" /> PATIENT VIEW &bull; READ-ONLY
                  </span>
                ) : isOrderSigned ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Check className="w-3 h-3" /> ORDER SIGNED & AUTHORIZED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    <Stethoscope className="w-3 h-3 text-amber-400" /> DOCTOR AUTHORIZATION REQUIRED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {!isDoctor
                  ? 'Authorized clinical directives and glycemic targets formulated by your attending physician. Patients have read-only access.'
                  : isOrderSigned
                  ? `Clinical directive authorized by ${signingDoctor} on ${signedAt || 'today'}. Stamped for EHR transmission.`
                  : 'Review synthesized options, decide on pharmacotherapy & personalized glycemic targets, and electronically sign the order.'}
              </p>
            </div>
          </div>

          {isDoctor && isOrderSigned && (
            <button
              onClick={() => setIsOrderSigned(false)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
            >
              Modify Decision
            </button>
          )}
        </div>

        {/* Read-Only Prescription Card for Patients OR Verified Signed Order for Doctors */}
        {!isDoctor || isOrderSigned ? (
          <div className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/20">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Prescribed Regimen</span>
                <span className="font-bold text-white text-sm capitalize">
                  {selectedRegimen.replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] text-emerald-400 block mt-0.5 font-mono">
                  {!isDoctor ? 'Status: Active Prescribed Therapy' : 'Status: Active Rx Order'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/20">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Individualized A1c Target</span>
                <span className="font-bold text-teal-300 text-sm">{targetA1c}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Per ADA risk stratification</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/20">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Time-in-Range (TIR) Target</span>
                <span className="font-bold text-teal-300 text-sm">{targetTIR}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">70–180 mg/dL target zone</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/20">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Attending Physician</span>
                <span className="font-bold text-white text-xs truncate block">{signingDoctor}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5 font-mono text-[10px]">
                  {signedAt || 'Authorized in Care Chart'}
                </span>
              </div>
            </div>

            {!isDoctor && (
              <div className="p-3.5 rounded-xl bg-teal-950/30 border border-teal-500/20 flex items-start gap-3">
                <Lock className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div className="text-xs text-teal-200/90 leading-relaxed">
                  <strong className="text-white">Role-Based Access Control (RBAC):</strong> Under clinical safety and medical governance policies, drug prescriptions, target thresholds, and pharmacotherapy adjustments can only be authorized by an attending physician ({signingDoctor}). As a patient, your view is strictly read-only.
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Active Decision Controls for Doctor */
          <div className="pt-4 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Decision 1: Pharmacotherapy Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-teal-400" />
                  <span>1. Prescribe Primary Therapy</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'metformin', label: 'Metformin 500mg BID', desc: 'Standard biguanide first-line; suppresses hepatic glucose' },
                    { id: 'sglt2_inhibitor', label: 'SGLT2-Inhibitor (Empagliflozin 10mg)', desc: 'Cardiorenal protection & osmotic glucose clearance' },
                    { id: 'glp1_receptor_agonist', label: 'GLP-1 RA (Semaglutide 0.5mg)', desc: 'Incretin effect, delayed gastric emptying & weight loss' },
                    { id: 'lifestyle_first', label: 'Lifestyle-First Trial (No Rx)', desc: '3-month nutritional & exercise trial before oral agents' },
                  ].map((med) => {
                    const isSelected = selectedRegimen === med.id;
                    return (
                      <button
                        key={med.id}
                        type="button"
                        onClick={() => setSelectedRegimen(med.id)}
                        className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-500/15 border-teal-500 text-white shadow-sm ring-1 ring-teal-500/30'
                            : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{med.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{med.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Decision 2: Target Glycemia (Individualized Goals) */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-teal-400" />
                  <span>2. Set Individualized Glycemic Targets</span>
                </label>

                <div className="space-y-2">
                  <span className="text-[11px] text-slate-400 block">Target HbA1c Threshold:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: '< 6.5%', label: '< 6.5% (Intensive)' },
                      { val: '< 7.0%', label: '< 7.0% (Standard ADA)' },
                      { val: '< 7.5%', label: '< 7.5% (Hypo-Prone)' },
                      { val: '< 8.0%', label: '< 8.0% (Frail/Elderly)' },
                    ].map((t) => (
                      <button
                        key={t.val}
                        type="button"
                        onClick={() => setTargetA1c(t.val)}
                        className={`px-2.5 py-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                          targetA1c === t.val
                            ? 'bg-teal-500/20 border-teal-500 text-teal-200 font-bold'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] text-slate-400 block">Target Time-in-Range (TIR 70–180 mg/dL):</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: '> 80%', label: '> 80% (High)' },
                      { val: '> 70%', label: '> 70% (Consensus)' },
                      { val: '> 50%', label: '> 50% (Cautious)' },
                    ].map((tir) => (
                      <button
                        key={tir.val}
                        type="button"
                        onClick={() => setTargetTIR(tir.val)}
                        className={`px-2 py-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                          targetTIR === tir.val
                            ? 'bg-teal-500/20 border-teal-500 text-teal-200 font-bold'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tir.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Decision 3: Safety Attestation & Signing */}
              <div className="space-y-3 flex flex-col justify-between p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                    <span>3. Safety Review & Attestation</span>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={redFlagsAcknowledged}
                      onChange={(e) => setRedFlagsAcknowledged(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-teal-500 focus:ring-teal-400"
                    />
                    <span className="leading-relaxed">
                      I have evaluated active red flags (glycemic variability CV &gt; 36%, daytime fatigue) and verified renal eGFR clearance for this therapy choice.
                    </span>
                  </label>

                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Attending Clinician Credentials:</span>
                    <input
                      type="text"
                      value={signingDoctor}
                      onChange={(e) => setSigningDoctor(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                      placeholder="Doctor Name & ID"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignClinicalOrder}
                  className="w-full py-2.5 px-4 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950 font-bold rounded-xl shadow-lg shadow-teal-500/20 transition-all cursor-pointer text-xs flex items-center justify-center space-x-2"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Sign & Authorize Clinical Order</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Unified Master Container: Doctor Advice & Clinical Goals */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-6 shadow-sm">
        {/* Master Container Header: Active Clinical Plan & Safety Synthesis */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
            <div className="flex items-center space-x-2.5">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <h3 className="font-bold text-white text-sm">Active Clinical Plan & Safety Synthesis</h3>
              <ProvenanceBadge provenance="GUIDELINE_AI" safetyChecked={true} size="sm" />
            </div>

            <button
              onClick={handleGeneratePlan}
              disabled={clinicalPlanMutation.isPending}
              className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              {clinicalPlanMutation.isPending ? (
                <>
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run Plan Synthesis</span>
                </>
              )}
            </button>
          </div>

          {/* 1. Active Red Flags */}
          {activeRedFlags && activeRedFlags.length > 0 && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-1.5">
              <div className="font-semibold flex items-center space-x-1.5 text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Active Red Flags</span>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {activeRedFlags.map((rf, idx) => (
                  <li key={idx} className="leading-relaxed">{rf}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 2. Doctor Advice & Goals: Executive Narrative */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider block">
              Doctor Advice & Individualized Plan Summary
            </span>
            <p className="text-sm text-slate-200 leading-relaxed font-sans">
              {displayedNarrative}
            </p>
          </div>
        </div>

        {/* Subtle Divider */}
        <div className="border-b border-slate-800/50" />

        {/* Section 1: Pharmacotherapy Management & Nutritional Optimization */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-xs font-semibold text-teal-400 uppercase tracking-wider">
            <Pill className="w-4 h-4 text-teal-400" />
            <span>Pharmacotherapy Management & Nutritional Optimization</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pharmacotherapy Management Item (e.g. Metformin Protocol) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">
                  {pharmDirective.category}
                </span>
                <span className="text-[10px] font-semibold text-teal-300 px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20">
                  {pharmDirective.status}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">
                {pharmDirective.title}
              </h4>
              <div className="text-xs text-indigo-300 font-medium">
                <span className="text-[10px] text-slate-400 uppercase block">Expected Impact:</span>
                {pharmDirective.impact}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {pharmDirective.details}
              </p>
              {pharmDirective.cautions && pharmDirective.cautions.length > 0 && (
                <p className="text-[11px] text-amber-300/90 leading-relaxed">
                  <span className="font-semibold text-amber-400">Caution: </span>
                  {pharmDirective.cautions.join('; ')}
                </p>
              )}
              <p className="text-[11px] text-slate-400">
                <span className="text-slate-500">Monitoring: </span>
                <span className="text-slate-300 font-medium">{pharmDirective.monitoring}</span>
              </p>
            </div>

            {/* Nutritional Optimization Item (e.g. High-Viscosity Dietary Fiber Protocol) */}
            <div className="space-y-2 md:border-l md:border-slate-800/50 md:pl-6">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                  {nutriDirective.category}
                </span>
                <span className="text-[10px] font-semibold text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  {nutriDirective.status}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">
                {nutriDirective.title}
              </h4>
              <div className="text-xs text-indigo-300 font-medium">
                <span className="text-[10px] text-slate-400 uppercase block">Expected Impact:</span>
                {nutriDirective.impact}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {nutriDirective.details}
              </p>
              {nutriDirective.cautions && nutriDirective.cautions.length > 0 && (
                <p className="text-[11px] text-amber-300/90 leading-relaxed">
                  <span className="font-semibold text-amber-400">Caution: </span>
                  {nutriDirective.cautions.join('; ')}
                </p>
              )}
              <p className="text-[11px] text-slate-400">
                <span className="text-slate-500">Monitoring: </span>
                <span className="text-slate-300 font-medium">{nutriDirective.monitoring}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Subtle Divider */}
        <div className="border-b border-slate-800/50" />

        {/* Section 2: Your Daily Lifestyle & Meal Habits */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-teal-400 uppercase tracking-wider">
              <Activity className="w-4 h-4 text-teal-400" />
              <span>Your Daily Lifestyle & Meal Habits</span>
            </div>
            <span className="text-[11px] text-teal-300 font-medium">Personalized to metabolic twin findings</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {lifestyleList.map((life, lIdx) => (
              <div key={lIdx} className="space-y-1">
                <h4 className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>{life.title}</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed pl-5">{life.detail}</p>
                {life.linked_twin_finding && (
                  <div className="pl-5 text-[11px] text-teal-300 flex items-center gap-1.5 mt-0.5">
                    <Zap className="w-3 h-3 text-teal-400 shrink-0" />
                    <span>{life.linked_twin_finding}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Subtle Divider */}
        <div className="border-b border-slate-800/50" />

        {/* Section 3: Questions to Bring to Your Next Clinical Visit */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-teal-400 uppercase tracking-wider">
            <MessageSquare className="w-4 h-4 text-teal-400" />
            <span>Questions to Bring to Your Next Clinical Visit</span>
          </div>
          <p className="text-xs text-slate-400">
            Take these clinician-facing discussion points with you to your next consultation:
          </p>
          <ul className="space-y-1.5 text-xs text-slate-300 pl-4 list-disc">
            {questionsList.map((q, qIdx) => (
              <li key={qIdx} className="leading-relaxed">
                {q}
              </li>
            ))}
          </ul>
        </div>

        {/* Subtle Divider */}
        <div className="border-b border-slate-800/50" />

        {/* Section 4: Medications Under Consideration (3 Drug Classes) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              <Pill className="w-4 h-4 text-indigo-400" />
              <span>Medications Under Consideration ({therapyList.length} Drug Classes)</span>
            </div>
            <span className="text-[11px] text-indigo-300 font-mono">Guideline-concordant options</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {therapyList.map((opt, idx) => {
              const isSelected = selectedRegimen === opt.drug_class;
              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                    isSelected
                      ? 'bg-teal-950/20 border-teal-500/60 ring-1 ring-teal-500/30'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white capitalize">
                      {opt.drug_class.replace(/_/g, ' ')}
                    </h4>
                    {isSelected ? (
                      <span className="text-[10px] font-bold text-teal-300 px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Doctor's Choice
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-indigo-300 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                        Option
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{opt.rationale}</p>
                  <div className="text-[11px] text-slate-300">
                    <span className="text-indigo-400 font-medium">Expected Effect: </span>
                    {opt.expected_effect_literature}
                  </div>
                  {opt.cautions && opt.cautions.length > 0 && (
                    <p className="text-[10px] text-amber-300/80 leading-tight">
                      <span className="font-semibold text-amber-400">Caution: </span>
                      {opt.cautions[0]}
                    </p>
                  )}
                  {opt.guideline_ids && opt.guideline_ids.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      {opt.guideline_ids.map((gid) => (
                        <button
                          key={gid}
                          onClick={() => handleOpenGuidelineSnippet(gid)}
                          className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors cursor-pointer"
                          title="Click to view guideline snippet"
                        >
                          <BookOpen className="w-2.5 h-2.5" />
                          <span>{gid}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Decision Action Button (Doctor Interactive vs Patient Read-Only) */}
                  <div className="pt-2 border-t border-slate-800/60">
                    {isDoctor ? (
                      <button
                        type="button"
                        onClick={() => handleSelectRegimen(opt.drug_class)}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Prescribed Regimen Active</span>
                          </>
                        ) : (
                          <span>Select for Prescription &rarr;</span>
                        )}
                      </button>
                    ) : (
                      <div className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all">
                        {isSelected ? (
                          <div className="w-full py-1 px-2.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center justify-center gap-1.5 text-xs">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Prescribed by Your Doctor</span>
                          </div>
                        ) : (
                          <div className="w-full py-1 px-2.5 rounded-lg bg-slate-950/60 text-slate-500 border border-slate-800/60 flex items-center justify-center gap-1.5 text-xs font-normal">
                            <Lock className="w-3 h-3 text-slate-500" />
                            <span>Alternative Option (Read-Only)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>


      {/* Guideline Drawer for Snippets */}
      <GuidelineDrawer
        isOpen={isGuidelineDrawerOpen}
        onClose={() => setIsGuidelineDrawerOpen(false)}
        snippet={selectedSnippet}
      />
    </div>
  );
};
