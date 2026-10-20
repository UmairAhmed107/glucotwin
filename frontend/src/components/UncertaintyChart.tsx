import React from 'react';
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
}

export const UncertaintyChart: React.FC<UncertaintyChartProps> = ({
  data,
  height = 320,
  showIntervention = false,
  baselineLabel = 'Baseline Prediction',
  interventionLabel = 'What-If Intervention',
  yAxisLabel = 'Glucose (mg/dL)',
  className = '',
}) => {
  // Format curve points for Recharts area rendering
  const formattedData = (data || []).map((d) => ({
    ...d,
    // [min, max] range for baseline band
    baseline_range: [d.baseline_p10 ?? 0, d.baseline_p90 ?? 0],
    // [min, max] range for intervention band
    intervention_range: [d.intervention_p10 ?? 0, d.intervention_p90 ?? 0],
  }));

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
              stroke="#1E293B"
              vertical={false}
            />

            <XAxis
              dataKey="time_label"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1E293B' }}
            />

            <YAxis
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1E293B' }}
              domain={['auto', 'auto']}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#64748B',
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
                    <div className="bg-[#111C30] border border-slate-700/80 p-3 rounded-lg shadow-xl text-xs space-y-1.5 backdrop-blur-md">
                      <div className="font-semibold text-slate-300 pb-1 border-b border-slate-800">
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
                            <span className="font-mono font-bold text-slate-100">
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
    </div>
  );
};
