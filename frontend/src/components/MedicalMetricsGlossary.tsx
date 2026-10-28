import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  HelpCircle,
  Info,
  Pill,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

export interface GlossaryTerm {
  term: string;
  acronym?: string;
  category: 'cgm' | 'lab' | 'meal' | 'medication' | 'safety';
  definition: string;
  targetRange: string;
  clinicalSignificance: string;
  plainEnglish: string;
  formulaOrRule?: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  // CGM Core Metrics
  {
    term: 'Time in Range (70–180 mg/dL)',
    acronym: 'TIR',
    category: 'cgm',
    definition: 'Percentage of time sensor glucose readings remain between 70 mg/dL and 180 mg/dL.',
    targetRange: '> 70% of readings (> 16h 48m per day)',
    clinicalSignificance: 'Each 10% increase in TIR is correlated with an approximate 0.8% decrease in HbA1c and substantial reduction in microvascular complications.',
    plainEnglish: 'The sweet spot! How much of your day your blood sugar stays within the safe, normal zone.',
    formulaOrRule: 'TIR % = (Readings between 70 and 180 / Total sensor readings) * 100',
  },
  {
    term: 'Time Above Range (> 180 mg/dL)',
    acronym: 'TAR',
    category: 'cgm',
    definition: 'Percentage of time glucose is elevated. Level 1: 181–250 mg/dL. Level 2 (Very High): > 250 mg/dL.',
    targetRange: '< 25% total (Level 2 < 5%)',
    clinicalSignificance: 'Frequent high spikes cause vascular endothelial damage, oxidative stress, and fatigue.',
    plainEnglish: 'Time spent in high blood sugar spikes, especially after heavy carbohydrate meals.',
    formulaOrRule: 'TAR % = (Readings > 180 mg/dL / Total readings) * 100',
  },
  {
    term: 'Time Below Range (< 70 mg/dL)',
    acronym: 'TBR / Hypoglycemia',
    category: 'cgm',
    definition: 'Percentage of time glucose falls dangerously low. Level 1: 54–69 mg/dL. Level 2 (Severe): < 54 mg/dL.',
    targetRange: '< 4% total (Level 2 < 1% / < 15 mins/day)',
    clinicalSignificance: 'Severe nocturnal hypoglycemia is a primary medical emergency risk, leading to confusion, seizures, and arrhythmia.',
    plainEnglish: 'Danger zone lows. High priority safety metric — keeping this close to 0% is top medical priority.',
    formulaOrRule: 'TBR % = (Readings < 70 mg/dL / Total readings) * 100',
  },
  {
    term: 'Coefficient of Variation',
    acronym: 'CV %',
    category: 'cgm',
    definition: 'Primary metric measuring glucose swings and glycemic variability relative to the mean.',
    targetRange: '≤ 36% (Stable glucose profile)',
    clinicalSignificance: 'CV > 36% indicates an erratic, swinging glucose profile and signifies elevated risk of acute hypoglycemic crashes.',
    plainEnglish: 'How rollercoaster-like your blood sugar is. Under 36% means smooth, predictable waves.',
    formulaOrRule: 'CV (%) = (Standard Deviation of Glucose / Mean Glucose) * 100',
  },
  {
    term: 'Glucose Management Indicator',
    acronym: 'GMI',
    category: 'cgm',
    definition: 'Calculated approximation of lab HbA1c based strictly on continuous sensor glucose data over the last 14+ days.',
    targetRange: '< 7.0% for most adults (concordant with HbA1c target)',
    clinicalSignificance: 'Provides immediate feedback without waiting 3 months for a blood laboratory draw.',
    plainEnglish: 'Your estimated 3-month HbA1c grade, calculated live from your sensor readings.',
    formulaOrRule: 'GMI (%) = 3.31 + 0.02392 * [Mean Glucose in mg/dL]',
  },
  {
    term: 'Mean Sensor Glucose',
    acronym: 'Average Glucose',
    category: 'cgm',
    definition: 'Average concentration of all interstitial glucose measurements across the monitoring window.',
    targetRange: '~120 – 154 mg/dL (154 mg/dL aligns with ~7.0% HbA1c)',
    clinicalSignificance: 'Foundation for computing GMI and assessing overall glycemic burden.',
    plainEnglish: 'The average blood sugar level throughout your days and nights.',
  },

