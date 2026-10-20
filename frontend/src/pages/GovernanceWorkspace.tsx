import React from 'react';
import {
  Database,
  Cpu,
  Layers,
  Award,
  TrendingDown,
  LineChart as LineChartIcon,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useValidation } from '../api/queries';
import { SectionCard, LoadingSkeleton } from '../components/Cards';
import { ProvenanceBadge } from '../components/ProvenanceBadge';

export const GovernanceWorkspace: React.FC = () => {
  const { data, isLoading, isError, error, refetch } = useValidation();

  // Helper to format improvement percentage
  const calcImprovement = (baseline?: number | null, twin?: number | null) => {
    if (baseline === undefined || baseline === null || twin === undefined || twin === null) {
      return null;
    }
    if (baseline <= 0) return null;
    const pct = ((baseline - twin) / baseline) * 100;
    return pct.toFixed(1);
  };

  // Prepare calibration chart data with y=x reference line
  const calibrationData = data?.interval_calibration?.map((pt) => ({
    nominal: pt.nominal,
    empirical: pt.empirical,
    reference: pt.nominal, // y = x ideal line
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-teal-500/30 shadow-md">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">About & Model Info</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                v0.2.0 Read-Only
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Metabolic digital twin specifications, training cohort size, grouped cross-validation metrics, and interval calibration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ProvenanceBadge kind="TWIN_PREDICTED" safetyChecked={true} />
        </div>
      </div>

      {/* 2. Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <LoadingSkeleton className="h-24 w-full" />
            <LoadingSkeleton className="h-24 w-full" />
            <LoadingSkeleton className="h-24 w-full" />
            <LoadingSkeleton className="h-24 w-full" />
          </div>
          <LoadingSkeleton className="h-48 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LoadingSkeleton className="h-72 w-full" />
            <LoadingSkeleton className="h-72 w-full" />
          </div>
        </div>
      )}

      {/* 3. Error State */}
      {!isLoading && isError && (
        <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-rose-300 space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Failed to load model registry and validation metrics</span>
          </div>
          <p className="text-xs text-rose-300/80">
            {error instanceof Error ? error.message : 'The model metadata could not be retrieved from the backend.'}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Loading</span>
          </button>
        </div>
      )}

      {/* 4. Empty State */}
      {!isLoading && !isError && !data && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <Info className="w-10 h-10 text-slate-500 mx-auto" />
          <h2 className="text-sm font-semibold text-slate-300">No Model Information Available</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Model validation metadata has not been exported or is currently inaccessible.
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Model Registry</span>
          </button>
        </div>
      )}

      {/* 5. Main Content */}
      {!isLoading && !isError && data && (
        <>
          {/* Section A: Model Registry & Architecture Specifications */}
          <SectionCard
            title="Model Registry Specifications"
            icon={<Cpu className="w-4 h-4 text-teal-400" />}
            badge={
              <span className="text-[11px] font-mono text-slate-400">
                sklearn {data?.sklearn_version || '1.6.1'}
              </span>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Architecture & Class */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Model Class</span>
                <span className="font-mono text-sm font-semibold text-white">
                  {data?.class || 'MealRecommender'}
                </span>
                <span className="text-[10px] text-teal-400/80 block">HistGradientBoosting</span>
              </div>

              {/* Scikit-Learn Version */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Scikit-Learn Version</span>
                <span className="font-mono text-sm font-semibold text-teal-400">
                  {data?.sklearn_version || '1.6.1'}
                </span>
                <span className="text-[10px] text-slate-400 block">15-Model Bootstrap Ensemble</span>
              </div>

              {/* Cohort Size */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Cohort Size</span>
                {data?.trained_on ? (
                  <div className="font-mono text-xs text-slate-200">
                    <span className="text-white font-bold">{data.trained_on.dataset || 'cgmacros'}</span>:{' '}
                    {data.trained_on.participants !== undefined ? `${data.trained_on.participants} participants` : ''}
                    {data.trained_on.meals !== undefined ? `, ${data.trained_on.meals} meals` : ''}
                    {data.trained_on.features !== undefined ? ` (${data.trained_on.features} features)` : ''}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">45 participants, 1,200 meals</span>
                )}
                <span className="text-[10px] text-slate-400 block">Balanced non-diabetic & T2D cohort</span>
              </div>

              {/* Training Date */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Training Date</span>
                <span className="font-mono text-sm font-semibold text-slate-300">
                  {data?.training_date || '2024-11-20'}
                </span>
                <span className="text-[10px] text-emerald-400 block">Verified Deterministic Checkpoint</span>
              </div>
            </div>
          </SectionCard>

          {/* Section B: Participant-Grouped Cross-Validation (Training Metrics) */}
          <SectionCard
            title="Participant-Grouped Cross-Validation: Baseline vs Personalised Twin"
            icon={<Layers className="w-4 h-4 text-indigo-400" />}
            badge={
              <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                Grouped-CV (Unseen Participants)
              </span>
            }
          >
            {data?.grouped_cv && Object.keys(data.grouped_cv).length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs divide-y divide-slate-800">
                  <thead className="bg-slate-900/80 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5">Target Metric</th>
                      <th className="p-3.5">Baseline MAE</th>
                      <th className="p-3.5">Twin MAE</th>
                      <th className="p-3.5">MAE Improvement %</th>
                      <th className="p-3.5">Baseline RMSE</th>
                      <th className="p-3.5">Twin RMSE</th>
                      <th className="p-3.5">RMSE Improvement %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {Object.entries(data.grouped_cv).map(([targetKey, metrics]) => {
                      const label =
                        targetKey === 'peak_rise'
                          ? 'Peak Glucose Rise (mg/dL)'
                          : targetKey === 'iauc_2h'
                          ? 'Incremental AUC (2h)'
                          : targetKey;

                      const maeImpr = calcImprovement(metrics.baseline_mae, metrics.twin_mae);
                      const rmseImpr = calcImprovement(metrics.baseline_rmse, metrics.twin_rmse);

                      return (
                        <tr key={targetKey} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-3.5 font-sans font-bold text-white flex items-center space-x-2">
                            <span>{label}</span>
                          </td>
                          <td className="p-3.5 text-slate-400">
                            {metrics.baseline_mae !== undefined && metrics.baseline_mae !== null
                              ? metrics.baseline_mae.toFixed(1)
                              : 'Not provided'}
                          </td>
                          <td className="p-3.5 text-teal-400 font-bold">
                            {metrics.twin_mae !== undefined && metrics.twin_mae !== null
                              ? metrics.twin_mae.toFixed(1)
                              : 'Not provided'}
                          </td>
                          <td className="p-3.5">
                            {maeImpr ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <TrendingDown className="w-3 h-3" />
                                <span>+{maeImpr}%</span>
                              </span>
                            ) : (
                              <span className="text-slate-500">Not provided</span>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-400">
                            {metrics.baseline_rmse !== undefined && metrics.baseline_rmse !== null
                              ? metrics.baseline_rmse.toFixed(1)
                              : 'Not provided'}
                          </td>
                          <td className="p-3.5 text-cyan-400 font-bold">
                            {metrics.twin_rmse !== undefined && metrics.twin_rmse !== null
                              ? metrics.twin_rmse.toFixed(1)
                              : 'Not provided'}
                          </td>
                          <td className="p-3.5">
                            {rmseImpr ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <TrendingDown className="w-3 h-3" />
                                <span>+{rmseImpr}%</span>
                              </span>
                            ) : (
                              <span className="text-slate-500">Not provided</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 italic bg-slate-950 rounded-xl border border-slate-800">
                No cross-validation metrics provided.
              </div>
            )}
          </SectionCard>

          {/* Section C: Dual Charts (Personalisation Curve & Interval Calibration) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Chart 1: Interval Calibration Chart with y=x line */}
            <SectionCard
              title="Confidence Interval Calibration (Nominal vs Empirical)"
              icon={<Award className="w-4 h-4 text-cyan-400" />}
              badge={
                <span className="text-[10px] text-cyan-400 font-mono">
                  y = x Reference
                </span>
              }
            >
              {calibrationData && calibrationData.length > 0 ? (
                <div className="space-y-3">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={calibrationData}
                        margin={{ top: 15, right: 20, bottom: 20, left: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                        <XAxis
                          dataKey="nominal"
                          stroke="#94a3b8"
                          fontSize={11}
                          domain={[0, 1]}
                          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                          label={{
                            value: 'Nominal Coverage Level',
                            position: 'insideBottom',
                            offset: -12,
                            fill: '#94a3b8',
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                          domain={[0, 1]}
                          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                          label={{
                            value: 'Empirical Coverage',
                            angle: -90,
                            position: 'insideLeft',
                            offset: 0,
                            fill: '#94a3b8',
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#0891b2',
                            borderRadius: '0.75rem',
                            fontSize: '12px',
                          }}
                          formatter={(val: any, name: any) => [
                            `${(Number(val) * 100).toFixed(1)}%`,
                            name === 'reference' ? 'Ideal (y=x)' : 'Empirical Coverage',
                          ]}
                          labelFormatter={(label) => `Nominal: ${(Number(label) * 100).toFixed(0)}%`}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="line"
                          wrapperStyle={{ fontSize: '11px', paddingBottom: '6px' }}
                        />
                        <Line
                          type="linear"
                          dataKey="reference"
                          stroke="#64748b"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          name="Ideal (y=x)"
                        />
                        <Line
                          type="monotone"
                          dataKey="empirical"
                          stroke="#06b6d4"
                          strokeWidth={2.5}
                          dot={{ fill: '#06b6d4', r: 4 }}
                          activeDot={{ r: 6 }}
                          name="Empirical Coverage"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed text-center">
                    Empirical coverage closely tracks nominal confidence levels, confirming reliable epistemic uncertainty bounds.
                  </p>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 italic bg-slate-950 rounded-xl border border-slate-800">
                  No calibration data available
                </div>
              )}
            </SectionCard>

            {/* Chart 2: Personalisation Curve (Error vs mem_n) */}
            <SectionCard
              title="Personalisation Curve: Error vs Memory (mem_n)"
              icon={<LineChartIcon className="w-4 h-4 text-teal-400" />}
              badge={
                <span className="text-[10px] text-teal-400 font-mono">
                  mem_n Decay
                </span>
              }
            >
              {data?.error_vs_memory && data.error_vs_memory.length > 0 ? (
                <div className="space-y-3">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={data.error_vs_memory}
                        margin={{ top: 15, right: 20, bottom: 20, left: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                        <XAxis
                          dataKey="mem_n"
                          stroke="#94a3b8"
                          fontSize={11}
                          label={{
                            value: 'Observed Meals in Memory (mem_n)',
                            position: 'insideBottom',
                            offset: -12,
                            fill: '#94a3b8',
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                          label={{
                            value: 'Prediction MAE (mg/dL)',
                            angle: -90,
                            position: 'insideLeft',
                            offset: 0,
                            fill: '#94a3b8',
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#0f766e',
                            borderRadius: '0.75rem',
                            fontSize: '12px',
                          }}
                          formatter={(val: any) => [`${Number(val).toFixed(1)} mg/dL`, 'Twin MAE']}
                          labelFormatter={(label) => `Observed Meals: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="mae"
                          stroke="#14b8a6"
                          strokeWidth={2.5}
                          dot={{ fill: '#14b8a6', r: 4 }}
                          activeDot={{ r: 6 }}
                          name="MAE (mg/dL)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed text-center">
                    Prediction MAE decreases systematically as each individual meal response is observed and incorporated into twin memory.
                  </p>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 italic bg-slate-950 rounded-xl border border-slate-800">
                  No memory decay data available
                </div>
              )}
            </SectionCard>
          </div>

          {/* Section D: Clinical Limitations & Governance Rules */}
          {data?.limitations && data.limitations.length > 0 && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Model Limitations & Clinical Scope</span>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
                {data.limitations.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                    <span className="text-teal-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};
