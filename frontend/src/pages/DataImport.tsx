import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Activity,
  Watch,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  FileText,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { usePatients, useImportCGM, useImportWearables } from '../api/queries';
import { CGMImportReport, WearableImportReport } from '../api/types';

export const DataImportPage: React.FC = () => {
  const { activePatientId } = useApp();
  const { user } = useAuth();
  const isPatient = user?.role === 'patient';

  const [activeTab, setActiveTab] = useState<'cgm' | 'wearables'>('cgm');
  const [selectedPatientId, setSelectedPatientId] = useState<number>(activePatientId || 1);

  // File drag states
  const [cgmFile, setCgmFile] = useState<File | null>(null);
  const [wearablesFile, setWearablesFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Results
  const [cgmReport, setCgmReport] = useState<CGMImportReport | null>(null);
  const [wearablesReport, setWearablesReport] = useState<WearableImportReport | null>(null);

  const { data: patients } = usePatients();
  const importCgmMutation = useImportCGM();
  const importWearablesMutation = useImportWearables();

  const cgmFileInputRef = useRef<HTMLInputElement>(null);
  const wearablesFileInputRef = useRef<HTMLInputElement>(null);

  const effectivePatientId = isPatient ? (patients?.[0]?.id || 1) : selectedPatientId;

  const handleCgmDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        setCgmFile(file);
      }
    }
  };

  const handleWearablesDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        setWearablesFile(file);
      }
    }
  };

  const handleUploadCgm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cgmFile) return;

    importCgmMutation.mutate(
      { file: cgmFile, patientId: effectivePatientId },
      {
        onSuccess: (data) => {
          setCgmReport(data);
          setCgmFile(null);
        },
      }
    );
  };

  const handleUploadWearables = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wearablesFile) return;

    importWearablesMutation.mutate(
      { file: wearablesFile, patientId: effectivePatientId },
      {
        onSuccess: (data) => {
          setWearablesReport(data);
          setWearablesFile(null);
        },
      }
    );
  };

  // Sample CSV generator helpers
  const downloadSampleCgm = (isLibre: boolean = false) => {
    let content = '';
    let filename = '';
    if (isLibre) {
      content = `FreeStyle Libre Clinical Export\nMeter Timestamp,Historic Glucose mg/dL\n2026-03-15 08:00,112.0\n2026-03-15 08:15,124.0\n2026-03-15 08:30,145.0\n2026-03-15 08:45,138.0\n2026-03-15 09:00,120.0\n`;
      filename = 'glucotwin_sample_libre.csv';
    } else {
      content = `timestamp,glucose\n2026-03-15 08:00:00,110.0\n2026-03-15 08:15:00,128.0\n2026-03-15 08:30:00,152.0\n2026-03-15 08:45:00,140.0\n2026-03-15 09:00:00,118.0\n`;
      filename = 'glucotwin_sample_cgm.csv';
    }
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSampleWearables = () => {
    const content = `Date,Daily Steps,Sleep Hours\n2026-03-10,8450,7.5\n2026-03-11,10200,8.0\n2026-03-12,6100,6.2\n2026-03-13,7800,7.0\n2026-03-14,9300,7.8\n`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'glucotwin_sample_wearables.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Clinical Data Ingestion Engine</h1>
              <p className="text-sm text-slate-500">
                Import continuous glucose monitor (CGM) readings and wearable sleep/step telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Clinician Patient Picker */}
        {!isPatient && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Assign To:</label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              {patients?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name} (ID: {p.id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-3 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('cgm')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition ${
            activeTab === 'cgm'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Continuous Glucose Monitor (CGM)</span>
        </button>

        <button
          onClick={() => setActiveTab('wearables')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition ${
            activeTab === 'wearables'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Watch className="w-4 h-4" />
          <span>Wearables (Steps & Sleep)</span>
        </button>
      </div>

      {/* Tab 1: CGM Import */}
      {activeTab === 'cgm' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload card */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Upload CGM CSV Export</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supports generic timestamp/glucose formats and Abbott FreeStyle Libre exports.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => downloadSampleCgm(false)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Generic CSV
                </button>
                <button
                  type="button"
                  onClick={() => downloadSampleCgm(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Libre CSV
                </button>
              </div>
            </div>

            {/* Drag and drop zone */}
            <form onSubmit={handleUploadCgm} className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleCgmDrop}
                onClick={() => cgmFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-teal-500 bg-teal-50/50'
                    : cgmFile
                    ? 'border-teal-400 bg-teal-50/20'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <input
                  ref={cgmFileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCgmFile(e.target.files[0]);
                    }
                  }}
                />

                <FileSpreadsheet className="w-12 h-12 text-teal-600 mx-auto mb-3" />

                {cgmFile ? (
                  <div>
                    <p className="text-sm font-bold text-slate-800">{cgmFile.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(cgmFile.size / 1024).toFixed(1)} KB • Click or drop another file to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Drag & drop your CGM CSV file here, or{' '}
                      <span className="text-teal-600 font-bold underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Automatic unit detection (mmol/L or mg/dL) & timestamp de-duplication
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">
                  Target: Patient #{effectivePatientId}
                </span>

                <button
                  type="submit"
                  disabled={!cgmFile || importCgmMutation.isPending}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-sm transition flex items-center gap-2"
                >
                  {importCgmMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Ingesting & Reconciling...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Ingest CGM Data</span>
                    </>
                  )}
                </button>
              </div>

              {importCgmMutation.isError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-rose-900">CGM Ingestion Failed</p>
                      <p className="mt-0.5 text-rose-700">{importCgmMutation.error?.message || 'Invalid CSV format or upload error.'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => importCgmMutation.reset()}
                    className="text-[11px] font-bold text-rose-800 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </form>

            <div className="rounded-xl p-4 bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Info className="w-4 h-4 text-teal-600" />
                <span>Automated Post-Import Actions:</span>
              </div>
              <p>• <b>Timestamp Validation & De-duplication:</b> Existing readings are skipped safely.</p>
              <p>• <b>Unit Normalization:</b> mmol/L values are automatically converted to mg/dL (18.0182×).</p>
              <p>• <b>Twin Lifecycle:</b> Triggers prediction reconciliation for matching 3-hour postprandial meals.</p>
              <p>• <b>Safety Governance:</b> Automatically evaluates metabolic alert thresholds.</p>
            </div>
          </div>

          {/* Results card */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-4">Ingestion Report</h2>

              {cgmReport ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-900">Ingestion Succeeded</p>
                      <p className="text-xs text-emerald-700 mt-0.5">{cgmReport.message}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-xs text-slate-500 font-medium">Readings Accepted</p>
                      <p className="text-xl font-bold text-teal-600 mt-1">{cgmReport.rows_accepted}</p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-xs text-slate-500 font-medium">Rows Skipped</p>
                      <p className="text-xl font-bold text-slate-700 mt-1">{cgmReport.rows_skipped}</p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-xs text-slate-500 font-medium">Detected Unit</p>
                      <p className="text-xs font-bold text-slate-800 mt-1 truncate">{cgmReport.units_detected}</p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-xs text-slate-500 font-medium">Reconciled Predictions</p>
                      <p className="text-xl font-bold text-indigo-600 mt-1">{cgmReport.predictions_reconciled}</p>
                    </div>
                  </div>

                  {cgmReport.errors && cgmReport.errors.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Skipped Rows / Format Warnings ({cgmReport.errors.length})</span>
                      </div>
                      <ul className="text-[11px] text-amber-700 list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                        {cgmReport.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-600">No import completed yet</p>
                  <p className="text-xs text-slate-400 mt-1">Upload a CSV to generate an import report</p>
                </div>
              )}
            </div>

            {cgmReport && (
              <button
                onClick={() => setCgmReport(null)}
                className="w-full mt-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Clear Report
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Wearables Import */}
      {activeTab === 'wearables' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload card */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Upload Wearables CSV Telemetry</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily step counts and sleep hours (stored per day for display context only).
                </p>
              </div>
              <button
                type="button"
                onClick={downloadSampleWearables}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                <Download className="w-3.5 h-3.5" />
                Sample Wearables CSV
              </button>
            </div>

            <form onSubmit={handleUploadWearables} className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleWearablesDrop}
                onClick={() => wearablesFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : wearablesFile
                    ? 'border-indigo-400 bg-indigo-50/20'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <input
                  ref={wearablesFileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setWearablesFile(e.target.files[0]);
                    }
                  }}
                />

                <Watch className="w-12 h-12 text-indigo-600 mx-auto mb-3" />

                {wearablesFile ? (
                  <div>
                    <p className="text-sm font-bold text-slate-800">{wearablesFile.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(wearablesFile.size / 1024).toFixed(1)} KB • Click or drop another file to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Drag & drop your Wearables CSV file here, or{' '}
                      <span className="text-indigo-600 font-bold underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Columns: Date, Steps, Sleep Hours
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">
                  Target: Patient #{effectivePatientId}
                </span>

                <button
                  type="submit"
                  disabled={!wearablesFile || importWearablesMutation.isPending}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-sm transition flex items-center gap-2"
                >
                  {importWearablesMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing Wearables...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Ingest Wearables Data</span>
                    </>
                  )}
                </button>
              </div>

              {importWearablesMutation.isError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-rose-900">Wearables Ingestion Failed</p>
                      <p className="mt-0.5 text-rose-700">{importWearablesMutation.error?.message || 'Invalid CSV format or upload error.'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => importWearablesMutation.reset()}
                    className="text-[11px] font-bold text-rose-800 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </form>

            <div className="rounded-xl p-4 bg-indigo-50/50 border border-indigo-100 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-900">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Clinical Guardrail:</span>
              </div>
              <p>
                Wearables data is maintained as <b>optional context features for display only</b>.
                Per system specification, step counts and sleep hours are never fed into the underlying metabolic twin ML model.
              </p>
            </div>
          </div>

          {/* Results card */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-4">Wearables Report</h2>

              {wearablesReport ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-900">Ingestion Succeeded</p>
                      <p className="text-xs text-emerald-700 mt-0.5">{wearablesReport.message}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-xs text-slate-500 font-medium">Daily Records Stored</p>
                      <p className="text-xl font-bold text-indigo-600 mt-1">{wearablesReport.rows_accepted}</p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-xs text-slate-500 font-medium">Rows Skipped</p>
                      <p className="text-xl font-bold text-slate-700 mt-1">{wearablesReport.rows_skipped}</p>
                    </div>
                  </div>

                  {wearablesReport.errors && wearablesReport.errors.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Skipped Rows ({wearablesReport.errors.length})</span>
                      </div>
                      <ul className="text-[11px] text-amber-700 list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                        {wearablesReport.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <Watch className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-600">No wearables telemetry imported</p>
                  <p className="text-xs text-slate-400 mt-1">Upload steps/sleep CSV to inspect daily context</p>
                </div>
              )}
            </div>

            {wearablesReport && (
              <button
                onClick={() => setWearablesReport(null)}
                className="w-full mt-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Clear Report
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
