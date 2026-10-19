import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FastForward,
  Info,
  LineChart as LineChartIcon,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Utensils,
  Zap,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { usePatient, useReplayStart } from '../api/queries';
import { BASE_URL } from '../api/client';
import { ReplayPointEvent } from '../api/types';
import { SectionCard, StatCard, LoadingSkeleton } from '../components/Cards';
import { ProvenanceBadge } from '../components/ProvenanceBadge';

interface ChartPoint {
  index: number;
  timeStr: string;
  timestamp: string;
  glucose: number;
  meal?: {
    meal_type?: string;
    carbs_g?: number;
    protein_g?: number;
    fat_g?: number;
    calories?: number;
  };
  predictedGlucose?: number | null;
  predP10?: number | null;
  predP90?: number | null;
  isMealMarker?: boolean;
}

interface DetectedMealRecord {
  timestamp: string;
  meal_type: string;
  carbs_g: number;
  calories: number;
  pre_glucose: number;
  predicted_rise: number;
  predicted_peak: number;
  p10: number;
  p90: number;
}

export const ReplayPage: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: patient } = usePatient(activePatientId);

  // Default participant: patient's cgmacros_participant_id if available, otherwise 1
  const defaultParticipant = patient?.cgmacros_participant_id || 1;
  const [participantId, setParticipantId] = useState<number>(defaultParticipant);
  const [speed, setSpeed] = useState<1 | 10 | 60>(10);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isUnavailable, setIsUnavailable] = useState<boolean>(false);
  const [unavailableMessage, setUnavailableMessage] = useState<string>('');
  const [pointsCount, setPointsCount] = useState<number>(0);

  // Stream data
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [detectedMeals, setDetectedMeals] = useState<DetectedMealRecord[]>([]);
  const [currentGlucose, setCurrentGlucose] = useState<number | null>(null);
  const [prevGlucose, setPrevGlucose] = useState<number | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const replayStartMutation = useReplayStart(participantId);

  // Sync default participant if patient loads
  useEffect(() => {
    if (patient?.cgmacros_participant_id) {
      setParticipantId(patient.cgmacros_participant_id);
    }
  }, [patient?.cgmacros_participant_id]);

  // Clean up SSE connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleStart = async (requestedSpeed = speed) => {
    setIsUnavailable(false);
    setIsCompleted(false);

    try {
      // 1. Initialise via POST /replay/{participant_id}/start
      await replayStartMutation.mutateAsync({ speed: requestedSpeed });

      // 2. Open Server-Sent Events stream
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const streamUrl = `${BASE_URL}/replay/${participantId}/stream?speed=${requestedSpeed}`;
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;
      setIsPlaying(true);

      es.onmessage = (event) => {
        try {
          const data: ReplayPointEvent = JSON.parse(event.data);

          if (data.type === 'complete') {
            setIsPlaying(false);
            setIsCompleted(true);
            es.close();
            return;
          }

          if (data.type === 'error') {
            setIsPlaying(false);
            es.close();
            return;
          }

          if (data.glucose !== undefined && data.timestamp) {
            const timeFormatted = new Date(data.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            const newPoint: ChartPoint = {
              index: data.index ?? chartData.length,
              timeStr: timeFormatted,
              timestamp: data.timestamp,
              glucose: data.glucose,
              meal: data.meal,
              isMealMarker: data.type === 'meal',
            };

            setCurrentGlucose((curr) => {
              if (curr !== null) {
                setPrevGlucose(curr);
              }
              return data.glucose !== undefined ? data.glucose : null;
            });
            setPointsCount((cnt) => cnt + 1);

            // If a meal arrived with a twin prediction, record it and synthesize predicted response points
            if (data.type === 'meal' && data.predicted_response && data.meal) {
              const pred = data.predicted_response;
              const newMealRec: DetectedMealRecord = {
                timestamp: data.timestamp,
                meal_type: data.meal.meal_type || 'Meal',
                carbs_g: data.meal.carbs_g || 0,
                calories: data.meal.calories || 0,
                pre_glucose: data.glucose,
                predicted_rise: pred.peak_rise || 0,
                predicted_peak: pred.predicted_peak || (data.glucose + (pred.peak_rise || 0)),
                p10: pred.p10 || 0,
                p90: pred.p90 || 0,
              };

              setDetectedMeals((prev) => [newMealRec, ...prev]);

              // Attach initial predicted point to marker
              newPoint.predictedGlucose = data.glucose;
            }

            setChartData((prev) => {
              const updated = [...prev, newPoint];
              // Keep maximum last 120 points for smooth rendering
              return updated.length > 120 ? updated.slice(updated.length - 120) : updated;
            });
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      };

      es.onerror = (err) => {
        console.warn('Replay stream closed or encountered error:', err);
        setIsPlaying(false);
        es.close();
      };
    } catch (err: any) {
      console.error('Replay failed to start:', err);
      setIsPlaying(false);
      setIsUnavailable(true);
      setUnavailableMessage(
        err?.message || 'CGMacros glucose time series dataset is not available on this server.'
      );
    }
  };

  const handlePause = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleReset = () => {
    handlePause();
    setChartData([]);
    setDetectedMeals([]);
    setCurrentGlucose(null);
    setPrevGlucose(null);
    setPointsCount(0);
    setIsCompleted(false);
  };

  const handleSpeedChange = (newSpeed: 1 | 10 | 60) => {
    setSpeed(newSpeed);
    if (isPlaying) {
      // Reconnect with new speed multiplier
      handleStart(newSpeed);
    }
  };

  // Metrics computation for live display
  const inRangePoints = chartData.filter((p) => p.glucose >= 70 && p.glucose <= 180).length;
  const tirPct = chartData.length > 0 ? Math.round((inRangePoints / chartData.length) * 100) : 100;
  const glucoseDelta =
    currentGlucose !== null && prevGlucose !== null ? roundOne(currentGlucose - prevGlucose) : 0;

  function roundOne(n: number) {
    return Math.round(n * 10) / 10;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* MANDATORY DISCLAIMER LABEL */}
      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
        <div className="flex items-center space-x-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="font-semibold tracking-wide uppercase text-[11px] text-amber-300">
            Replay of recorded data, not live monitoring
          </span>
          <span className="text-slate-400 hidden sm:inline">
            &bull; Streaming recorded interstitial glucose measurements from clinical trial dataset.
          </span>
        </div>
        <ProvenanceBadge kind="TWIN_PREDICTED" safetyChecked={true} size="sm" />
      </div>

      {/* Replay Controls & Participant Header */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <span className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <LineChartIcon className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Continuous Glucose Monitor Sensor Replay
                </h1>
                <p className="text-xs text-slate-400 font-mono">
                  Participant #{participantId} &bull; Transmitted points: {pointsCount}
                  {isCompleted && ' (Playback Finished)'}
                </p>
              </div>
            </div>
          </div>

          {/* Speed Controls: 1x, 10x, 60x */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 px-2">Speed:</span>
              {[1, 10, 60].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s as 1 | 10 | 60)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    speed === s
                      ? 'bg-teal-500 text-slate-950 shadow-sm shadow-teal-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Playback Actions */}
            <div className="flex items-center space-x-2">
              {isPlaying ? (
                <button
                  onClick={handlePause}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  onClick={() => handleStart()}
                  disabled={replayStartMutation.isPending}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-teal-500/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{chartData.length > 0 ? 'Resume' : 'Start Replay'}</span>
                </button>
              )}

              <button
                onClick={handleReset}
                title="Reset Replay"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Explanatory Empty State when 503 is returned */}
      {isUnavailable && (
        <div className="p-8 rounded-2xl bg-slate-900 border border-rose-500/30 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-bold text-white">Recorded CGM Dataset Not Available</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {unavailableMessage ||
                'The CGMacros continuous glucose monitor time series dataset was not found on the server.'}
            </p>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 text-left">
              To enable live replay, configure <span className="text-teal-400">REPLAY_DATA_PATH</span> in{' '}
              <span className="text-white">backend/.env</span> pointing to a valid CGM time series CSV.
            </div>
          </div>
          <button
            onClick={() => handleStart()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Live Chart & Telemetry Dashboard */}
      {!isUnavailable && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Main Chart Column (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            <SectionCard
              title="Recorded Sensor Glucose Excursion Profile"
              icon={<Activity className="w-4 h-4 text-teal-400" />}
              badge={
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                    isPlaying
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isPlaying ? `Streaming (${speed}x)` : isCompleted ? 'Completed' : 'Ready'}
                </span>
              }
            >
              {chartData.length > 0 ? (
                <div className="space-y-3">
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 15, right: 20, bottom: 20, left: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                        <XAxis
                          dataKey="timeStr"
                          stroke="#94a3b8"
                          fontSize={10}
                          tickLine={false}
                          label={{
                            value: 'Recorded Sensor Time',
                            position: 'insideBottom',
                            offset: -12,
                            fill: '#94a3b8',
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={10}
                          domain={[50, 260]}
                          tickLine={false}
                          label={{
                            value: 'Glucose (mg/dL)',
                            angle: -90,
                            position: 'insideLeft',
                            offset: 5,
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
                          formatter={(val: any, name: any) => [
                            `${Number(val).toFixed(1)} mg/dL`,
                            name === 'glucose'
                              ? 'Recorded Glucose'
                              : 'Twin Predicted Excursion',
                          ]}
                          labelFormatter={(label, items) => {
                            const pt = items?.[0]?.payload as ChartPoint;
                            if (pt?.meal?.meal_type) {
                              return `${label} • [Meal: ${pt.meal.meal_type} (${pt.meal.carbs_g}g carbs)]`;
                            }
                            return `${label}`;
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                        />

                        {/* Standard Glycemic Target Range Shading: 70 - 180 mg/dL */}
                        <ReferenceArea
                          y1={70}
                          y2={180}
                          fill="#0f766e"
                          fillOpacity={0.06}
                          strokeOpacity={0}
                        />
                        <ReferenceLine
                          y={180}
                          stroke="#f59e0b"
                          strokeDasharray="3 3"
                          strokeOpacity={0.5}
                          label={{
                            value: '180 Target Ceiling',
                            position: 'insideTopRight',
                            fill: '#f59e0b',
                            fontSize: 9,
                          }}
                        />
                        <ReferenceLine
                          y={70}
                          stroke="#ef4444"
                          strokeDasharray="3 3"
                          strokeOpacity={0.5}
                          label={{
                            value: '70 Target Floor',
                            position: 'insideBottomRight',
                            fill: '#ef4444',
                            fontSize: 9,
                          }}
                        />

                        {/* Meal Marker Reference Lines */}
                        {chartData
                          .filter((p) => p.isMealMarker)
                          .map((m, mIdx) => (
                            <ReferenceLine
                              key={`meal-${mIdx}`}
                              x={m.timeStr}
                              stroke="#f59e0b"
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                              label={{
                                value: `🍽️ ${m.meal?.meal_type || 'Meal'} (${m.meal?.carbs_g}g)`,
                                position: 'insideTopLeft',
                                fill: '#f59e0b',
                                fontSize: 9,
                              }}
                            />
                          ))}

                        {/* Recorded Glucose Trajectory */}
                        <Line
                          type="monotone"
                          dataKey="glucose"
                          stroke="#14b8a6"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: '#14b8a6' }}
                          name="Recorded CGM (Sensor)"
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" />
                      <span>Recorded sensor stream</span>
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                      <span>Arriving meal events (with Twin Predicted Response)</span>
                    </span>
                    <span className="flex items-center space-x-1.5 text-slate-400">
                      <span>Green target band: 70–180 mg/dL</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center space-y-3">
                  <LineChartIcon className="w-10 h-10 text-slate-600 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white">Playback Ready</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Click "Start Replay" above to stream recorded glucose points and watch the digital twin's responses to incoming meals.
                    </p>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Telemetry Column (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Live Metric Ring / Stat */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-slate-400">Current Reading</span>
                <span className="text-[10px] font-mono text-slate-500">Live Buffer</span>
              </div>

              <div className="flex items-baseline space-x-3">
                <div className="text-4xl font-extrabold text-white tracking-tight font-mono">
                  {currentGlucose !== null ? currentGlucose.toFixed(1) : '--.-'}
                </div>
                <div className="text-xs font-semibold text-slate-400">mg/dL</div>

                {glucoseDelta !== 0 && (
                  <span
                    className={`inline-flex items-center text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                      glucoseDelta > 0
                        ? 'text-amber-400 bg-amber-500/10'
                        : 'text-emerald-400 bg-emerald-500/10'
                    }`}
                  >
                    {glucoseDelta > 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    )}
                    {Math.abs(glucoseDelta)}
                  </span>
                )}
              </div>

              {/* Time in Range & Summary */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] text-slate-500 block">Time in Range</span>
                  <span className="text-base font-bold text-teal-400">{tirPct}%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] text-slate-500 block">Meals Detected</span>
                  <span className="text-base font-bold text-amber-400">{detectedMeals.length}</span>
                </div>
              </div>
            </div>

            {/* Detected Meals & Twin Predicted Response Cards */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Utensils className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-white text-sm">Arriving Meal Markers</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {detectedMeals.length} recorded
                </span>
              </div>

              {detectedMeals.length > 0 ? (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {detectedMeals.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 font-bold text-white capitalize">
                          <span>{m.meal_type}</span>
                          <span className="text-slate-500 font-normal">({m.carbs_g}g carbs)</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Twin Forecast for this meal */}
                      <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[11px] font-mono space-y-0.5">
                        <div className="flex justify-between text-teal-300">
                          <span>Twin Predicted Rise:</span>
                          <span className="font-bold">+{m.predicted_rise.toFixed(1)} mg/dL</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[10px]">
                          <span>80% Bootstrap Envelope:</span>
                          <span>
                            [{m.p10.toFixed(1)} – {m.p90.toFixed(1)}] mg/dL
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[10px]">
                          <span>Forecasted Peak:</span>
                          <span className="text-white font-semibold">
                            ~{m.predicted_peak.toFixed(0)} mg/dL
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  No meal events encountered yet in stream.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
