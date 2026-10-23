import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  FileCheck2,
  FileText,
  Flame,
  HelpCircle,
  History,
  Layers,
  MessageSquare,
  Play,
  PlusCircle,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  useCompleteVisit,
  useCreateVisit,
  usePatientVisits,
  useReviewDraft,
  useStartVisit,
  useVisit,
} from '../api/queries';
import { DraftStatus, RecommendationDraft, Visit } from '../api/types';
import { useApp } from '../context/AppContext';

export const VisitWorkspace: React.FC = () => {
  const { activePatientId } = useApp();
  const navigate = useNavigate();

  // Selected visit ID (or null to show latest/create)
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);

  // Editing draft state
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDetail, setEditDetail] = useState('');
  const [editComment, setEditComment] = useState('');

  // Visit completion notes
  const [completionNotes, setCompletionNotes] = useState('');

  // Fetch patient visits
  const {
    data: visits = [],
    isLoading: loadingVisits,
    refetch: refetchVisits,
  } = usePatientVisits(activePatientId);

  // Determine current active visit
  const activeVisitId = useMemo(() => {
    if (selectedVisitId) return selectedVisitId;
    if (visits.length > 0) return visits[0].id;
    return null;
  }, [selectedVisitId, visits]);

  const { data: visit, isLoading: loadingVisit } = useVisit(activeVisitId);

  const createVisitMutation = useCreateVisit();
  const startVisitMutation = useStartVisit();
  const reviewDraftMutation = useReviewDraft();
  const completeVisitMutation = useCompleteVisit();

  const handleCreateVisit = () => {
    if (activePatientId) {
      createVisitMutation.mutate(
        { patientId: activePatientId },
        {
          onSuccess: (newVisit) => {
            setSelectedVisitId(newVisit.id);
            refetchVisits();
          },
        }
      );
    }
  };

  const handleStartVisit = () => {
    if (activeVisitId) {
      startVisitMutation.mutate(activeVisitId);
    }
  };

  const handleApproveDraft = (draft: RecommendationDraft) => {
    if (draft.governor_trace?.blocked) {
      return; // Cannot approve governor blocked draft
    }
    reviewDraftMutation.mutate({
      draftId: draft.id,
      visitId: draft.visit_id,
      status: 'approved',
      clinician_comment: draft.clinician_comment || 'Approved by clinician',
    });
  };

  const handleRejectDraft = (draft: RecommendationDraft) => {
    reviewDraftMutation.mutate({
      draftId: draft.id,
      visitId: draft.visit_id,
      status: 'rejected',
      clinician_comment: 'Rejected by clinician based on clinical assessment',
    });
  };

  const handleStartEdit = (draft: RecommendationDraft) => {
    setEditingDraftId(draft.id);
    setEditTitle(draft.title);
    setEditDetail(draft.detail || '');
    setEditComment(draft.clinician_comment || '');
  };

  const handleSaveEdit = (draft: RecommendationDraft) => {
    reviewDraftMutation.mutate(
      {
        draftId: draft.id,
        visitId: draft.visit_id,
        status: 'edited',
        title: editTitle,
        detail: editDetail,
        clinician_comment: editComment || 'Adjusted by clinician',
      },
      {
        onSuccess: () => {
          setEditingDraftId(null);
        },
      }
    );
  };

  const handleCompleteVisit = () => {
    if (activeVisitId) {
      completeVisitMutation.mutate({
        visitId: activeVisitId,
        notes: completionNotes || visit?.notes || undefined,
      });
    }
  };

  const approvedDrafts = useMemo(() => {
    return visit?.drafts.filter((d) => d.status === 'approved' || d.status === 'edited') || [];
  }, [visit]);

  if (!activePatientId) {
    return (
      <div className="py-24 text-center text-slate-500">
        <Users className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <h2 className="text-lg font-bold text-slate-300">No Patient Selected</h2>
        <p className="text-xs text-slate-500 mt-1">Select a patient from the top bar to open the Clinical Visit Workspace.</p>
      </div>
    );
  }

  const summary = visit?.pre_visit_summary;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header Bar (Matches Reference UI) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#09090b] border border-zinc-800/90 rounded-2xl p-6 shadow-sm">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-white">Clinical Encounters</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">CDS Consultation Workspace</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Clinical Visit &amp; Care Pathway Review
            </h1>
            {visit && (
              <span
                className={`text-[10px] uppercase font-mono font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                  visit.status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : visit.status === 'in_progress'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                    : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                }`}
              >
                {visit.status.replace('_', ' ')}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl leading-relaxed">
            Review automated pre-visit data, audit governed AI recommendations, and publish the 4-week care pathway.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {visits.length > 0 && (
            <select
              value={activeVisitId ?? ''}
              onChange={(e) => setSelectedVisitId(Number(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-full px-3.5 py-2 focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              {visits.map((v) => (
                <option key={v.id} value={v.id}>
                  Visit #{v.id} • {new Date(v.scheduled_at).toLocaleDateString()} ({v.status})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleCreateVisit}
            disabled={createVisitMutation.isPending}
            className="btn-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
          >
            <PlusCircle className="w-3.5 h-3.5 text-black" />
            <span>New Visit</span>
          </button>

          {visit?.status === 'scheduled' && (
            <button
              onClick={handleStartVisit}
              disabled={startVisitMutation.isPending}
              className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Consultation</span>
            </button>
          )}

          <button
            onClick={() => refetchVisits()}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh visit data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loadingVisit ? (
        <div className="py-24 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
          Loading clinical visit workspace...
        </div>
      ) : !visit ? (
        <div className="py-16 text-center text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800 p-8">
          <FileText className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-200">No Clinical Visits on Record</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Schedule a consultation visit to generate the automated 14-day pre-visit summary and AI recommendation drafts.
          </p>
          <button
            onClick={handleCreateVisit}
            className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg shadow inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Schedule Initial Visit</span>
          </button>
        </div>
      ) : (
        /* 3-Column Workspace Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ============================================================ */}
          {/* PANEL 1 (LEFT, 3.5 cols): Pre-Visit Summary */}
          {/* ============================================================ */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 bg-[#0F172A] border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-400" />
                  <h3 className="text-sm font-bold text-slate-200">Pre-Visit Summary</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-500">14-Day Ingestion</span>
              </div>

              {summary ? (
                <>
                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Mean Glucose</span>
                      <span className="text-base font-bold text-slate-100 font-mono">
                        {summary.glucose_stats_14d?.mean_mgdl ?? 120}{' '}
                        <span className="text-[10px] text-slate-500">mg/dL</span>
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        Std: ±{summary.glucose_stats_14d?.std_mgdl ?? 0}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Time-in-Range (70-180)</span>
                      <span
                        className={`text-base font-bold font-mono ${
                          (summary.glucose_stats_14d?.time_in_range_pct ?? 70) >= 70
                            ? 'text-emerald-400'
                            : (summary.glucose_stats_14d?.time_in_range_pct ?? 70) >= 50
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {summary.glucose_stats_14d?.time_in_range_pct ?? 70}%
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        {summary.glucose_stats_14d?.reading_count ?? 0} readings
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Hypoglycemia Events</span>
                      <span
                        className={`text-base font-bold font-mono ${
                          (summary.glucose_stats_14d?.hypo_events_count ?? 0) > 0
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {summary.glucose_stats_14d?.hypo_events_count ?? 0}
                        {(summary.glucose_stats_14d?.critical_hypo_count ?? 0) > 0 && (
                          <span className="text-[9px] text-rose-500 ml-1">
                            ({summary.glucose_stats_14d?.critical_hypo_count} &lt;54)
                          </span>
                        )}
                      </span>
                      <span className="text-[9px] text-slate-500 block">&lt; 70 mg/dL readings</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Latest HbA1c / eGFR</span>
                      <span className="text-base font-bold text-slate-200 font-mono">
                        {summary.biomarkers?.hba1c_pct ?? 7.0}%
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        eGFR ~{summary.biomarkers?.estimated_egfr ?? 90} mL/min
                      </span>
                    </div>
                  </div>

                  {/* Twin Response Findings */}
                  <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/30 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-semibold text-indigo-300">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        Twin Meal Patterns
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                        {summary.twin_patterns?.carb_sensitivity ?? 'Moderate'} Sensitivity
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Calibrated from {summary.twin_patterns?.mem_n ?? 0} logged meals. Baseline test meal predicts{' '}
                      <span className="font-semibold text-indigo-200 font-mono">
                        +{summary.twin_patterns?.representative_meal_rise_mgdl ?? 30} mg/dL
                      </span>{' '}
                      peak rise.
                    </p>
                  </div>

                  {/* Open Safety Alerts */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span>Active Safety Alerts</span>
                      <span className="text-[10px] text-rose-400 font-bold">
                        {summary.open_alerts_count ?? (summary.open_alerts?.length ?? 0)} Open
                      </span>
                    </span>

                    {(summary.open_alerts?.length ?? 0) === 0 ? (
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>No safety alerts currently triggered.</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {(summary.open_alerts ?? []).map((alt) => (
                          <div
                            key={alt.id}
                            className={`p-2 rounded-lg border text-[11px] leading-tight flex items-start gap-2 ${
                              alt.severity === 'critical'
                                ? 'bg-rose-950/30 border-rose-900/40 text-rose-200'
                                : 'bg-amber-950/30 border-amber-900/40 text-amber-200'
                            }`}
                          >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                            <div>
                              <span className="font-bold uppercase text-[9px] block tracking-wider">
                                {alt.rule_key}
                              </span>
                              <span>{alt.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Medication Adherence */}
                  <div className="pt-2 border-t border-slate-800 text-xs flex items-center justify-between text-slate-400">
                    <span>Adherence Estimate:</span>
                    <span className="font-semibold text-slate-200">
                      {summary.medication_adherence?.estimated_adherence_pct ?? 100}% (
                      {summary.medication_adherence?.status ?? 'Optimal'})
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 py-6 text-center">Summary generating...</div>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/* PANEL 2 (MIDDLE, 5 cols): Draft Recommendations Review */}
          {/* ============================================================ */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 bg-[#0F172A] border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-200">
                    Recommendation Drafts ({visit.drafts.length})
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400">Deterministic Safety Audit</span>
              </div>

              {visit.drafts.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No draft recommendations generated yet.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {visit.drafts.map((draft) => {
                    const isBlocked = draft.governor_trace?.blocked;
                    const isEditing = editingDraftId === draft.id;

                    return (
                      <div
                        key={draft.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isBlocked
                            ? 'bg-rose-950/20 border-rose-900/40 text-rose-100'
                            : draft.status === 'approved'
                            ? 'bg-emerald-950/15 border-emerald-900/40 text-slate-200'
                            : draft.status === 'edited'
                            ? 'bg-indigo-950/15 border-indigo-900/40 text-slate-200'
                            : draft.status === 'rejected'
                            ? 'bg-slate-900/40 border-slate-800/80 opacity-60 text-slate-400'
                            : 'bg-slate-900/60 border-slate-800 text-slate-200'
                        }`}
                      >
                        {/* Draft Category & Status Badge */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              {draft.category}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                                draft.status === 'approved'
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : draft.status === 'edited'
                                  ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                                  : draft.status === 'rejected'
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {draft.status}
                            </span>
                          </div>

                          {/* Safety Governor Status Tag */}
                          {isBlocked ? (
                            <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              <XCircle className="w-3 h-3" />
                              Governor Blocked
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <ShieldCheck className="w-3 h-3" />
                              Safety Audited
                            </span>
                          )}
                        </div>

                        {/* Title & Detail or Edit Form */}
                        {isEditing ? (
                          <div className="space-y-2.5 my-2">
                            <div>
                              <label className="text-[10px] font-medium text-slate-400">Title</label>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-slate-400">Clinical Detail</label>
                              <textarea
                                rows={2}
                                value={editDetail}
                                onChange={(e) => setEditDetail(e.target.value)}
                                className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-slate-400">Clinician Rationale / Comment</label>
                              <input
                                type="text"
                                value={editComment}
                                onChange={(e) => setEditComment(e.target.value)}
                                placeholder="Why was this modified?"
                                className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100"
                              />
                            </div>
                            <div className="flex items-center gap-2 justify-end pt-1">
                              <button
                                onClick={() => setEditingDraftId(null)}
                                className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-slate-200"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(draft)}
                                className="px-3 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h4 className="text-xs font-bold text-slate-100 leading-snug">
                              {draft.title}
                            </h4>
                            {draft.detail && (
                              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                                {draft.detail}
                              </p>
                            )}

                            {draft.clinician_comment && (
                              <div className="mt-2 text-[10px] text-teal-300 bg-teal-950/20 border border-teal-900/30 p-2 rounded flex items-start gap-1.5">
                                <MessageSquare className="w-3 h-3 text-teal-400 shrink-0 mt-0.5" />
                                <span>Clinician Note: {draft.clinician_comment}</span>
                              </div>
                            )}

                            {/* Governor Block Explanation */}
                            {isBlocked && (
                              <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/40 border border-rose-900/50 p-2 rounded flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                <span>
                                  {draft.governor_trace?.reason ||
                                    (draft.governor_trace as any)?.reasons?.join('; ') ||
                                    'Failed deterministic safety governor audit.'}
                                </span>
                              </div>
                            )}
                          </>
                        )}

                        {/* Review Action Buttons */}
                        {visit.status !== 'completed' && !isEditing && (
                          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-500 font-mono">
                              Draft #{draft.id}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {/* Approve Button (strictly disabled if blocked) */}
                              <button
                                data-testid={`approve-draft-${draft.id}`}
                                onClick={() => handleApproveDraft(draft)}
                                disabled={isBlocked || reviewDraftMutation.isPending}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                                  isBlocked
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                                    : draft.status === 'approved'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                                }`}
                                title={isBlocked ? 'Cannot approve: failed governor safety checks' : 'Approve recommendation'}
                              >
                                <Check className="w-3 h-3" />
                                <span>{isBlocked ? 'Blocked by Governor' : draft.status === 'approved' ? 'Approved' : 'Approve'}</span>
                              </button>

                              {/* Edit Button */}
                              <button
                                onClick={() => handleStartEdit(draft)}
                                disabled={reviewDraftMutation.isPending}
                                className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>

                              {/* Reject Button */}
                              <button
                                onClick={() => handleRejectDraft(draft)}
                                disabled={reviewDraftMutation.isPending}
                                className="px-2.5 py-1 rounded text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/* PANEL 3 (RIGHT, 3.5 cols): Plan Preview & Complete Visit */}
          {/* ============================================================ */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-4 bg-[#0F172A] border border-slate-800 rounded-xl space-y-4 sticky top-20">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-200">Plan Preview</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {approvedDrafts.length} Approved
                </span>
              </div>

              {/* Status Note */}
              <p className="text-xs text-slate-400 leading-relaxed">
                Only approved and edited recommendations will be published into the patient's 4-week active care plan.
              </p>

              {/* Approved Items List */}
              <div className="space-y-2">
                {approvedDrafts.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-900/80 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                    No recommendations approved yet. Review drafts in the center column.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {approvedDrafts.map((appItem, idx) => (
                      <div
                        key={appItem.id}
                        className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-xs"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-emerald-300 truncate">
                            {idx + 1}. {appItem.title}
                          </span>
                          <span className="text-[9px] uppercase px-1.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                            {appItem.category}
                          </span>
                        </div>
                        {appItem.clinician_comment && (
                          <p className="text-[10px] text-slate-400 italic">
                            "{appItem.clinician_comment}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Consultation Notes Textarea */}
              {visit.status !== 'completed' && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Clinical Consultation Notes
                  </label>
                  <textarea
                    rows={3}
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Enter consultation synthesis and metabolic review notes..."
                    className="w-full text-xs bg-[#0B1220] border border-slate-700 rounded-lg p-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
              )}

              {/* Complete Visit Action Button */}
              {visit.status !== 'completed' ? (
                <button
                  onClick={handleCompleteVisit}
                  disabled={approvedDrafts.length === 0 || completeVisitMutation.isPending}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                    approvedDrafts.length === 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Complete &amp; Publish Plan</span>
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/50 text-center space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-300 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Plan Published &amp; Active</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Tasks have been distributed to the patient portal.
                  </p>
                  <a
                    href={`/api/patients/${visit.patient_id}/dossier.pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Approved PDF Dossier</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
