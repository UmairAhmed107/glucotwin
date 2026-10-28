import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  FileCheck,
  Flag,
  HelpCircle,
  Layers,
  Sparkles,
  Stethoscope,
  TrendingDown,
  UserCheck,
  Utensils,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePatient, useCombinedPlan } from '../api/queries';
import { CombinedPlanResponse, WeekPlan, PlanItem } from '../api/types';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';

export const FourWeekPlanPage: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: patient } = usePatient(activePatientId);
  const combinedPlanMutation = useCombinedPlan(activePatientId || 0);

  const [planResult, setPlanResult] = useState<CombinedPlanResponse | null>(null);

  // Auto-fetch plan on mount if patient is selected
  useEffect(() => {
    if (activePatientId && !planResult && !combinedPlanMutation.isPending) {
      combinedPlanMutation
        .mutateAsync()
        .then((res) => setPlanResult(res))
        .catch((err) => console.error('Failed to load combined 4-week plan', err));
    }
  }, [activePatientId]);

  const handleGeneratePlan = async () => {
    if (!activePatientId) return;
    try {
      const res = await combinedPlanMutation.mutateAsync();
      setPlanResult(res);
    } catch (err) {
      console.error('Failed to regenerate plan', err);
    }
  };

  if (!activePatientId) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          title="No Active Patient Selected"
          description="Select or create a patient to generate their 4-week integrated care pathway."
          actionText="Go to Patient Setup"
          onAction={() => (window.location.href = '/patient-setup')}
        />
      </div>
    );
  }

  const confidencePct = Math.round((patient?.twin_state?.confidence_score ?? 0.1) * 100);
  const hba1c = patient?.hba1c_pct ?? 7.5;
  const memN = patient?.twin_state?.mem_n ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">4-Week Care Pathway & Plan</h1>
            <ProvenanceBadge provenance="GUIDELINE_AI" safetyChecked={true} />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Integrated 4-week clinical care pathway combining patient-specific twin meal insights with evidence-based
            lifestyle and monitoring milestones.
          </p>
        </div>

        <button
          onClick={handleGeneratePlan}
          disabled={combinedPlanMutation.isPending}
          className="inline-flex items-center space-x-2 py-2 px-4 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 disabled:opacity-50 text-slate-950 font-semibold rounded-lg shadow-lg shadow-teal-500/20 transition-all cursor-pointer text-xs self-start sm:self-auto"
        >
          {combinedPlanMutation.isPending ? (
            <>
              <Activity className="w-4 h-4 animate-spin" />
              <span>Synthesizing Pathway...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{planResult ? 'Re-Evaluate Pathway' : 'Generate 4-Week Plan'}</span>
            </>
          )}
        </button>
      </div>

      {/* 1. Flattened Horizontal Care Pathway Architecture Pipeline */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Compass className="w-4 h-4" />
            <span>Integrated Glycemic Care Pathway Architecture</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Sequential Care Loop</span>
        </div>

        {/* Flattened Progress Tracker */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
          {/* Step 1 */}
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 text-xs font-bold font-mono">
              01
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">1. Baseline State</div>
              <div className="text-[11px] text-slate-400 truncate">
                HbA1c {hba1c}% • {memN} meals observed
              </div>
            </div>
          </div>

          <ChevronRight className="hidden md:block w-4 h-4 text-slate-600 shrink-0" />

          {/* Step 2 */}
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 text-xs font-bold font-mono">
              02
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">2. Interventions</div>
              <div className="text-[11px] text-slate-400 truncate">
                Postprandial walk & carb tuning
              </div>
            </div>
          </div>

          <ChevronRight className="hidden md:block w-4 h-4 text-slate-600 shrink-0" />

          {/* Step 3 */}
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 text-xs font-bold font-mono">
              03
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">3. Monitoring</div>
              <div className="text-[11px] text-slate-400 truncate">
                Continuous CGM tracking
              </div>
            </div>
          </div>

          <ChevronRight className="hidden md:block w-4 h-4 text-slate-600 shrink-0" />

          {/* Step 4 */}
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-xs font-bold font-mono">
              04
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">4. Clinical Review</div>
              <div className="text-[11px] text-slate-400 truncate">
                Week 4 milestone & titration
              </div>
            </div>
          </div>
        </div>
      </div>

      {combinedPlanMutation.isPending && !planResult && (
        <LoadingSkeleton className="h-96 w-full" />
      )}

      {/* 2. Unified Master Container: 4-Week Care Pathway */}
      {planResult && (
        <div className="space-y-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {planResult.weeks.map((week: WeekPlan, wIdx: number) => {
                const isWeek4 = week.week_number === 4;

                const physicalDietItem =
                  week.items.find((it) => it.category === 'lifestyle') || week.items[0];
                const twinItem =
                  week.items.find((it) => it.category === 'twin_meal_advice') || week.items[1];
                const monitoringItem =
                  week.items.find(
                    (it) => it.category === 'monitoring' || it.category === 'clinician_review'
                  ) || week.items[2];

                return (
                  <div
                    key={week.week_number}
                    className={`space-y-6 ${
                      wIdx > 0 ? 'lg:border-l lg:border-slate-800/50 lg:pl-6' : ''
                    }`}
                  >
                    {/* Standardized Column Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-teal-400">
                          WEEK {week.week_number}
                        </div>
                        <div className="text-xs text-white font-medium mt-0.5 line-clamp-1">
                          {week.focus_theme}
                        </div>
                      </div>
                      <span className="text-3xl font-black font-mono text-slate-700/40 select-none">
                        0{week.week_number}
                      </span>
                    </div>

                    {/* Standardized Categorized Rows */}
                    <div className="space-y-6">
                      {/* Row 1: 1. PHYSICAL / DIET HABIT */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                            1. PHYSICAL / DIET HABIT
                          </span>
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            CLINICAL GUIDELINE
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-white leading-snug">
                          {physicalDietItem?.title}
                        </h4>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          {physicalDietItem?.detail}
                        </p>
                      </div>

                      {/* Subtle Divider */}
                      <div className="border-b border-slate-800/50" />

                      {/* Row 2: 2. DIGITAL TWIN */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1">
                            <Zap className="w-3 h-3 text-teal-400" />
                            <span>2. DIGITAL TWIN</span>
                          </span>
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">
                            PERSONALIZED
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-white leading-snug">
                          {twinItem?.title}
                        </h4>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          {twinItem?.detail}
                        </p>
                      </div>

                      {/* Subtle Divider */}
                      <div className="border-b border-slate-800/50" />

                      {/* Row 3: 3. MONITORING & CLINICAL */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            <Stethoscope className="w-3 h-3 text-emerald-400" />
                            <span>3. MONITORING & CLINICAL</span>
                          </span>
                          <span
                            className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                              isWeek4
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                            }`}
                          >
                            {isWeek4 ? 'MILESTONE' : 'CLINICAL GUIDELINE'}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-white leading-snug">
                          {monitoringItem?.title}
                        </h4>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          {monitoringItem?.detail}
                        </p>
                        {isWeek4 && (
                          <div className="pt-2 text-[10px] text-emerald-400 font-semibold flex items-center gap-1.5">
                            <Flag className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>Comprehensive Clinician Review Point</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 text-center text-xs text-slate-400 pt-2">
            Care pathway milestones are generated for patient education and clinical alignment. This plan does not
            substitute for professional medical consultation.
          </div>
        </div>
      )}
    </div>
  );
};
