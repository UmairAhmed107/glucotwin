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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Weekly Clinical Reports & Interoperability</h1>
              <p className="text-sm text-slate-500">
                Weekly metabolic synthesis, adherence tracking, digital twin verification, and FHIR export
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Patient Selector (Clinician only) */}
          {!isPatient && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Patient:</span>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(Number(e.target.value))}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-medium focus:ring-2 focus:ring-teal-500"
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
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-medium"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>

          {/* Action: Manual Trigger */}
          <button
            onClick={handleManualGenerate}
            disabled={generateReportMutation.isPending}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generateReportMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>

          {/* Action: FHIR Modal */}
          <button
            onClick={() => setShowFhirModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>FHIR Export</span>
          </button>

          {/* Action: Download PDF */}
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF Dossier</span>
          </button>
        </div>
      </div>

      {/* Mutation Error Alert */}
      {generateReportMutation.isError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Report generation failed: {generateReportMutation.error?.message || 'Server error generating weekly report.'}
            </span>
          </div>
          <button
            onClick={() => generateReportMutation.reset()}
            className="text-xs font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Query Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <div className="h-5 bg-slate-200 rounded w-1/4" />
            <div className="h-4 bg-slate-100 rounded w-1/2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-28 bg-white rounded-2xl border border-slate-200 p-4" />
            <div className="h-28 bg-white rounded-2xl border border-slate-200 p-4" />
            <div className="h-28 bg-white rounded-2xl border border-slate-200 p-4" />
            <div className="h-28 bg-white rounded-2xl border border-slate-200 p-4" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-white rounded-2xl border border-slate-200" />
            <div className="h-64 bg-white rounded-2xl border border-slate-200" />
          </div>
        </div>
      ) : isError ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-12 text-center text-slate-600 space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">Failed to Load Weekly Report</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {error instanceof Error ? error.message : 'An error occurred while synthesizing the weekly metabolic data.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-xl text-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Query</span>
            </button>
            <button
              onClick={handleManualGenerate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-xs font-semibold rounded-xl text-white shadow-sm transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Generate New Report</span>
            </button>
          </div>
        </div>
      ) : !report ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">No Report Available</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No synthesized weekly report exists for this evaluation period ({periodDays} days).
          </p>
          <button
            onClick={handleManualGenerate}
            disabled={generateReportMutation.isPending}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generateReportMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Generate Weekly Synthesis</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Patient Overview Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900">{report.patient_name}</span>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-full">
                  Patient #{report.patient_id}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Evaluation Window: <b>{report.period_days} Days</b> • Generated at{' '}
                {new Date(report.generated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-xs text-slate-400 block">Readings Analyzed</span>
                <span className="font-bold text-slate-800 text-base">{report.tir_stats.total_readings}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Mean Glycaemia</span>
                <span className="font-bold text-teal-700 text-base">{report.tir_stats.mean_glucose} mg/dL</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Twin Confidence</span>
                <span className="font-bold text-indigo-700 text-base">
                  {Math.round((report.twin_accuracy.confidence_score || 0.85) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Grid 1: Time in Range (TIR) + Twin Accuracy */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Time in Range Card */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-teal-600" />
                  <h3 className="font-bold text-slate-900 text-base">Glycaemic Control & Time In Range</h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Target: ≥70% in 70-180 mg/dL
                </span>
              </div>

              {/* Stacked TIR Progress Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="h-6 w-full rounded-xl overflow-hidden flex bg-slate-100 border border-slate-200">
                  {/* TBR */}
                  <div
                    style={{ width: `${report.tir_stats.tbr_pct}%` }}
                    className="bg-rose-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
                    title={`TBR (<70 mg/dL): ${report.tir_stats.tbr_pct}%`}
                  >
                    {report.tir_stats.tbr_pct > 6 ? `${report.tir_stats.tbr_pct}%` : ''}
                  </div>
                  {/* TIR */}
                  <div
                    style={{ width: `${report.tir_stats.tir_pct}%` }}
                    className="bg-teal-500 h-full flex items-center justify-center text-[11px] font-bold text-white transition-all"
                    title={`TIR (70-180 mg/dL): ${report.tir_stats.tir_pct}%`}
                  >
                    {report.tir_stats.tir_pct > 10 ? `${report.tir_stats.tir_pct}% TIR` : ''}
                  </div>
                  {/* TAR */}
                  <div
                    style={{ width: `${report.tir_stats.tar_pct}%` }}
                    className="bg-amber-400 h-full flex items-center justify-center text-[10px] font-bold text-slate-900 transition-all"
                    title={`TAR (>180 mg/dL): ${report.tir_stats.tar_pct}%`}
                  >
                    {report.tir_stats.tar_pct > 6 ? `${report.tir_stats.tar_pct}%` : ''}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-100">
                    <span className="text-[11px] text-teal-700 block font-medium">In Range (70-180)</span>
                    <span className="text-lg font-bold text-teal-800">{report.tir_stats.tir_pct}%</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                    <span className="text-[11px] text-amber-700 block font-medium">Above Range (&gt;180)</span>
                    <span className="text-lg font-bold text-amber-800">{report.tir_stats.tar_pct}%</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                    <span className="text-[11px] text-rose-700 block font-medium">Below Range (&lt;70)</span>
                    <span className="text-lg font-bold text-rose-800">{report.tir_stats.tbr_pct}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Twin Accuracy & Calibration */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Digital Twin Accuracy</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-500 block">Mean Abs. Error</span>
                  <span className="text-xl font-bold text-slate-800 mt-1 block">
                    {report.twin_accuracy.mean_error} mg/dL
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-500 block">Interval Coverage</span>
                  <span className="text-xl font-bold text-emerald-600 mt-1 block">
                    {report.twin_accuracy.in_range_pct}%
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-indigo-900 block">Twin Calibration</span>
                  <span className="text-xs text-indigo-700">
                    {report.twin_accuracy.calibrated
                      ? 'Reconciled within clinical bootstrap targets.'
                      : 'Actively recalibrating on recent meals.'}
                  </span>
                </div>
                <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 text-white">
                  {report.twin_accuracy.calibrated ? 'Verified' : 'Adapting'}
                </span>
              </div>
            </div>
          </div>

          {/* Grid 2: Best Meals vs Worst Meals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Best Meals */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Award className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Best Controlled Meals (Lowest Spike)</h3>
                  <p className="text-xs text-slate-400">Meals producing optimal flat postprandial curves</p>
                </div>
              </div>

              {!report.best_meals || report.best_meals.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No meals recorded in this period.</p>
              ) : (
                <div className="space-y-2">
                  {report.best_meals.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-xs text-slate-800 block">
                          Meal #{m.meal_id || idx + 1}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {m.carbs_g}g carbs • {m.calories} kcal • Baseline: {m.pre_glucose} mg/dL
                        </span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                        +{m.observed_peak_rise} mg/dL
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Worst Meals */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Highest Excursions (Elevated Spike)</h3>
                  <p className="text-xs text-slate-400">Candidate meals for portion tuning or post-meal walks</p>
                </div>
              </div>

              {!report.worst_meals || report.worst_meals.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No meals recorded in this period.</p>
              ) : (
                <div className="space-y-2">
                  {report.worst_meals.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-rose-50/50 border border-rose-100 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-xs text-slate-800 block">
                          Meal #{m.meal_id || idx + 1}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {m.carbs_g}g carbs • {m.calories} kcal • Baseline: {m.pre_glucose} mg/dL
                        </span>
                      </div>
                      <span className="text-xs font-bold text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-rose-200">
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
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Pill className="w-4 h-4 text-teal-600" />
                <h4 className="font-bold text-xs text-slate-900">Medication & Log Adherence</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Doses Taken:</span>
                  <span className="font-bold text-slate-800">
                    {report.adherence.doses_taken} / {report.adherence.doses_total}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Adherence Rate:</span>
                  <span className="font-bold text-teal-600">{report.adherence.adherence_pct}%</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Meals Logged:</span>
                  <span className="font-bold text-slate-800">{report.adherence.meals_logged} meals</span>
                </div>
              </div>
            </div>

            {/* Plan Progress */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <ClipboardList className="w-4 h-4 text-teal-600" />
                <h4 className="font-bold text-xs text-slate-900">Care Pathway Execution</h4>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-800 block truncate">
                  {report.plan_progress.title}
                </span>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    style={{ width: `${report.plan_progress.progress_pct}%` }}
                    className="bg-teal-600 h-full rounded-full transition-all"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>{report.plan_progress.completed_tasks} completed</span>
                  <span>{report.plan_progress.total_tasks} total tasks</span>
                </div>
              </div>
            </div>

            {/* Wearables Context */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Watch className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-xs text-slate-900">Wearables Telemetry</h4>
              </div>
              {report.wearables_summary ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Daily Steps:</span>
                    <span className="font-bold text-slate-800">
                      {report.wearables_summary.avg_steps.toLocaleString()} steps/day
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Sleep Average:</span>
                    <span className="font-bold text-indigo-600">
                      {report.wearables_summary.avg_sleep_hours} hrs/night
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">Display context only; excluded from ML twin input.</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">No wearables CSV uploaded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FHIR Export Modal */}
      {showFhirModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Simplified FHIR R4 Bundle Export</h3>
                  <p className="text-xs text-slate-500">
                    Interoperability subset (Patient, Observation: Glucose, HbA1c, eGFR, MedicationStatement)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFhirModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <b>Clinical Interoperability Notice:</b> This is a simplified subset of the HL7 FHIR Release 4 standard for clinical prototype demonstration.
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs max-h-72 overflow-y-auto">
              {fhirLoading ? (
                <div className="text-center py-8 text-slate-400">Loading FHIR bundle...</div>
              ) : (
                <pre>{JSON.stringify(fhirBundle, null, 2)}</pre>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-slate-500">
                Total resources in bundle: <b>{fhirBundle?.total || 0}</b>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowFhirModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFhir}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
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
