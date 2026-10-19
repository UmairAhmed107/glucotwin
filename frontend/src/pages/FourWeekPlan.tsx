import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
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

      {/* Care Pathway Graphic Above Timeline */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Compass className="w-4 h-4" />
            <span>Integrated Glycemic Care Pathway Architecture</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Sequential Care Loop</span>
        </div>

        {/* Responsive Flowchart Nodes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Node 1: Current State */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-teal-500/30 space-y-1 relative group">
            <div className="text-[10px] text-teal-400 uppercase font-semibold flex items-center justify-between">
              <span>1. Current Baseline</span>
              <Activity className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="text-sm font-bold text-white font-mono">
              HbA1c: {hba1c}% • Conf: {confidencePct}%
            </div>
            <div className="text-[11px] text-slate-400">
              {memN} observed meals • {patient?.is_synthetic ? 'Synthetic profile' : 'Clinical record'}
            </div>
            <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-600">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Node 2: Interventions */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 relative group">
            <div className="text-[10px] text-indigo-400 uppercase font-semibold flex items-center justify-between">
              <span>2. Interventions</span>
              <Utensils className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-sm font-bold text-white">Carb & Meal Tuning</div>
            <div className="text-[11px] text-slate-400">
              Postprandial walk + twin-predicted carb moderation
            </div>
            <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-600">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Node 3: Monitoring */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 relative group">
            <div className="text-[10px] text-amber-400 uppercase font-semibold flex items-center justify-between">
              <span>3. Monitoring</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-sm font-bold text-white">Continuous Tracking</div>
            <div className="text-[11px] text-slate-400">
              CGM logging, peak rise verification & safety checks
            </div>
            <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-600">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Node 4: Clinician Review */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-1">
            <div className="text-[10px] text-emerald-400 uppercase font-semibold flex items-center justify-between">
              <span>4. Clinical Review</span>
              <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-white">Week 4 Milestone</div>
            <div className="text-[11px] text-slate-400">
              Physician review of glycemic logs & therapy escalation
            </div>
          </div>
        </div>
      </div>

      {combinedPlanMutation.isPending && !planResult && (
        <LoadingSkeleton className="h-96 w-full" />
      )}

      {/* 4-Column Timeline Grid */}
      {planResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {planResult.weeks.map((week: WeekPlan) => {
              const isWeek4 = week.week_number === 4;

              return (
                <div
                  key={week.week_number}
                  className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                    isWeek4
                      ? 'bg-slate-900 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Week Column Header */}
                    <div className="pb-3 border-b border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            isWeek4
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                          }`}
                        >
                          Week {week.week_number}
                        </span>
                        {isWeek4 && (
                          <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                            <Award className="w-3 h-3" />
                            <span>Milestone</span>
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-white text-xs leading-snug pt-1">
                        {week.focus_theme}
                      </h3>
                    </div>

                    {/* Week Items */}
                    <div className="space-y-2.5">
                      {week.items.map((item: PlanItem, iIdx: number) => {
                        const isClinicianMilestone = item.category === 'clinician_review';
                        const isTwinMeal = item.category === 'twin_meal_advice';

                        return (
                          <div
                            key={iIdx}
                            className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                              isClinicianMilestone
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100'
                                : isTwinMeal
                                ? 'bg-teal-500/5 border-teal-500/20 text-slate-200'
                                : 'bg-slate-950/70 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <h4 className="font-semibold text-white text-[11px] leading-tight">
                                {item.title}
                              </h4>
                              <ProvenanceBadge provenance={item.provenance} size="sm" />
                            </div>

                            <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                              {item.detail}
                            </p>

                            <div className="pt-1 flex items-center justify-between text-[9px] text-slate-400 uppercase tracking-wider">
                              <span className="flex items-center space-x-1">
                                {isTwinMeal && <Zap className="w-3 h-3 text-teal-400" />}
                                {isClinicianMilestone && (
                                  <Stethoscope className="w-3 h-3 text-emerald-400" />
                                )}
                                <span>{item.category.replace(/_/g, ' ')}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Column Footer Milestone Flag */}
                  {isWeek4 && (
                    <div className="mt-4 pt-3 border-t border-emerald-500/20 text-center">
                      <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                        <Flag className="w-3 h-3" />
                        <span>Comprehensive Clinician Review Point</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 text-center text-xs text-slate-400 pt-4">
            Care pathway milestones are generated for patient education and clinical alignment. This plan does not
            substitute for professional medical consultation.
          </div>
        </div>
      )}
    </div>
  );
};
