import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Calendar,
  Clock,
  Filter,
  Layers,
  Sparkles,
  TrendingUp,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePatient, useTimeline } from '../api/queries';
import { TimelineEvent } from '../api/types';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { SectionCard, StatCard, EmptyState, LoadingSkeleton } from '../components/Cards';

export const TimelinePage: React.FC = () => {
  const { activePatientId } = useApp();
  const { data: patient } = usePatient(activePatientId);
  const { data: timelineData, isLoading } = useTimeline(activePatientId);

  // Filters state
  const [filterType, setFilterType] = useState<'all' | 'meal' | 'reading' | 'recommendation'>('all');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  if (!activePatientId) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          title="No Active Patient Selected"
          description="Select or create a patient to view their metabolic timeline history."
          actionText="Go to Patient Setup"
          onAction={() => (window.location.href = '/patient-setup')}
        />
      </div>
    );
  }

  const rawEvents = timelineData?.events || [];
  // Sort reverse-chronological (newest first)
  const sortedEvents = [...rawEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const filteredEvents = sortedEvents.filter((e) => {
    if (filterType === 'all') return true;
    return e.type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Metabolic Event Timeline</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-300">
              {filteredEvents.length} Events Logged
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Chronological audit of meal intake events, CGM glucose measurements, and clinical decision recommendations.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterType === 'all'
                ? 'bg-teal-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Events
          </button>
          <button
            onClick={() => setFilterType('meal')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterType === 'meal'
                ? 'bg-teal-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Meals
          </button>
          <button
            onClick={() => setFilterType('reading')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterType === 'reading'
                ? 'bg-teal-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Readings
          </button>
          <button
            onClick={() => setFilterType('recommendation')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterType === 'recommendation'
                ? 'bg-teal-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Recommendations
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-96 w-full" />
      ) : filteredEvents.length > 0 ? (
        <div className="relative pl-6 sm:pl-8 border-l border-slate-800 space-y-6">
          {filteredEvents.map((event: TimelineEvent) => {
            const isMeal = event.type === 'meal';
            const isReading = event.type === 'reading';
            const isRec = event.type === 'recommendation';
            const dateStr = new Date(event.timestamp).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={`${event.type}-${event.id}`} className="relative group">
                {/* Timeline Node Dot */}
                <div
                  className={`absolute -left-[31px] sm:-left-[39px] top-4 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110 ${
                    isMeal
                      ? 'bg-slate-950 border-teal-500 text-teal-400'
                      : isReading
                      ? 'bg-slate-950 border-cyan-500 text-cyan-400'
                      : 'bg-slate-950 border-indigo-500 text-indigo-400'
                  }`}
                >
                  {isMeal && <Utensils className="w-3.5 h-3.5" />}
                  {isReading && <Activity className="w-3.5 h-3.5" />}
                  {isRec && <Sparkles className="w-3.5 h-3.5" />}
                </div>

                {/* Event Card */}
                <div
                  onClick={() => setSelectedEvent(event)}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded ${
                          isMeal
                            ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                            : isReading
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        {event.type}
                      </span>
                      <span className="font-mono text-slate-400">{dateStr}</span>
                    </div>

                    <span className="text-[10px] text-slate-500 group-hover:text-teal-400 transition-colors flex items-center space-x-1">
                      <span>View details</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>

                  {/* Meal Event Summary */}
                  {isMeal && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">
                          Meal Intake ({event.data.calories || 0} kcal)
                        </span>
                        {event.data.observed_peak_rise != null && (
                          <span className="text-xs font-mono font-bold text-teal-400">
                            +{event.data.observed_peak_rise} mg/dL observed rise
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-slate-300">
                        {event.data.carbs_g}g C • {event.data.protein_g}g P • {event.data.fat_g}g F • Pre:{' '}
                        {event.data.pre_glucose} mg/dL
                      </div>
                    </div>
                  )}

                  {/* Glucose Reading Event Summary */}
                  {isReading && (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-white">Spot Glucose Reading</span>
                        <span className="text-xs text-slate-500 block">Source: {event.data.source || 'manual'}</span>
                      </div>
                      <div className="text-xl font-bold font-mono text-cyan-400">
                        {event.data.value_mgdl}{' '}
                        <span className="text-xs font-normal text-slate-400">mg/dL</span>
                      </div>
                    </div>
                  )}

                  {/* Recommendation Event Summary */}
                  {isRec && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-white">
                          Clinical Guidance Recommendation
                        </span>
                        <ProvenanceBadge provenance={event.data.provenance || 'GUIDELINE_AI'} size="sm" />
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-2">
                        {event.data.payload?.patient_summary || 'Evidence-grounded recommendation logged.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No Timeline Events"
          description="Log meals or glucose readings to build the patient's longitudinal timeline."
          actionText="Log Data Now"
          onAction={() => (window.location.href = '/log')}
        />
      )}

      {/* Click-Through Details Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEvent(null)}
              className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto z-50 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="text-xs uppercase font-bold text-teal-400">
                    {selectedEvent.type} Event #{selectedEvent.id}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {new Date(selectedEvent.timestamp).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300">
                <pre className="whitespace-pre-wrap">{JSON.stringify(selectedEvent.data, null, 2)}</pre>
              </div>

              <div className="text-right">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
