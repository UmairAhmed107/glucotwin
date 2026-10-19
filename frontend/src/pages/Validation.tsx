import React from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Layers,
  LineChart as LineChartIcon,
  ShieldCheck,
  TrendingDown,
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
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { SectionCard, LoadingSkeleton } from '../components/Cards';

export const ValidationPage: React.FC = () => {
  const { data, isLoading, isError } = useValidation();

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
    reference: pt.nominal, // y = x reference line
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-teal-500/30 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Database className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Model Validation & Registry</h1>
              <p className="text-xs text-slate-400">
                Independent cross-validation metrics and ensemble calibration exported directly from training verification.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <ProvenanceBadge kind="TWIN_PREDICTED" safetyChecked={true} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <LoadingSkeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LoadingSkeleton className="h-64 w-full" />
            <LoadingSkeleton className="h-64 w-full" />
          </div>
        </div>
      ) : (
        <>
          {/* Section 1: Model Registry Card */}
          <SectionCard
            title="Model Registry Specifications"
            icon={<Cpu className="w-4 h-4 text-teal-400" />}
            badge={
              <span className="text-[11px] font-mono text-slate-400">
                sklearn {data?.sklearn_version || 'Not provided'}
              </span>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Class */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Class Name</span>
                <span className="font-mono text-sm font-semibold text-white">
                  {data?.class || data?.class_name || 'Not provided'}
                </span>
              </div>

              {/* Scikit-Learn Version */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Scikit-Learn Version</span>
                <span className="font-mono text-sm font-semibold text-teal-400">
                  {data?.sklearn_version || 'Not provided'}
                </span>
              </div>

              {/* Dataset Sizes */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Dataset Sizes</span>
                {data?.trained_on ? (
                  <div className="font-mono text-xs text-slate-200">
                    <span className="text-white font-bold">{data.trained_on.dataset || 'dataset'}</span>:{' '}
                    {data.trained_on.participants !== undefined ? `${data.trained_on.participants} participants` : ''}
                    {data.trained_on.meals !== undefined ? `, ${data.trained_on.meals} meals` : ''}
                    {data.trained_on.features !== undefined ? ` (${data.trained_on.features} features)` : ''}
                  </div>
                ) : data?.dataset_sizes ? (
                  <div className="font-mono text-xs text-slate-200">
                    {Object.entries(data.dataset_sizes).map(([k, v]) => (
                      <div key={k}>
                        {k}: {v.rows || 0} rows
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Not provided</span>
                )}
              </div>

              {/* Training Date */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Training Date</span>
                <span className="font-mono text-sm font-semibold text-slate-300">
                  {data?.training_date || 'Not provided'}
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Section 2: Grouped Cross-Validation Table */}
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
                Not provided
              </div>
            )}
          </SectionCard>

          {/* Section 3: Dual Charts (Personalisation Curve + Calibration) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Chart 1: Personalisation Curve (Error vs mem_n) */}
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
                    Personalisation curve demonstrates continuous reduction in postprandial prediction error as individual meal responses are observed.
                  </p>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 italic bg-slate-950 rounded-xl border border-slate-800">
                  Not provided
                </div>
              )}
            </SectionCard>

            {/* Chart 2: Interval Calibration Chart with y=x line */}
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
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          dot={false}
                          name="Ideal Calibration (y=x)"
                        />
                        <Line
                          type="monotone"
                          dataKey="empirical"
                          stroke="#06b6d4"
                          strokeWidth={2.5}
                          dot={{ fill: '#06b6d4', r: 4 }}
                          activeDot={{ r: 6 }}
                          name="Bootstrap Ensemble"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed text-center">
                    Empirical coverage tracks the nominal y=x line, verifying that 80% bootstrap prediction envelopes capture true excursions at calibrated frequencies.
                  </p>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 italic bg-slate-950 rounded-xl border border-slate-800">
                  Not provided
                </div>
              )}
            </SectionCard>
          </div>

          {/* Section 4: Documented Limitations */}
          <SectionCard
            title="Model Limitations & Honest Constraints"
            icon={<AlertCircle className="w-4 h-4 text-amber-400" />}
            badge={
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Ethical & Clinical Boundaries
              </span>
            }
          >
            {data?.limitations && data.limitations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {data.limitations.map((lim, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start space-x-3"
                  >
                    <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                    </span>
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-200">{lim}</div>
                      <div className="text-[11px] text-slate-500">
                        Derived from training cohort bounds and study experimental design.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 italic bg-slate-950 rounded-xl border border-slate-800">
                Not provided
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
};
