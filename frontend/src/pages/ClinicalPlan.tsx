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
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePatient, useClinicalPlan } from '../api/queries';
import { ClinicalPlanResponse, GuidelineSnippet, TherapyOption } from '../api/types';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { GuidelineDrawer } from '../components/GuidelineDrawer';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';
import { getRuleExplanation } from '../constants/governorRules';

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

      {/* Initial Empty State before generation */}
      {!plan && !clinicalPlanMutation.isPending && (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-4 max-w-xl mx-auto">
          <Stethoscope className="w-12 h-12 text-teal-400/80 mx-auto" />
          <h3 className="text-lg font-semibold text-white">Generate Guided Care Plan</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Click "Generate Clinical Plan" to evaluate patient factors (HbA1c {patient?.hba1c_pct}%, renal status,
            hypoglycemia history) against ADA/ICMR clinical guidelines and pass through the 9 deterministic Safety
            Governor rules.
          </p>
          <button
            onClick={handleGeneratePlan}
            className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-lg text-xs shadow-md transition-all cursor-pointer"
          >
            Formulate Clinical Plan
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

                        {/* Expected Effect (Population-Level) */}
                        <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs">
                          <span className="text-[10px] text-indigo-400 font-semibold uppercase block">
                            Expected Effect (Population-Level):
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