  // Lab & Diagnostic Metrics
  {
    term: 'Glycated Hemoglobin',
    acronym: 'HbA1c',
    category: 'lab',
    definition: 'Percentage of red blood cell hemoglobin chemically bonded with glucose over their 90–120 day lifespan.',
    targetRange: '< 7.0% (individualized: 6.5% for young/fit, up to 8.0% for frail/elderly)',
    clinicalSignificance: 'Gold standard clinical biomarker for diagnosis, long-term monitoring, and risk of microvascular diabetes complications.',
    plainEnglish: 'The official 3-month blood test report card for diabetes control.',
  },
  {
    term: 'Estimated Glomerular Filtration Rate',
    acronym: 'eGFR',
    category: 'lab',
    definition: 'Clinical measurement of kidney filtration efficiency expressed in mL/min/1.73m².',
    targetRange: '> 60 mL/min/1.73m² (Normal: > 90)',
    clinicalSignificance: 'Directly gates diabetes medication safety. Metformin contraindicated if eGFR < 30; SGLT2i dose restrictions apply below 45/30.',
    plainEnglish: 'How well your kidneys are filtering. Doctors check this before prescribing or titrating medications.',
  },

  // Meal & Postprandial
  {
    term: 'Postprandial Glycemia & Peak Rise',
    acronym: 'Post-Meal Spike',
    category: 'meal',
    definition: 'Blood sugar peak reached 1 to 2 hours following food intake.',
    targetRange: '< 180 mg/dL peak (ideal peak rise < 45 mg/dL above pre-meal baseline)',
    clinicalSignificance: 'Excessive postprandial excursions are an early sign of beta-cell dysfunction and insulin resistance.',
    plainEnglish: 'How high your blood sugar spikes 1–2 hours after breakfast, lunch, or dinner.',
  },
  {
    term: 'Incremental Area Under Curve',
    acronym: 'iAUC',
    category: 'meal',
    definition: 'Integrated mathematical area under the glucose excursion curve above baseline over 120–180 minutes.',
    targetRange: 'Lower is better (< 3500 mg·min/dL for a standard meal)',
    clinicalSignificance: 'Captures the total cumulative glucose load experienced by the vascular system following a meal.',
    plainEnglish: 'The total volume of extra sugar circulating in your blood before it comes back down.',
    formulaOrRule: 'Trapezoidal integration of (G(t) - Baseline) for G(t) > Baseline',
  },

  // Pharmacotherapy Classes
  {
    term: 'Biguanide (Metformin)',
    acronym: 'Metformin',
    category: 'medication',
    definition: 'First-line oral antihyperglycemic medication that inhibits hepatic gluconeogenesis and improves peripheral insulin sensitivity.',
    targetRange: '500 mg to 2000 mg daily in divided doses',
    clinicalSignificance: 'Weight neutral, zero intrinsic hypoglycemia risk, proven cardiovascular safety record.',
    plainEnglish: 'The standard first medication prescribed for Type 2 diabetes. Very safe and reliable.',
  },
  {
    term: 'SGLT2 Inhibitors',
    acronym: 'SGLT2i (Empagliflozin, Dapagliflozin)',
    category: 'medication',
    definition: 'Sodium-glucose cotransporter 2 inhibitors that block renal glucose reabsorption, promoting glucose excretion in urine.',
    targetRange: '10–25 mg daily',
    clinicalSignificance: 'Provides major cardiorenal protection (heart failure, CKD progression) and causes ~2-3 kg weight reduction.',
    plainEnglish: 'Helps your body gently flush extra sugar out through urine while protecting heart and kidneys.',
  },
  {
    term: 'GLP-1 Receptor Agonists',
    acronym: 'GLP-1RA (Semaglutide, Dulaglutide)',
    category: 'medication',
    definition: 'Incretin mimetics that enhance glucose-dependent insulin secretion, suppress glucagon, and delay gastric emptying.',
    targetRange: 'Weekly subcutaneous titration',
    clinicalSignificance: 'Highest efficacy for HbA1c reduction (-1.2% to -1.8%) and substantial weight loss with low hypo risk.',
    plainEnglish: 'Modern weekly medication that boosts natural insulin when eating, keeps you full longer, and supports weight loss.',
  },
  {
    term: 'Sulfonylureas',
    acronym: 'SU (Glimepiride, Glipizide)',
    category: 'medication',
    definition: 'Insulin secretagogues that stimulate pancreatic beta-cell release independent of ambient glucose level.',
    targetRange: '1–4 mg daily',
    clinicalSignificance: 'Effective and low cost, but carries significant risk of hypoglycemia and mild weight gain.',
    plainEnglish: 'Older, powerful medication that pushes the pancreas to make more insulin; requires caution against low blood sugar.',
  },

