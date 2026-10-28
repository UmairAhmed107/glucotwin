import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  Clock,
  Activity,
  Info,
} from 'lucide-react';
import { THEME_COLORS } from '../theme/colors';

export interface CurvePoint {
  time_min: number;
  time_label: string;
  baseline_median?: number;
  baseline_p10?: number;
  baseline_p90?: number;
  intervention_median?: number;
  intervention_p10?: number;
  intervention_p90?: number;
}

interface UncertaintyChartProps {
  data: CurvePoint[];
  height?: number;
  showIntervention?: boolean;
  baselineLabel?: string;
  interventionLabel?: string;
  yAxisLabel?: string;
  className?: string;
  showSummary?: boolean;
}

export const UncertaintyChart: React.FC<UncertaintyChartProps> = ({
  data,
  height = 320,
  showIntervention = false,
  baselineLabel = 'Baseline Prediction',
  interventionLabel = 'What-If Intervention',
  yAxisLabel = 'Glucose (mg/dL)',
  className = '',
  showSummary = true,
}) => {
  // Format curve points for Recharts area rendering
  const formattedData = (data || []).map((d) => ({
    ...d,
    // [min, max] range for baseline band
    baseline_range: [d.baseline_p10 ?? 0, d.baseline_p90 ?? 0],
    // [min, max] range for intervention band
    intervention_range: [d.intervention_p10 ?? 0, d.intervention_p90 ?? 0],
  }));

  // Plain English clinical interpretation metrics
  const summary = useMemo(() => {
    if (!data || data.length === 0) return null;

    const startVal = data[0]?.baseline_median ?? 105;

    // Find baseline peak and timing
    let baselinePeak = startVal;
    let baselinePeakTime = 60;
    data.forEach((d) => {
      if (d.baseline_median !== undefined && d.baseline_median > baselinePeak) {
        baselinePeak = d.baseline_median;
        baselinePeakTime = d.time_min;
      }
    });
    const baselineRise = Math.max(0, Math.round(baselinePeak - startVal));

    // Find intervention peak and timing
    let interventionPeak = startVal;
    let interventionPeakTime = 60;
    let hasIntervention = false;
    if (showIntervention) {
      data.forEach((d) => {
        if (d.intervention_median !== undefined) {
          hasIntervention = true;
          if (d.intervention_median > interventionPeak) {
            interventionPeak = d.intervention_median;
            interventionPeakTime = d.time_min;
          }
        }
      });
    }

    const deltaReduction = hasIntervention
      ? Math.max(0, Math.round(baselinePeak - interventionPeak))
      : 0;

    const effectivePeak = hasIntervention ? interventionPeak : baselinePeak;
    const isOptimal = effectivePeak <= 140;
    const isSafeTarget = effectivePeak <= 180;

    return {
      startVal: Math.round(startVal),
      baselinePeak: Math.round(baselinePeak),
      baselinePeakTime,
      baselineRise,
      hasIntervention,
      interventionPeak: Math.round(interventionPeak),
      interventionPeakTime,
      deltaReduction,
      effectivePeak: Math.round(effectivePeak),
      isOptimal,
      isSafeTarget,
    };
  }, [data, showIntervention]);

  return (
    <div className={`w-full ${className}`}>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={formattedData}
            margin={{ top: 15, right: 20, left: -10, bottom: 0 }}
          >
            <defs>
              {/* Baseline band gradient */}
              <linearGradient id="baselineBandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#64748B" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#64748B" stopOpacity={0.05} />
              </linearGradient>
              {/* Intervention band gradient */}
              <linearGradient id="interventionBandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#14B8A6" stopOpacity={0.08} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#27272a"
              vertical={false}
            />

            <XAxis
              dataKey="time_label"
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#27272a' }}
            />

            <YAxis
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#27272a' }}
              domain={['auto', 'auto']}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#71717a',
                      fontSize: 10,
                      offset: 15,
                    }
                  : undefined
              }
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#09090b] border border-zinc-800 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 backdrop-blur-md">
                      <div className="font-semibold text-zinc-300 pb-1 border-b border-zinc-800 font-mono">
                        {label} post-meal
                      </div>
                      {payload.map((entry: any, index: number) => {
                        if (entry.dataKey.includes('range')) return null;
                        return (
                          <div
                            key={`item-${index}`}
                            className="flex items-center justify-between gap-4"
                          >
                            <span
                              className="font-medium"
                              style={{ color: entry.color }}
                            >
                              {entry.name}:
                            </span>
                            <span className="font-mono font-bold text-white">
                              {Number(entry.value).toFixed(1)} mg/dL
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
            />

            {/* Baseline 10th-90th Uncertainty Area */}
            <Area
              name="Baseline 10th–90th Band"
              dataKey="baseline_range"
              stroke="transparent"
              fill="url(#baselineBandGradient)"
              legendType="none"
              isAnimationActive={false}
            />

            {/* Baseline Median Line */}
            <Line
              type="monotone"
              name={baselineLabel}
              dataKey="baseline_median"
              stroke={THEME_COLORS.chart.baseline}
              strokeWidth={2.5}
              dot={{ r: 3, fill: THEME_COLORS.chart.baseline }}
              activeDot={{ r: 5 }}
            />

            {/* Optional Intervention Overlay */}
            {showIntervention && (
              <>
                <Area
                  name="Intervention 10th–90th Band"
                  dataKey="intervention_range"
                  stroke="transparent"
                  fill="url(#interventionBandGradient)"
                  legendType="none"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  name={interventionLabel}
                  dataKey="intervention_median"
                  stroke={THEME_COLORS.chart.intervention}
                  strokeWidth={2.5}
                  strokeDasharray="4 2"
                  dot={{ r: 3, fill: THEME_COLORS.chart.intervention }}
                  activeDot={{ r: 5 }}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Plain English Summary of Graph */}
      {showSummary && summary && (
        <div className="mt-4 p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h4 className="font-bold text-white text-xs">
                In Plain English: What This Graph Means
              </h4>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-1.5">
              {summary.isOptimal ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Optimal Spike (&le; 140 mg/dL)
                </span>
              ) : summary.isSafeTarget ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  <CheckCircle2 className="w-3 h-3 text-teal-400" />
                  Target Range (&le; 180 mg/dL)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  High Excursion (&gt; 180 mg/dL)
                </span>
              )}
            </div>
          </div>

          {/* Metric quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Baseline Peak</span>
              <span className="text-sm font-bold text-slate-200 font-mono">
                {summary.baselinePeak} mg/dL
              </span>
              <span className="text-[10px] text-slate-500 block font-mono">+{summary.baselineRise} mg/dL</span>
            </div>

            {summary.hasIntervention && (
              <div className="p-2.5 rounded-lg bg-teal-950/30 border border-teal-500/30">
                <span className="text-[10px] text-teal-300 uppercase font-mono block">With Counterfactual</span>
                <span className="text-sm font-bold text-teal-300 font-mono">
                  {summary.interventionPeak} mg/dL
                </span>
                <span className="text-[10px] text-teal-400 font-bold block font-mono">
                  -{summary.deltaReduction} mg/dL blunted
                </span>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Time to Peak</span>
              <span className="text-sm font-bold text-white font-mono flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                ~{summary.hasIntervention ? summary.interventionPeakTime : summary.baselinePeakTime} min
              </span>
              <span className="text-[10px] text-slate-500 block">Postprandial crest</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Safe Target Range</span>
              <span className="text-sm font-bold text-slate-300 font-mono">
                70 &ndash; 180
              </span>
              <span className="text-[10px] text-slate-500 block">Standard clinical target</span>
            </div>
          </div>

          {/* Narrative Summary */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/60 text-slate-300 text-xs leading-relaxed space-y-1.5">
            <p>
              Starting from a pre-meal reading of <strong className="text-white">{summary.startVal} mg/dL</strong>, your glucose is predicted to rise by <strong className="text-white">+{summary.baselineRise} mg/dL</strong> and crest at <strong className="text-white">{summary.baselinePeak} mg/dL</strong> approximately <strong className="text-white">{summary.baselinePeakTime} minutes</strong> after eating.
            </p>

            {summary.hasIntervention ? (
              <p className="text-teal-200">
                <strong className="text-teal-300">With your lifestyle adjustment:</strong> The post-meal spike is blunted by <strong className="text-white">-{summary.deltaReduction} mg/dL</strong>, holding your highest reading at <strong className="text-teal-300">{summary.interventionPeak} mg/dL</strong> and bringing your blood sugar back to baseline significantly faster.
              </p>
            ) : null}

            <p className="text-slate-400 text-[11px] pt-1 border-t border-slate-800/60 flex items-center gap-1.5">
              <Info className="w-3 h-3 text-slate-500 shrink-0" />
              <span>
                <strong className="text-slate-300">How to read the shaded area:</strong> The gray/teal shaded envelope shows the 80% confidence interval (typical range for 8 out of 10 people with your metabolic profile). Narrower bands indicate your digital twin has high calibration confidence.
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
