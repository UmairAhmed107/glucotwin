import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  HelpCircle,
  Info,
  Pill,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePatient, useTherapyScenarios } from '../api/queries';
import { TherapyScenarioItem, GuidelineSnippet } from '../api/types';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { GuidelineDrawer } from '../components/GuidelineDrawer';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';

export const TherapyScenariosPage: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: patient } = usePatient(activePatientId);
  const { data: scenariosData, isLoading } = useTherapyScenarios(activePatientId);

  const [selectedSnippet, setSelectedSnippet] = useState<GuidelineSnippet | null>(null);
  const [isGuidelineDrawerOpen, setIsGuidelineDrawerOpen] = useState(false);

  const handleOpenGuidelineSnippet = (guidelineId: string) => {
    setSelectedSnippet({
      id: guidelineId,
      topic: `Guideline ${guidelineId}`,
      text: `Evidence-based literature projection reference (${guidelineId}) grounded in standard clinical trial guidelines.`,
    });
    setIsGuidelineDrawerOpen(true);
  };

  if (!activePatientId) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          title="No Active Patient Selected"
          description="Select or create a patient to view therapeutic literature projections."
          actionText="Go to Patient Setup"
          onAction={() => (window.location.href = '/patient-setup')}
        />
      </div>
    );
  }

  const scenarios = scenariosData?.scenarios || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Therapy Scenarios & Projections</h1>
            <ProvenanceBadge provenance="PROJECTION" />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Population-level therapeutic HbA1c reductions and clinical trial literature projections across approved drug
            classes.
          </p>
        </div>
      </div>

      {/* Persistent Info Panel Explaining Why Projections are Not Twin-Predicted */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 border border-amber-500/30 text-amber-200 space-y-2">
        <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>Why are therapy outcomes not twin-predicted?</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          The Metabolic Twin bootstrap ensemble was trained exclusively on continuous glucose monitoring (CGM)
          postprandial meal responses over 2-hour windows. The models did not learn chronic pharmacological drug response
          dynamics across months. To maintain strict scientific integrity, all therapeutic reductions are reported as{' '}
          <strong className="text-amber-300">literature-grounded population projections (PROJECTION)</strong> rather
          than individualized twin forecasts.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-96 w-full" />
      ) : scenarios.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {scenarios.map((item: TherapyScenarioItem, idx: number) => {
            const hasRange = item.range && item.range.min != null && item.range.max != null;
            const minAbs = hasRange ? Math.abs(item.range!.min!) : 0;
            const maxAbs = hasRange ? Math.abs(item.range!.max!) : 0;

            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all space-y-4 shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Bar with Drug Class and Mandatory Projection Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block">
                        Pharmaceutical Class
                      </span>
                      <h3 className="text-lg font-bold text-white capitalize">
                        {item.drug_class.replace(/_/g, ' ')}
                      </h3>
                    </div>
                    <ProvenanceBadge provenance="PROJECTION" size="sm" />
                  </div>

                  {/* Mandatory Projection Label */}
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-medium">
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{item.projection_label || 'Population-literature projection, not a twin prediction'}</span>
                  </div>

                  {/* Expected Effect Summary */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Literature-Reported Effect:
                    </span>
                    <span className="text-slate-200 font-medium leading-relaxed block">
                      {item.expected_effect_literature}
                    </span>
                  </div>

                  {/* Hatched Amber Range Bar (Rendered only when numeric range exists) */}
                  {hasRange ? (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] uppercase font-semibold text-amber-400">
                          Expected HbA1c Reduction Range:
                        </span>
                        <span className="font-mono font-bold text-white">
                          -{minAbs.toFixed(1)}% to -{maxAbs.toFixed(1)}% HbA1c
                        </span>
                      </div>

                      {/* Hatched Horizontal Bar Visualizer */}
                      <div className="relative h-6 bg-slate-900 rounded-md overflow-hidden border border-slate-800 flex items-center">
                        {/* Reference 0-2.5% scale track */}
                        <div
                          className="absolute h-full pattern-hatched-amber border-y border-amber-500/40 rounded-sm"
                          style={{
                            left: `${Math.min(90, Math.max(5, (minAbs / 2.5) * 100))}%`,
                            width: `${Math.min(80, Math.max(15, ((maxAbs - minAbs) / 2.5) * 100))}%`,
                          }}
                        />
                        <span className="relative z-10 text-[10px] font-mono text-amber-200 px-2 font-semibold">
                          Literature Range: -{minAbs}% to -{maxAbs}%
                        </span>
                      </div>

                      <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                        <span>0.0% HbA1c</span>
                        <span>-1.0%</span>
                        <span>-2.0%</span>
                        <span>-2.5%+</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 text-[11px] text-slate-400">
                      Quantitative reduction range variable; see literature summary above.
                    </div>
                  )}

                  {/* Cautions */}
                  {item.cautions && item.cautions.length > 0 && (
                    <div className="text-xs space-y-1">
                      <span className="text-[10px] text-amber-400 uppercase font-semibold block">
                        Safety Cautions:
                      </span>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                        {item.cautions.map((c, cIdx) => (
                          <li key={cIdx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Monitoring */}
                  {item.monitoring && item.monitoring.length > 0 && (
                    <div className="text-xs space-y-1">
                      <span className="text-[10px] text-teal-400 uppercase font-semibold block">
                        Routine Monitoring:
                      </span>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[11px]">
                        {item.monitoring.map((m, mIdx) => (
                          <li key={mIdx}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Guideline Source Chips */}
                {item.guideline_ids && item.guideline_ids.length > 0 && (
                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 mr-1">Evidence Sources:</span>
                    {item.guideline_ids.map((gid) => (
                      <button
                        key={gid}
                        onClick={() => handleOpenGuidelineSnippet(gid)}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
                        title="Click to view guideline reference snippet"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>{gid}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No Permitted Options"
          description="Therapy options were suppressed by the Safety Governor or not returned for this patient profile."
        />
      )}

      {/* Guideline Snippet Drawer */}
      <GuidelineDrawer
        isOpen={isGuidelineDrawerOpen}
        onClose={() => setIsGuidelineDrawerOpen(false)}
        snippet={selectedSnippet}
      />
    </div>
  );
};
