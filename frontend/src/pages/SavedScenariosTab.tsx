import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark,
  Calendar,
  ChevronRight,
  Clock,
  Columns,
  Footprints,
  Layers,
  Scale,
  Sliders,
  Sparkles,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  useSavedScenarios,
  useDeleteSavedScenario,
  useCompareScenarios,
} from '../api/queries';
import { SavedScenario, ScenarioCompareResponse } from '../api/types';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';

export const SavedScenariosTab: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: scenarios = [], isLoading } = useSavedScenarios(activePatientId);
  const deleteMutation = useDeleteSavedScenario(activePatientId || 0);
  const compareMutation = useCompareScenarios(activePatientId || 0);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ScenarioCompareResponse | null>(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const handleCompare = async () => {
    if (selectedIds.length !== 2) return;
    try {
      const res = await compareMutation.mutateAsync({
        scenarioIdA: selectedIds[0],
        scenarioIdB: selectedIds[1],
      });
      setComparisonResult(res);
      setIsCompareOpen(true);
    } catch (err) {
      console.error('Failed to compare scenarios:', err);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this saved scenario?')) {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  if (!activePatientId) {
    return (
      <EmptyState
        title="No Active Patient Selected"
        description="Select a patient to view and compare saved what-if simulation scenarios."
      />
    );
  }

  if (isLoading) {
    return <LoadingSkeleton height="320px" />;
  }

  return (
    <div className="space-y-6">
      {/* Tab Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-teal-400" />
            <span>Saved What-If Scenarios</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Browse stored prospective simulations, evaluate tradeoffs, and compare any two scenarios side-by-side.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400 font-mono">
            {selectedIds.length}/2 selected for comparison
          </div>
          <button
            onClick={handleCompare}
            disabled={selectedIds.length !== 2 || compareMutation.isPending}
            className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            <Columns className="w-4 h-4" />
            <span>{compareMutation.isPending ? 'Comparing...' : 'Compare Scenarios'}</span>
          </button>
        </div>
      </div>

      {/* Scenarios Grid / List */}
      {scenarios.length === 0 ? (
        <EmptyState
          title="No Saved Scenarios Yet"
          description="Simulate interventions in the What-If Lab and click 'Save Scenario' to save them here for comparison."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((scen) => {
            const isSelected = selectedIds.includes(scen.id);
            const interventions = scen.inputs?.interventions || {};
            const meal = scen.inputs?.meal || {};
            const baseMed = scen.baseline_output?.median;
            const intervMed = scen.intervention_output?.median;
            const gain = baseMed && intervMed ? Math.round((baseMed - intervMed) * 10) / 10 : null;

            return (
              <div
                key={scen.id}
                onClick={() => toggleSelect(scen.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                  isSelected
                    ? 'bg-teal-950/20 border-teal-500 shadow-md shadow-teal-950/30 ring-1 ring-teal-500/50'
                    : 'bg-[#111C30] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-700 text-teal-500 focus:ring-teal-500 bg-slate-900 pointer-events-none"
                        />
                        <h4 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">
                          {scen.name}
                        </h4>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{new Date(scen.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDelete(scen.id, e)}
                      title="Delete Scenario"
                      className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {scen.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {scen.description}
                    </p>
                  )}

                  {/* Interventions Badges */}
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                    {interventions.carb_reduction_pct > 0 && (
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-teal-300">
                        -{interventions.carb_reduction_pct}% Carbs
                      </span>
                    )}
                    {interventions.meal_order && interventions.meal_order !== 'standard' && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                        {interventions.meal_order.replace('_', ' ')}
                      </span>
                    )}
                    {interventions.walk_duration_min > 0 && interventions.walk_intensity !== 'none' && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                        <Footprints className="w-3 h-3" />
                        {interventions.walk_duration_min}m {interventions.walk_intensity}
                      </span>
                    )}
                    {interventions.timing_shift_hours !== 0 && (
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {interventions.timing_shift_hours > 0 ? `+${interventions.timing_shift_hours}h` : `${interventions.timing_shift_hours}h`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer: Peak metrics */}
                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Predicted Peak:</span>
                    <span className="text-teal-300 font-bold">
                      {intervMed ? `+${intervMed} mg/dL` : 'N/A'}
                    </span>
                  </div>

                  {gain !== null && (
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px]">Gain vs Base:</span>
                      <span className={`font-bold ${gain > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {gain > 0 ? `-${gain} mg/dL` : `${gain} mg/dL`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      <AnimatePresence>
        {isCompareOpen && comparisonResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111C30] border border-slate-800 rounded-2xl p-6 max-w-3xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Columns className="w-5 h-5 text-teal-400" />
                  <h3 className="text-lg font-bold text-white">Side-by-Side Scenario Comparison</h3>
                </div>
                <button
                  onClick={() => setIsCompareOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Summary Banner */}
              <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-teal-400 flex-shrink-0" />
                <p className="text-xs text-teal-200 leading-relaxed font-medium">
                  {comparisonResult.comparison.summary}
                </p>
              </div>

              {/* Statistical Delta Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">Median Peak Delta</div>
                  <div className={`text-xl font-bold font-mono mt-1 ${
                    comparisonResult.comparison.median_diff_mgdl < 0 ? 'text-emerald-400' : 'text-slate-200'
                  }`}>
                    {comparisonResult.comparison.median_diff_mgdl > 0 ? `+` : ''}
                    {comparisonResult.comparison.median_diff_mgdl} mg/dL
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Scenario B vs Scenario A
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">80% Envelope Shift</div>
                  <div className="text-sm font-bold font-mono text-slate-200 mt-1">
                    ΔP10: {comparisonResult.comparison.p10_diff_mgdl} | ΔP90: {comparisonResult.comparison.p90_diff_mgdl}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">mg/dL uncertainty shift</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">Carb Cut Delta</div>
                  <div className="text-xl font-bold font-mono text-teal-300 mt-1">
                    {comparisonResult.comparison.carb_reduction_diff_pct > 0 ? `+` : ''}
                    {comparisonResult.comparison.carb_reduction_diff_pct}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Dietary restriction diff</div>
                </div>
              </div>

              {/* Side-by-Side Details Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Scenario A */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-xs font-mono text-slate-400 uppercase font-semibold">Scenario A</span>
                    <span className="text-xs font-bold text-white">{comparisonResult.scenario_a.name}</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Baseline Peak Rise:</span>
                      <span className="font-mono text-slate-200">
                        +{comparisonResult.scenario_a.baseline_output?.median} mg/dL
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Intervention Peak Rise:</span>
                      <span className="font-mono text-teal-300 font-bold">
                        +{comparisonResult.scenario_a.intervention_output?.median} mg/dL
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">80% Envelope:</span>
                      <span className="font-mono text-slate-400 text-[11px]">
                        [{comparisonResult.scenario_a.intervention_output?.p10} - {comparisonResult.scenario_a.intervention_output?.p90}] mg/dL
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 space-y-1">
                      <div className="text-slate-400 text-[11px]">Interventions:</div>
                      <div className="font-mono text-[11px] text-slate-300 space-y-0.5">
                        <div>• Carb Cut: {comparisonResult.scenario_a.inputs?.interventions?.carb_reduction_pct ?? 0}%</div>
                        <div>• Walk: {comparisonResult.scenario_a.inputs?.interventions?.walk_duration_min ?? 0}m ({comparisonResult.scenario_a.inputs?.interventions?.walk_intensity ?? 'none'})</div>
                        <div>• Order: {comparisonResult.scenario_a.inputs?.interventions?.meal_order ?? 'standard'}</div>
                        <div>• Shift: {comparisonResult.scenario_a.inputs?.interventions?.timing_shift_hours ?? 0}h</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scenario B */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-teal-500/30 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-xs font-mono text-teal-400 uppercase font-semibold">Scenario B</span>
                    <span className="text-xs font-bold text-teal-200">{comparisonResult.scenario_b.name}</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Baseline Peak Rise:</span>
                      <span className="font-mono text-slate-200">
                        +{comparisonResult.scenario_b.baseline_output?.median} mg/dL
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Intervention Peak Rise:</span>
                      <span className="font-mono text-teal-300 font-bold">
                        +{comparisonResult.scenario_b.intervention_output?.median} mg/dL
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">80% Envelope:</span>
                      <span className="font-mono text-slate-400 text-[11px]">
                        [{comparisonResult.scenario_b.intervention_output?.p10} - {comparisonResult.scenario_b.intervention_output?.p90}] mg/dL
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 space-y-1">
                      <div className="text-slate-400 text-[11px]">Interventions:</div>
                      <div className="font-mono text-[11px] text-slate-300 space-y-0.5">
                        <div>• Carb Cut: {comparisonResult.scenario_b.inputs?.interventions?.carb_reduction_pct ?? 0}%</div>
                        <div>• Walk: {comparisonResult.scenario_b.inputs?.interventions?.walk_duration_min ?? 0}m ({comparisonResult.scenario_b.inputs?.interventions?.walk_intensity ?? 'none'})</div>
                        <div>• Order: {comparisonResult.scenario_b.inputs?.interventions?.meal_order ?? 'standard'}</div>
                        <div>• Shift: {comparisonResult.scenario_b.inputs?.interventions?.timing_shift_hours ?? 0}h</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setIsCompareOpen(false)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Close Comparison
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
