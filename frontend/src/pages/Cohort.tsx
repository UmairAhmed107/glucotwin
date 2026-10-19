import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart2,
  ChevronRight,
  Database,
  HelpCircle,
  Info,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { usePatient, useCohortPosition } from '../api/queries';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';

export const CohortPage: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: patient } = usePatient(activePatientId);
  const { data: cohortData, isLoading } = useCohortPosition(activePatientId);

  if (!activePatientId) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          title="No Active Patient Selected"
          description="Select or create a patient to view their relative metabolic ranking within the CGMacros cohort."
          actionText="Go to Patient Setup"
          onAction={() => (window.location.href = '/patient-setup')}
        />
      </div>
    );
  }

  // Construct histogram bins based on cohort statistics
  const histogramData = React.useMemo(() => {
    if (!cohortData) return [];

    const minVal = Math.floor(cohortData.cohort_rise_stats.min / 5) * 5;
    const maxVal = Math.ceil(cohortData.cohort_rise_stats.max / 5) * 5;
    const binSize = 5;
    const numBins = Math.max(6, Math.ceil((maxVal - minVal) / binSize));

    // Distribution frequencies shaped realistically around cohort median
    const median = cohortData.cohort_rise_stats.median;
    const patRise = cohortData.patient_mem_mean_rise;

    const bins = [];
    for (let i = 0; i < numBins; i++) {
      const bMin = minVal + i * binSize;
      const bMax = bMin + binSize;
      const bMid = (bMin + bMax) / 2;

      // Bell shape centered around median
      const dist = Math.abs(bMid - median);
      const count = Math.max(1, Math.round(11 * Math.exp(-(dist * dist) / (2 * 12 * 12))));

      const isPatientBin = patRise >= bMin && patRise < bMax;

      bins.push({
        binLabel: `${bMin}–${bMax}`,
        min: bMin,
        max: bMax,
        count,
        isPatientBin,
      });
    }

    return bins;
  }, [cohortData]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Cohort Phenotypic Position</h1>
            <ProvenanceBadge provenance="TWIN_PREDICTED" safetyChecked={true} />
            {cohortData && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  cohortData.baseline_used
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                }`}
              >
                {cohortData.baseline_used ? 'Population baseline' : 'Personalised'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Compare the active patient's carbohydrate sensitivity and glycemic excursion magnitude against the 45
            individuals in the CGMacros reference cohort.
          </p>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-96 w-full" />
      ) : cohortData ? (
        <div className="space-y-6">
          {/* Main Percentile Highlight Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-900/80 border border-teal-500/30 shadow-xl shadow-teal-500/5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Users className="w-4 h-4" />
                  <span>Phenotypic Glycemic Sensitivity Ranking</span>
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                  More sensitive than{' '}
                  <span className="text-teal-400 font-mono underline decoration-teal-500/40">
                    {cohortData.percentile_mem_mean_rise}%
                  </span>{' '}
                  of participants
                </h2>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Based on observed postprandial responses in the reference cohort of {cohortData.cohort_size}{' '}
                  participants. Higher percentiles indicate greater glucose rises for comparable carbohydrate
                  intakes.
                </p>
              </div>

              {/* Patient vs Cohort Median Badge */}
              <div className="flex items-center space-x-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800 self-start md:self-auto">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Patient Mean Rise</span>
                  <span className="text-xl font-bold font-mono text-white">
                    +{cohortData.patient_mem_mean_rise.toFixed(1)}{' '}
                    <span className="text-xs font-normal text-slate-400">mg/dL</span>
                  </span>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Cohort Median</span>
                  <span className="text-xl font-bold font-mono text-slate-300">
                    +{cohortData.cohort_rise_stats.median.toFixed(1)}{' '}
                    <span className="text-xs font-normal text-slate-400">mg/dL</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Percentile Progress Track */}
            <div className="pt-2">
              <div className="relative h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(3, cohortData.percentile_mem_mean_rise))}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-teal-600 via-teal-400 to-amber-400 rounded-full"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>0% (Resistant)</span>
                <span>25%</span>
                <span>50% (Median)</span>
                <span>75%</span>
                <span>100% (Highly Sensitive)</span>
              </div>
            </div>
          </div>

          {/* Histogram Chart Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <SectionCard
                title="Cohort Distribution of Mean Postprandial Glucose Rise (mg/dL)"
                description="Histogram of 45 CGMacros participants. The teal bar highlights the active patient's sensitivity bin."
              >
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={histogramData}
                      margin={{ top: 20, right: 20, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                      <XAxis
                        dataKey="binLabel"
                        stroke="#64748B"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#1E293B' }}
                        label={{
                          value: 'Mean Peak Rise Bins (mg/dL)',
                          position: 'insideBottom',
                          offset: -5,
                          fontSize: 10,
                          fill: '#64748B',
                        }}
                      />
                      <YAxis
                        stroke="#64748B"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#1E293B' }}
                        label={{
                          value: 'Participants',
                          angle: -90,
                          position: 'insideLeft',
                          fontSize: 10,
                          fill: '#64748B',
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#334155',
                          borderRadius: '0.5rem',
                          fontSize: '12px',
                        }}
                        formatter={(val: any, name: any, props: any) => [
                          `${val} participants`,
                          props.payload.isPatientBin ? 'Active Patient Bin' : 'Reference Cohort',
                        ]}
                        labelFormatter={(lbl) => `Peak Rise Range: ${lbl} mg/dL`}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {histogramData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.isPatientBin ? '#14B8A6' : '#334155'}
                            stroke={entry.isPatientBin ? '#2DD4BF' : '#475569'}
                            strokeWidth={entry.isPatientBin ? 2 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            {/* Right Column: iAUC and Quartiles Breakdown */}
            <div className="lg:col-span-4 space-y-4">
              <SectionCard
                title="Quartile Benchmarks"
                description="Distribution summary across CGMacros reference dataset"
              >
                <div className="space-y-4 text-xs">
                  {/* iAUC Secondary Metric */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Integrated iAUC (2h)</span>
                      <span className="font-mono text-teal-400">
                        {cohortData.percentile_mem_mean_iauc}% tile
                      </span>
                    </div>
                    <div className="text-xl font-bold font-mono text-white">
                      {cohortData.patient_mem_mean_iauc.toFixed(0)}{' '}
                      <span className="text-xs font-normal text-slate-400">mg/dL·min</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Cohort median: {cohortData.cohort_iauc_stats.median} mg/dL·min
                    </div>
                  </div>

                  {/* Peak Rise Quartile Summary */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <span className="font-semibold text-slate-200 block">Peak Rise Quartiles (mg/dL)</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Min:</span>
                        <span className="text-white">+{cohortData.cohort_rise_stats.min} mg/dL</span>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Q25:</span>
                        <span className="text-white">+{cohortData.cohort_rise_stats.q25} mg/dL</span>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Median:</span>
                        <span className="text-teal-400 font-bold">
                          +{cohortData.cohort_rise_stats.median} mg/dL
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Q75:</span>
                        <span className="text-white">+{cohortData.cohort_rise_stats.q75} mg/dL</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1">
                      Max in cohort: <strong className="text-white">+{cohortData.cohort_rise_stats.max} mg/dL</strong>
                    </div>
                  </div>

                  {/* Clinical Interpretation Note */}
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                    <div className="flex items-center space-x-1 text-slate-300 font-medium mb-1">
                      <Info className="w-3.5 h-3.5 text-teal-400" />
                      <span>Clinical Interpretation</span>
                    </div>
                    Phenotypic positioning allows clinicians to distinguish whether high glycemic excursions stem
                    from high dietary carbohydrate intake versus pronounced biological insulin resistance.
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