  // Safety Governor Rules
  {
    term: 'Deterministic Safety Governor Rules',
    acronym: 'Rules R1–R9',
    category: 'safety',
    definition: 'Hard-coded, deterministic clinical rule engine that verifies or blocks every AI-generated or simulated recommendation.',
    targetRange: '100% adherence (Zero AI hallucination pass-through)',
    clinicalSignificance: 'Prevents dangerous medication combinations, e.g., blocking Sulfonylurea escalation if patient has hypoglycemia history (Rule R4).',
    plainEnglish: 'The strict digital guardrails ensuring no AI suggestion violates medical guidelines or endangers the patient.',
    formulaOrRule: 'R1: Hypo guard, R2: eGFR boundary, R3: Triple oral limit, R4: High hypo SU block, R5-R9: Titration limits',
  },
];

interface MedicalMetricsGlossaryProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'all' | 'cgm' | 'lab' | 'meal' | 'medication' | 'safety';
}

export const MedicalMetricsGlossary: React.FC<MedicalMetricsGlossaryProps> = ({
  isOpen,
  onClose,
  initialCategory = 'all',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All Terms' },
    { id: 'cgm', label: 'CGM Sensor Metrics (TIR, CV, GMI)' },
    { id: 'lab', label: 'Lab Tests (HbA1c, eGFR)' },
    { id: 'meal', label: 'Meal & Spikes (iAUC, Peaks)' },
    { id: 'medication', label: 'Medications (Metformin, SGLT2i, GLP-1)' },
    { id: 'safety', label: 'Safety Rules (R1–R9)' },
  ];

  const filteredTerms = GLOSSARY_TERMS.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.term.toLowerCase().includes(query) ||
      (item.acronym && item.acronym.toLowerCase().includes(query)) ||
      item.definition.toLowerCase().includes(query) ||
      item.plainEnglish.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

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
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal / Drawer Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 260 }}
            className="fixed inset-4 sm:inset-y-8 sm:inset-x-12 md:inset-x-24 lg:inset-x-48 z-50 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Medical & Glycemic Metrics Reference Sheet
                    <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Unified Reference
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    All recurring clinical terms, targets, and formulas consolidated in one easy guide.
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Close Reference Guide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/30 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search metric or acronym (e.g., TIR, HbA1c, CV, Metformin, SGLT2i)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-white text-black font-semibold shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {filteredTerms.length === 0 ? (
                <div className="text-center py-16 text-zinc-500">
                  <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No medical terms matched "{searchQuery}"</p>
                  <p className="text-xs text-zinc-600 mt-1">Try searching for TIR, A1c, CV, or medication names.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTerms.map((item) => {
                    const isExpanded = expandedTerm === item.term;
                    return (
                      <div
                        key={item.term}
                        className={`p-4 rounded-2xl border transition-all ${
                          isExpanded
                            ? 'bg-zinc-900/90 border-zinc-700 shadow-lg'
                            : 'bg-zinc-900/40 border-zinc-850 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              {item.acronym && (
                                <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-white font-mono font-bold text-xs border border-zinc-700">
                                  {item.acronym}
                                </span>
                              )}
                              <h3 className="font-semibold text-sm text-white">{item.term}</h3>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{item.definition}</p>
                          </div>

                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 whitespace-nowrap">
                            {item.category}
                          </span>
                        </div>

                        {/* Plain English Banner */}
                        <div className="mt-3 p-2.5 rounded-xl bg-zinc-800/40 border border-zinc-800/80 flex items-start gap-2">
                          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="text-[11px] text-zinc-300">
                            <span className="font-semibold text-white">In Plain English: </span>
                            {item.plainEnglish}
                          </div>
                        </div>

                        {/* Standard Target */}
                        <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-zinc-800/60">
                          <span className="text-zinc-500 font-medium">Standard Target:</span>
                          <span className="font-semibold text-emerald-400">{item.targetRange}</span>
                        </div>

                        {/* Expandable Details */}
                        <div className="mt-3">
                          <button
                            onClick={() => setExpandedTerm(isExpanded ? null : item.term)}
                            className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 font-medium transition-colors"
                          >
                            <span>{isExpanded ? 'Hide clinical notes & formula' : 'View clinical significance & formula'}</span>
                          </button>

                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-2.5 pt-2.5 border-t border-zinc-800 text-xs space-y-2 text-zinc-400"
                            >
                              <div>
                                <span className="font-medium text-zinc-300">Clinical Impact: </span>
                                <span>{item.clinicalSignificance}</span>
                              </div>
                              {item.formulaOrRule && (
                                <div className="p-2 rounded-lg bg-black/60 border border-zinc-800 font-mono text-[11px] text-zinc-300">
                                  {item.formulaOrRule}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Grounding: ADA Standards of Care (2024) & ICMR Type 2 Guidelines</span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors"
              >
                Close Guide
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
