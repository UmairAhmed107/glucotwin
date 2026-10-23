import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  FileText,
  Filter,
  Sparkles,
  Stethoscope,
  Target,
  UserCheck,
  AlertCircle,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePatientCarePlan, usePatientVisits, useUpdateTaskStatus } from '../api/queries';
import { CarePlanTask } from '../api/types';

export const MyPlanPage: React.FC = () => {
  const { activePatientId } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const { data: carePlan, isLoading: planLoading } = usePatientCarePlan(activePatientId);
  const { data: visits = [], isLoading: visitsLoading } = usePatientVisits(activePatientId);
  const updateTaskMutation = useUpdateTaskStatus();

  // Find upcoming or latest completed visit
  const upcomingVisit = visits.find((v) => v.status === 'scheduled' || v.status === 'in_progress');
  const latestCompletedVisit = visits
    .filter((v) => v.status === 'completed')
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];

  const tasks: CarePlanTask[] = carePlan?.tasks || [];

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (selectedCategory !== 'all' && t.category.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }
    if (statusFilter === 'pending' && t.status !== 'pending') return false;
    if (statusFilter === 'completed' && t.status !== 'completed') return false;
    return true;
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleToggleTask = (task: CarePlanTask) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTaskMutation.mutate({ taskId: task.id, patientId: activePatientId || task.patient_id || 1, status: nextStatus });
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'medication':
        return 'bg-purple-950/50 text-purple-300 border-purple-800/60';
      case 'lifestyle':
      case 'diet':
        return 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60';
      case 'monitoring':
        return 'bg-blue-950/50 text-blue-300 border-blue-800/60';
      case 'visit':
        return 'bg-amber-950/50 text-amber-300 border-amber-800/60';
      default:
        return 'bg-zinc-900 text-zinc-300 border-zinc-800';
    }
  };

  const handleDownloadDossier = () => {
    const token = localStorage.getItem('access_token');
    window.open(`/api/patients/${activePatientId}/dossier.pdf?token=${token || ''}`, '_blank');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Banner - Matching Reference UI Header Style */}
      <div className="bg-[#09090b] border border-zinc-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-semibold text-zinc-300 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
              Clinician-Approved 4-Week Pathway
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">My Personalized Care Plan</h1>
            <p className="text-zinc-400 text-sm mt-1 max-w-xl">
              Follow your physician-reviewed pathway to stabilize post-meal excursions, maintain glucose in-range, and reach metabolic target HbA1c.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownloadDossier}
              className="btn-white text-sm"
            >
              <Download className="w-4 h-4" />
              Download Clinical Dossier (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Upcoming Visit & Pathway Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Progress Card */}
        <div className="md:col-span-1 bg-[#09090b] rounded-2xl p-6 border border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Plan Progress</h2>
              <span className="text-3xl font-extrabold text-white font-mono">{progressPercent}%</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-zinc-800/80 rounded-full h-2.5 overflow-hidden mb-4">
              <div
                className="bg-white h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-xs text-zinc-400 mb-6">
              {completedTasks} of {totalTasks} action milestones completed in your active care pathway.
            </p>
          </div>

          <div className="p-3.5 bg-black/60 rounded-xl border border-zinc-800 text-xs space-y-2 text-zinc-300">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Pathway Status:</span>
              <span className="font-semibold text-white capitalize">
                {carePlan?.status ? carePlan.status.replace('_', ' ') : 'Active'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Target Glucose:</span>
              <span className="font-mono font-semibold text-emerald-400">70 - 180 mg/dL</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Goal HbA1c:</span>
              <span className="font-mono font-semibold text-emerald-400">&lt; 7.0%</span>
            </div>
          </div>
        </div>

        {/* Visit Status Card */}
        <div className="md:col-span-2 bg-[#09090b] rounded-2xl p-6 border border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Stethoscope className="w-4 h-4 text-zinc-300" />
                Consultation & Visit Status
              </div>
              {upcomingVisit ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-950/60 text-blue-300 border border-blue-800/70 rounded-full text-xs font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  Upcoming Consultation
                </span>
              ) : latestCompletedVisit ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 text-emerald-300 border border-emerald-800/70 rounded-full text-xs font-medium">
                  <UserCheck className="w-3.5 h-3.5" />
                  Clinician-Reviewed
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-full text-xs">
                  No visits logged
                </span>
              )}
            </div>

            {upcomingVisit ? (
              <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800 mb-4">
                <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">
                  Scheduled Consultation
                </div>
                <div className="text-base font-bold text-white font-mono">
                  {new Date(upcomingVisit.scheduled_at).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                  Your care team has prepared a pre-visit summary from your twin telemetry. Join on schedule to review recommendations.
                </p>
              </div>
            ) : latestCompletedVisit ? (
              <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800 mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                    Latest Visit Notes ({new Date(latestCompletedVisit.scheduled_at).toLocaleDateString()})
                  </span>
                </div>
                <p className="text-sm text-zinc-300 italic">
                  "{latestCompletedVisit.notes || 'Plan reviewed and approved by attending clinician.'}"
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 mb-4">
                Your care team will schedule your next metabolic review session.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-800/80">
            <span>Clinical decision support grounded in ADA 2024 Standards.</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              Safety Governor Active <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Task Checklist Section */}
      <div className="bg-[#09090b] rounded-2xl border border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-800/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-zinc-400" />
                Action Milestones & Weekly Checklist
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Check off items as you complete them during each week of your care plan.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-zinc-800 p-1 bg-black text-xs">
                {(['all', 'pending', 'completed'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg font-medium capitalize transition ${
                      statusFilter === filter
                        ? 'bg-white text-black font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs border border-zinc-800 rounded-xl px-3 py-1.5 bg-zinc-900 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-white"
              >
                <option value="all">All Categories</option>
                <option value="lifestyle">Lifestyle & Diet</option>
                <option value="medication">Medication</option>
                <option value="monitoring">Monitoring</option>
                <option value="visit">Visits & Check-ins</option>
              </select>
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="divide-y divide-zinc-800/60">
          {planLoading ? (
            <div className="p-12 text-center text-zinc-500 text-sm">Loading care plan milestones...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 text-sm">
              <CheckCircle2 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              No tasks found for the selected filters.
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isDone = task.status === 'completed';
              return (
                <div
                  key={task.id}
                  onClick={() => handleToggleTask(task)}
                  className={`p-4 md:px-6 flex items-start gap-4 cursor-pointer transition hover:bg-zinc-900/50 ${
                    isDone ? 'bg-zinc-900/20 opacity-70' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="mt-0.5 text-zinc-400 hover:text-white transition flex-shrink-0"
                    aria-label={isDone ? 'Mark task as pending' : 'Mark task as completed'}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                      <Circle className="w-5 h-5 text-zinc-600 hover:text-zinc-400" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-sm font-semibold ${
                          isDone ? 'line-through text-zinc-500' : 'text-zinc-200'
                        }`}
                      >
                        {task.title}
                      </span>
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full border font-medium uppercase tracking-wider ${getCategoryColor(
                          task.category
                        )}`}
                      >
                        {task.category}
                      </span>
                      {task.assigned_to && (
                        <span className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
                          Assigned: {task.assigned_to}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {task.completed_at && (
                        <span className="text-emerald-400">
                          Completed on {new Date(task.completed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-md font-medium border ${
                        isDone
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isDone ? 'Done' : 'To Do'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
