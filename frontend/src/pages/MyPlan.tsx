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
    updateTaskMutation.mutate({ taskId: task.id, status: nextStatus });
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'medication':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'lifestyle':
      case 'diet':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'monitoring':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'visit':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const handleDownloadDossier = () => {
    const token = localStorage.getItem('access_token');
    window.open(`/api/patients/${activePatientId}/dossier.pdf?token=${token || ''}`, '_blank');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Clinician-Approved 4-Week Pathway
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">My Personalized Care Plan</h1>
            <p className="text-teal-100 text-sm mt-1 max-w-xl">
              Follow your physician-reviewed pathway to stabilize post-meal excursions, maintain glucose in-range, and reach metabolic target HbA1c.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownloadDossier}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-emerald-800 rounded-xl font-medium text-sm shadow hover:bg-emerald-50 transition active:scale-95"
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
        <div className="md:col-span-1 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Plan Progress</h2>
              <span className="text-2xl font-bold text-emerald-600">{progressPercent}%</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden mb-4">
              <div
                className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-xs text-slate-500 mb-6">
              {completedTasks} of {totalTasks} action milestones completed in your active care pathway.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2 text-slate-600">
            <div className="flex items-center justify-between">
              <span>Pathway Status:</span>
              <span className="font-semibold text-slate-800 capitalize">
                {carePlan?.status ? carePlan.status.replace('_', ' ') : 'Active'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Target Glucose:</span>
              <span className="font-semibold text-emerald-700">70 - 180 mg/dL</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Goal HbA1c:</span>
              <span className="font-semibold text-emerald-700">&lt; 7.0%</span>
            </div>
          </div>
        </div>

        {/* Visit Status Card */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Stethoscope className="w-4 h-4 text-emerald-600" />
                Consultation & Visit Status
              </div>
              {upcomingVisit ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  Upcoming Consultation
                </span>
              ) : latestCompletedVisit ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                  <UserCheck className="w-3.5 h-3.5" />
                  Clinician-Reviewed
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs">
                  No visits logged
                </span>
              )}
            </div>

            {upcomingVisit ? (
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 mb-4">
                <div className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">
                  Scheduled Consultation
                </div>
                <div className="text-base font-bold text-slate-800">
                  {new Date(upcomingVisit.scheduled_at).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Your care team has prepared a pre-visit summary from your twin telemetry. Join on schedule to review recommendations.
                </p>
              </div>
            ) : latestCompletedVisit ? (
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">
                    Latest Visit Notes ({new Date(latestCompletedVisit.scheduled_at).toLocaleDateString()})
                  </span>
                </div>
                <p className="text-sm text-slate-700 italic">
                  "{latestCompletedVisit.notes || 'Plan reviewed and approved by attending clinician.'}"
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mb-4">
                Your care team will schedule your next metabolic review session.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
            <span>Clinical decision support grounded in ADA 2024 Standards.</span>
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              Safety Governor Active <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Task Checklist Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-600" />
                Action Milestones & Weekly Checklist
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Check off items as you complete them during each week of your care plan.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                {(['all', 'pending', 'completed'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-md font-medium capitalize transition ${
                      statusFilter === filter
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
        <div className="divide-y divide-slate-100">
          {planLoading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Loading care plan milestones...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
              No tasks found for the selected filters.
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isDone = task.status === 'completed';
              return (
                <div
                  key={task.id}
                  onClick={() => handleToggleTask(task)}
                  className={`p-4 md:px-6 flex items-start gap-4 cursor-pointer transition hover:bg-slate-50/80 ${
                    isDone ? 'bg-slate-50/40 opacity-75' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="mt-0.5 text-slate-400 hover:text-emerald-600 transition flex-shrink-0"
                    aria-label={isDone ? 'Mark task as pending' : 'Mark task as completed'}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-sm font-semibold ${
                          isDone ? 'line-through text-slate-400' : 'text-slate-800'
                        }`}
                      >
                        {task.title}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider ${getCategoryColor(
                          task.category
                        )}`}
                      >
                        {task.category}
                      </span>
                      {task.assigned_to && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          Assigned: {task.assigned_to}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {task.completed_at && (
                        <span className="text-emerald-600">
                          Completed on {new Date(task.completed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-slate-400">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                        isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
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
