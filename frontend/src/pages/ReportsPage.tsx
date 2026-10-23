import React, { useState } from 'react';
import {
  FileText,
  Download,
  RefreshCw,
  Activity,
  Award,
  AlertTriangle,
  ClipboardList,
  Pill,
  Sparkles,
  Watch,
  Share2,
  Calendar,
  CheckCircle2,
  FileCode,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  usePatients,
  useWeeklyReport,
  useGenerateWeeklyReport,
  useFhirExport,
} from '../api/queries';
import { BASE_URL } from '../api/client';

export const ReportsPage: React.FC = () => {
  const { activePatientId } = useApp();
  const { user } = useAuth();
  const isPatient = user?.role === 'patient';

  const { data: patients } = usePatients();
  const [selectedPatientId, setSelectedPatientId] = useState<number>(activePatientId || 1);
  const [periodDays, setPeriodDays] = useState<number>(7);
  const [showFhirModal, setShowFhirModal] = useState<boolean>(false);

  const effectivePatientId = isPatient ? (patients?.[0]?.id || 1) : selectedPatientId;

  // Queries & Mutations
  const { data: report, isLoading, isError, error, isFetching, refetch } = useWeeklyReport(effectivePatientId, periodDays);
  const generateReportMutation = useGenerateWeeklyReport();
  const { data: fhirBundle, isLoading: fhirLoading } = useFhirExport(showFhirModal ? effectivePatientId : undefined);

  const handleManualGenerate = () => {
    generateReportMutation.mutate({ patientId: effectivePatientId, periodDays });
  };

  const handleDownloadPdf = () => {
    const token = localStorage.getItem('glucotwin_token');
    const pdfUrl = `${BASE_URL}/reports/weekly/${effectivePatientId}/pdf`;
    
    // Fetch with auth header and download
    fetch(pdfUrl, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('PDF generation failed');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `glucotwin_weekly_report_patient_${effectivePatientId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch((err) => {
        alert('Could not download PDF dossier: ' + err.message);
      });
  };

  const handleDownloadFhir = () => {
    if (!fhirBundle) return;
    const jsonStr = JSON.stringify(fhirBundle, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glucotwin_fhir_bundle_patient_${effectivePatientId}.json`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#09090b] p-6 rounded-2xl border border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-medium mb-1">
                Telemetry Audit Lifecycle • Interoperability Console
              </div>
              <h1 className="text-xl font-extrabold text-white">Weekly Clinical Reports & Interoperability</h1>
              <p className="text-xs text-zinc-400">
                Weekly metabolic synthesis, adherence tracking, digital twin verification, and FHIR export
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Patient Selector (Clinician only) */}
          {!isPatient && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-400">Patient:</span>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(Number(e.target.value))}
                className="text-xs border border-zinc-800 rounded-xl px-3 py-2 bg-zinc-900 text-zinc-200 font-medium focus:ring-1 focus:ring-white"
              >
                {patients?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} (ID: {p.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time range selector */}
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="text-xs border border-zinc-800 rounded-xl px-3 py-2 bg-zinc-900 text-zinc-200 font-medium"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>

          {/* Action: Manual Trigger */}
          <button
            onClick={handleManualGenerate}
            disabled={generateReportMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generateReportMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>

          {/* Action: FHIR Modal */}
          <button
            onClick={() => setShowFhirModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl transition"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>FHIR Export</span>
          </button>

          {/* Action: Download PDF */}
          <button
            onClick={handleDownloadPdf}
            className="btn-white text-xs px-4 py-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF Dossier</span>
          </button>
        </div>
      </div>

      {/* Mutation Error Alert */}
      {generateReportMutation.isError && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Report generation failed: {generateReportMutation.error?.message || 'Server error generating weekly report.'}
            </span>
          </div>
          <button
            onClick={() => generateReportMutation.reset()}
            className="text-xs font-bold text-rose-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Query Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="bg-[#09090b] rounded-2xl border border-zinc-800 p-6 space-y-3">
            <div className="h-5 bg-zinc-800 rounded w-1/4" />
            <div className="h-4 bg-zinc-900 rounded w-1/2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-28 bg-[#09090b] rounded-2xl border border-zinc-800 p-4" />
            <div className="h-28 bg-[#09090b] rounded-2xl border border-zinc-800 p-4" />
            <div className="h-28 bg-[#09090b] rounded-2xl border border-zinc-800 p-4" />
            <div className="h-28 bg-[#09090b] rounded-2xl border border-zinc-800 p-4" />
          </div>
        </div>
      ) : isError ? (
        <div className="bg-[#09090b] rounded-2xl border border-rose-900/60 p-12 text-center text-zinc-400 space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-white">Failed to Load Weekly Report</h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {error instanceof Error ? error.message : 'An error occurred while synthesizing the weekly metabolic data.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold rounded-xl text-zinc-300 border border-zinc-800 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Query</span>
            </button>
            <button
              onClick={handleManualGenerate}
              className="btn-white text-xs px-4 py-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Generate New Report</span>
            </button>
          </div>
        </div>
      ) : !report ? (
        <div className="bg-[#09090b] rounded-2xl border border-zinc-800 p-12 text-center text-zinc-400 space-y-3">
          <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
          <h2 className="text-base font-bold text-white">No Report Available</h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            No synthesized weekly report exists for this evaluation period ({periodDays} days).
          </p>
          <button
            onClick={handleManualGenerate}
            disabled={generateReportMutation.isPending}
            className="mt-2 btn-white text-xs px-5 py-2.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generateReportMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Generate Weekly Synthesis</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Patient Overview Card */}
          <div className="bg-[#09090b] rounded-2xl border border-zinc-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white">{report.patient_name}</span>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-full font-mono">
                  Patient #{report.patient_id}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Evaluation Window: <b>{report.period_days} Days</b> • Generated at{' '}
                {new Date(report.generated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Readings Analyzed</span>
                <span className="font-mono font-bold text-white text-base">{report.tir_stats.total_readings}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Mean Glycaemia</span>
                <span className="font-mono font-bold text-emerald-400 text-base">{report.tir_stats.mean_glucose} mg/dL</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Twin Confidence</span>
                <span className="font-mono font-bold text-white text-base">
                  {Math.round((report.twin_accuracy.confidence_score || 0.85) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Grid 1: Time in Range (TIR) + Twin Accuracy */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Time in Range Card */}
            <div className="lg:col-span-7 bg-[#09090b] rounded-2xl border border-zinc-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-zinc-400" />
                  <h3 className="font-bold text-white text-base">Glycaemic Control & Time In Range</h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/70 font-mono">
                  Target: ≥70% in 70-180 mg/dL
                </span>
              </div>

              {/* Stacked TIR Progress Bar */}
              <div className="space-y-2 pt-2">
                <div className="h-6 w-full rounded-xl overflow-hidden flex bg-zinc-900 border border-zinc-800">
                  {/* TBR */}
                  <div
                    style={{ width: `${report.tir_stats.tbr_pct}%` }}
                    className="bg-rose-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all font-mono"
                    title={`TBR (<70 mg/dL): ${report.tir_stats.tbr_pct}%`}
                  >
                    {report.tir_stats.tbr_pct > 6 ? `${report.tir_stats.tbr_pct}%` : ''}
                  </div>
                  {/* TIR */}
                  <div
                    style={{ width: `${report.tir_stats.tir_pct}%` }}
                    className="bg-emerald-500 h-full flex items-center justify-center text-[11px] font-bold text-black transition-all font-mono"
                    title={`TIR (70-180 mg/dL): ${report.tir_stats.tir_pct}%`}
                  >
                    {report.tir_stats.tir_pct > 10 ? `${report.tir_stats.tir_pct}% TIR` : ''}
                  </div>
                  {/* TAR */}
                  <div
                    style={{ width: `${report.tir_stats.tar_pct}%` }}
                    className="bg-amber-400 h-full flex items-center justify-center text-[10px] font-bold text-black transition-all font-mono"
                    title={`TAR (>180 mg/dL): ${report.tir_stats.tar_pct}%`}
                  >
                    {report.tir_stats.tar_pct > 6 ? `${report.tir_stats.tar_pct}%` : ''}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 block font-medium">In Range (70-180)</span>
                    <span className="text-xl font-extrabold text-white font-mono mt-1 block">{report.tir_stats.tir_pct}%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 block font-medium">Above Range (&gt;180)</span>
                    <span className="text-xl font-extrabold text-amber-400 font-mono mt-1 block">{report.tir_stats.tar_pct}%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 block font-medium">Below Range (&lt;70)</span>
                    <span className="text-xl font-extrabold text-rose-400 font-mono mt-1 block">{report.tir_stats.tbr_pct}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Twin Accuracy & Calibration */}
            <div className="lg:col-span-5 bg-[#09090b] rounded-2xl border border-zinc-800 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-zinc-400" />
                <h3 className="font-bold text-white text-base">Digital Twin Accuracy</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-xs text-zinc-400 block">Mean Abs. Error</span>
                  <span className="text-xl font-extrabold text-white font-mono mt-1 block">
                    {report.twin_accuracy.mean_error} mg/dL
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-xs text-zinc-400 block">Interval Coverage</span>
                  <span className="text-xl font-extrabold text-emerald-400 font-mono mt-1 block">
                    {report.twin_accuracy.in_range_pct}%
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Twin Calibration</span>
                  <span className="text-xs text-zinc-400">
                    {report.twin_accuracy.calibrated
                      ? 'Reconciled within clinical bootstrap targets.'
                      : 'Actively recalibrating on recent meals.'}
                  </span>
                </div>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-white text-black">
                  {report.twin_accuracy.calibrated ? 'Verified' : 'Adapting'}
                </span>
              </div>
            </div>
          </div>

          {/* Grid 2: Best Meals vs Worst Meals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Best Meals */}
            <div className="bg-[#09090b] rounded-2xl border border-zinc-800 p-6 space-y-3">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <Award className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">Best Controlled Meals (Lowest Spike)</h3>
                  <p className="text-xs text-zinc-400">Meals producing optimal flat postprandial curves</p>
                </div>
              </div>

              {!report.best_meals || report.best_meals.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">No meals recorded in this period.</p>
              ) : (
                <div className="space-y-2">
                  {report.best_meals.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-xs text-white block">
                          Meal #{m.meal_id || idx + 1}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {m.carbs_g}g carbs • {m.calories} kcal • Baseline: {m.pre_glucose} mg/dL
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
                        +{m.observed_peak_rise} mg/dL
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Worst Meals */}
            <div className="bg-[#09090b] rounded-2xl border border-zinc-800 p-6 space-y-3">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">Highest Excursions (Elevated Spike)</h3>
                  <p className="text-xs text-zinc-400">Candidate meals for portion tuning or post-meal walks</p>
                </div>
              </div>

              {!report.worst_meals || report.worst_meals.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">No meals recorded in this period.</p>
              ) : (
                <div className="space-y-2">
                  {report.worst_meals.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-xs text-white block">
                          Meal #{m.meal_id || idx + 1}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {m.carbs_g}g carbs • {m.calories} kcal • Baseline: {m.pre_glucose} mg/dL
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-rose-400 bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
                        +{m.observed_peak_rise} mg/dL
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grid 3: Adherence, Care Plan Progress, Wearables Context */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Adherence */}
            <div className="bg-[#09090b] rounded-2xl border border-zinc-800 p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                <Pill className="w-4 h-4 text-zinc-400" />
                <h4 className="font-bold text-xs text-white">Medication & Log Adherence</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Doses Taken:</span>
                  <span className="font-mono font-bold text-white">
                    {report.adherence.doses_taken} / {report.adherence.doses_total}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Adherence Rate:</span>
                  <span className="font-mono font-bold text-emerald-400">{report.adherence.adherence_pct}%</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Meals Logged:</span>
                  <span className="font-mono font-bold text-white">{report.adherence.meals_logged} meals</span>
                </div>
              </div>
            </div>

            {/* Plan Progress */}
            <div className="bg-[#09090b] rounded-2xl border border-zinc-800 p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                <ClipboardList className="w-4 h-4 text-zinc-400" />
                <h4 className="font-bold text-xs text-white">Care Pathway Execution</h4>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-semibold text-zinc-200 block truncate">
                  {report.plan_progress.title}
                </span>
                <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
                  <div
                    style={{ width: `${report.plan_progress.progress_pct}%` }}
                    className="bg-white h-full rounded-full transition-all"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                  <span>{report.plan_progress.completed_tasks} completed</span>
                  <span>{report.plan_progress.total_tasks} total tasks</span>
                </div>
              </div>
            </div>

            {/* Wearables Context */}
            <div className="bg-[#09090b] rounded-2xl border border-zinc-800 p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                <Watch className="w-4 h-4 text-zinc-400" />
                <h4 className="font-bold text-xs text-white">Wearables Telemetry</h4>
              </div>
              {report.wearables_summary ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Daily Steps:</span>
                    <span className="font-mono font-bold text-white">
                      {report.wearables_summary.avg_steps.toLocaleString()} steps/day
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Sleep Average:</span>
                    <span className="font-mono font-bold text-white">
                      {report.wearables_summary.avg_sleep_hours} hrs/night
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 italic">Display context only; excluded from ML twin input.</p>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 py-3 text-center">No wearables CSV uploaded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FHIR Export Modal */}
      {showFhirModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09090b] rounded-2xl border border-zinc-800 shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-zinc-300" />
                <div>
                  <h3 className="font-bold text-white text-base">Simplified FHIR R4 Bundle Export</h3>
                  <p className="text-xs text-zinc-400">
                    Interoperability subset (Patient, Observation: Glucose, HbA1c, eGFR, MedicationStatement)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFhirModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-xl text-xs text-amber-300">
              <b>Clinical Interoperability Notice:</b> This is a simplified subset of the HL7 FHIR Release 4 standard for clinical prototype demonstration.
            </div>

            <div className="bg-black text-zinc-200 border border-zinc-800 rounded-xl p-4 font-mono text-xs max-h-72 overflow-y-auto">
              {fhirLoading ? (
                <div className="text-center py-8 text-zinc-500">Loading FHIR bundle...</div>
              ) : (
                <pre>{JSON.stringify(fhirBundle, null, 2)}</pre>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-zinc-400">
                Total resources in bundle: <b className="text-white font-mono">{fhirBundle?.total || 0}</b>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowFhirModal(false)}
                  className="px-4 py-2 border border-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold hover:bg-zinc-900"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFhir}
                  className="btn-white text-xs px-4 py-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download JSON</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
