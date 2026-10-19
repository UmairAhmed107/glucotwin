import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  HelpCircle,
  PlusCircle,
  Sparkles,
  TrendingUp,
  Utensils,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLogMeal, useLogReading, usePatient } from '../api/queries';
import { SectionCard, StatCard, EmptyState } from '../components/Cards';
import { TwinUpdatedPulse } from '../components/TwinUpdatedPulse';
import { ProvenanceBadge } from '../components/ProvenanceBadge';

interface StateSnapshot {
  mem_n: number;
  mem_mean_rise: number | null;
  confidence_score: number;
}

export const LogData: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: patient, refetch: refetchPatient } = usePatient(activePatientId);

  const [activeTab, setActiveTab] = useState<'meal' | 'reading'>('meal');

  // Meal Form State
  const [carbs, setCarbs] = useState<number>(55);
  const [protein, setProtein] = useState<number>(20);
  const [fat, setFat] = useState<number>(15);
  const [fiber, setFiber] = useState<number>(4);
  const [calories, setCalories] = useState<number>(435);
  const [preGlucose, setPreGlucose] = useState<number>(110);
  const [preTrend, setPreTrend] = useState<number>(0);
  const [timeOfDay, setTimeOfDay] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );

  // Optional Observed Outcomes
  const [showObserved, setShowObserved] = useState<boolean>(true);
  const [observedPeakRise, setObservedPeakRise] = useState<number | ''>(42);
  const [observedIauc, setObservedIauc] = useState<number | ''>(2750);
  const [observedDelta60, setObservedDelta60] = useState<number | ''>(35);
  const [observedDelta120, setObservedDelta120] = useState<number | ''>(10);
  const [activityAfterMin, setActivityAfterMin] = useState<number | ''>(15);

  // Glucose Reading Form State
  const [readingVal, setReadingVal] = useState<number>(128);
  const [readingTime, setReadingTime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [readingSource, setReadingSource] = useState<'manual' | 'replay'>('manual');

  // Before / After State Diff
  const [diffState, setDiffState] = useState<{
    before: StateSnapshot;
    after: StateSnapshot;
    timestamp: number;
  } | null>(null);

  const logMealMutation = useLogMeal(activePatientId || 0);
  const logReadingMutation = useLogReading(activePatientId || 0);

  // Auto calculate calories on macro change if not manually overriding
  const updateMacros = (c: number, p: number, f: number) => {
    setCarbs(c);
    setProtein(p);
    setFat(f);
    setCalories(Math.round(c * 4 + p * 4 + f * 9));
  };

  const handleMealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatientId || !patient) return;

    const beforeState: StateSnapshot = {
      mem_n: patient.twin_state?.mem_n ?? 0,
      mem_mean_rise: patient.twin_state?.mem_mean_rise ?? null,
      confidence_score: patient.twin_state?.confidence_score ?? 0.2,
    };

    const payload = {
      logged_at: new Date(timeOfDay).toISOString(),
      carbs_g: carbs,
      protein_g: protein,
      fat_g: fat,
      fibre_g: fiber > 0 ? fiber : null,
      calories: calories,
      pre_glucose: preGlucose,
      pre_trend30: preTrend,
      observed_peak_rise: observedPeakRise !== '' ? Number(observedPeakRise) : null,
      observed_iauc_2h: observedIauc !== '' ? Number(observedIauc) : null,
      observed_delta_60: observedDelta60 !== '' ? Number(observedDelta60) : null,
      observed_delta_120: observedDelta120 !== '' ? Number(observedDelta120) : null,
      activity_after_min: activityAfterMin !== '' ? Number(activityAfterMin) : null,
    };

    try {
      await logMealMutation.mutateAsync(payload);
      const updated = await refetchPatient();
      const updatedPatient = updated.data;

      const afterState: StateSnapshot = {
        mem_n: updatedPatient?.twin_state?.mem_n ?? beforeState.mem_n + 1,
        mem_mean_rise: updatedPatient?.twin_state?.mem_mean_rise ?? null,
        confidence_score: updatedPatient?.twin_state?.confidence_score ?? beforeState.confidence_score,
      };

      setDiffState({
        before: beforeState,
        after: afterState,
        timestamp: Date.now(),
      });
    } catch {
      // Toast handles error
    }
  };

  const handleReadingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatientId) return;

    try {
      await logReadingMutation.mutateAsync({
        ts: new Date(readingTime).toISOString(),
        value_mgdl: readingVal,
        source: readingSource,
      });
      refetchPatient();
    } catch {
      // Toast handles error
    }
  };

  if (!activePatientId) {
    return (
      <EmptyState
        title="No Active Patient Selected"
        description="Select or create a patient in the top bar before logging meals or glucose readings."
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-teal-400" />
            Log Metabolic Events
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Logging meals with observed outcomes triggers the running twin memory calibration.
          </p>
        </div>
        <ProvenanceBadge kind="TWIN_PREDICTED" size="sm" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-1">
        <button
          onClick={() => setActiveTab('meal')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'meal'
              ? 'border-teal-500 text-teal-400 bg-teal-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Log Meal & Macros</span>
        </button>

        <button
          onClick={() => setActiveTab('reading')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'reading'
              ? 'border-teal-500 text-teal-400 bg-teal-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Log Spot Glucose Reading</span>
        </button>
      </div>

      {/* BEFORE / AFTER STATE DIFF CARD */}
      {diffState && (
        <div className="p-4 rounded-xl border border-teal-500/40 bg-teal-950/20 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-teal-500/30 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <h4 className="text-xs font-bold text-teal-200 uppercase tracking-wider">
                Twin State Update Diff (Before vs. After)
              </h4>
            </div>
            <TwinUpdatedPulse trigger={diffState.timestamp} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* mem_n Diff */}
            <div className="bg-[#0B1220]/70 p-3 rounded-lg border border-teal-500/20">
              <span className="text-slate-400 text-[11px] block mb-1">
                Prior Real Meals (mem_n):
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-400 font-semibold">
                  {diffState.before.mem_n}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                <span className="font-mono text-teal-300 font-bold text-sm">
                  {diffState.after.mem_n}
                </span>
                <span className="text-[10px] text-teal-400 font-semibold bg-teal-500/20 px-1.5 py-0.2 rounded">
                  +1
                </span>
              </div>
            </div>

            {/* mem_mean_rise Diff */}
            <div className="bg-[#0B1220]/70 p-3 rounded-lg border border-teal-500/20">
              <span className="text-slate-400 text-[11px] block mb-1">
                Mean Historical Rise:
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-400 font-semibold">
                  {diffState.before.mem_mean_rise
                    ? `${diffState.before.mem_mean_rise.toFixed(1)} mg/dL`
                    : 'Pop. baseline'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                <span className="font-mono text-teal-300 font-bold text-sm">
                  {diffState.after.mem_mean_rise
                    ? `${diffState.after.mem_mean_rise.toFixed(1)} mg/dL`
                    : '--'}
                </span>
              </div>
            </div>

            {/* confidence_score Diff */}
            <div className="bg-[#0B1220]/70 p-3 rounded-lg border border-teal-500/20">
              <span className="text-slate-400 text-[11px] block mb-1">
                Twin Confidence Score:
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-400 font-semibold">
                  {(diffState.before.confidence_score * 100).toFixed(0)}%
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                <span className="font-mono text-teal-300 font-bold text-sm">
                  {(diffState.after.confidence_score * 100).toFixed(0)}%
                </span>
                {diffState.after.confidence_score > diffState.before.confidence_score && (
                  <span className="text-[10px] text-teal-400 font-semibold bg-teal-500/20 px-1.5 py-0.2 rounded">
                    +{(
                      (diffState.after.confidence_score - diffState.before.confidence_score) *
                      100
                    ).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MEAL LOG FORM */}
      {activeTab === 'meal' && (
        <SectionCard
          title="Nutritional Content & Pre-Meal Biomarkers"
          subtitle="Log meal macronutrients with 4/4/9 kcal math and optional post-meal glucose observations."
        >
          <form onSubmit={handleMealSubmit} className="space-y-5">
            {/* Timestamp & Pre-glucose */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Meal Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Pre-Meal Glucose (mg/dL)
                </label>
                <input
                  type="number"
                  required
                  min={40}
                  max={500}
                  value={preGlucose}
                  onChange={(e) => setPreGlucose(parseFloat(e.target.value))}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  30-Min Trend Rate (mg/dL/30min)
                </label>
                <input
                  type="number"
                  required
                  min={-100}
                  max={100}
                  value={preTrend}
                  onChange={(e) => setPreTrend(parseFloat(e.target.value))}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Macros */}
            <div className="pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-teal-400 mb-1.5">
                  Carbs (g)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={400}
                  value={carbs}
                  onChange={(e) => updateMacros(parseFloat(e.target.value) || 0, protein, fat)}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Protein (g)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={200}
                  value={protein}
                  onChange={(e) => updateMacros(carbs, parseFloat(e.target.value) || 0, fat)}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Fat (g)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={200}
                  value={fat}
                  onChange={(e) => updateMacros(carbs, protein, parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Fiber (g, opt)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={fiber}
                  onChange={(e) => setFiber(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-amber-400 mb-1.5 flex items-center justify-between">
                  <span>Calories</span>
                  <span className="text-[10px] text-slate-400 font-normal">4/4/9</span>
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={calories}
                  onChange={(e) => setCalories(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-bold"
                />
              </div>
            </div>

            {/* Optional Observed Outcomes Accordion */}
            <div className="pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowObserved(!showObserved)}
                className="flex items-center gap-2 text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
              >
                <span>{showObserved ? '▼' : '►'} Observed Postprandial Outcomes (Feeds Twin Memory)</span>
              </button>

              {showObserved && (
                <div className="mt-3 p-4 bg-[#0B1220] rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 animate-in fade-in">
                  <div>
                    <label className="block text-[11px] font-medium text-teal-300 mb-1">
                      Observed Peak Rise (mg/dL)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 42"
                      value={observedPeakRise}
                      onChange={(e) =>
                        setObservedPeakRise(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      className="w-full bg-[#111C30] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Observed 2h iAUC
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 2700"
                      value={observedIauc}
                      onChange={(e) =>
                        setObservedIauc(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      className="w-full bg-[#111C30] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      60-Min Delta (mg/dL)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 35"
                      value={observedDelta60}
                      onChange={(e) =>
                        setObservedDelta60(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      className="w-full bg-[#111C30] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      120-Min Delta (mg/dL)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 10"
                      value={observedDelta120}
                      onChange={(e) =>
                        setObservedDelta120(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      className="w-full bg-[#111C30] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Post-Activity (min)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 15"
                      value={activityAfterMin}
                      onChange={(e) =>
                        setActivityAfterMin(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      className="w-full bg-[#111C30] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={logMealMutation.isPending}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-[#0B1220] font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-teal-500/20"
              >
                {logMealMutation.isPending ? 'Recalibrating Twin Memory...' : 'Save Meal & Recalibrate Twin'}
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      {/* SPOT GLUCOSE READING FORM */}
      {activeTab === 'reading' && (
        <SectionCard
          title="Log Glucose Reading"
          subtitle="Record manual glucometer checks or continuous monitor spot values."
        >
          <form onSubmit={handleReadingSubmit} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Reading Timestamp
              </label>
              <input
                type="datetime-local"
                required
                value={readingTime}
                onChange={(e) => setReadingTime(e.target.value)}
                className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Blood Glucose Value (mg/dL)
              </label>
              <input
                type="number"
                required
                min={40}
                max={500}
                value={readingVal}
                onChange={(e) => setReadingVal(parseFloat(e.target.value))}
                className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Entry Source
              </label>
              <select
                value={readingSource}
                onChange={(e) => setReadingSource(e.target.value as any)}
                className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="manual">Manual Fingerstick Glucometer</option>
                <option value="replay">CGM Sensor Replay / Continuous</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={logReadingMutation.isPending}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-[#0B1220] font-semibold text-xs rounded-lg transition-colors shadow-lg shadow-teal-500/20"
              >
                {logReadingMutation.isPending ? 'Saving Reading...' : 'Save Glucose Reading'}
              </button>
            </div>
          </form>
        </SectionCard>
      )}
    </div>
  );
};
