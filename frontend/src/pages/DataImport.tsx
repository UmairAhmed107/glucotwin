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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#09090b] p-6 rounded-2xl border border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
              <UploadCloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-medium mb-1">
                Telemetry Pipeline v1.2 • Ingestion Engine
              </div>
              <h1 className="text-xl font-extrabold text-white">Clinical Data Ingestion Engine</h1>
              <p className="text-xs text-zinc-400">
                Import continuous glucose monitor (CGM) readings and wearable sleep/step telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Clinician Patient Picker */}
        {!isPatient && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-zinc-400">Assign To:</label>
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
      </div>

      {/* Reference Segmented Tab Bar */}
      <div className="flex items-center">
        <div className="inline-flex rounded-xl border border-zinc-800 p-1 bg-black text-xs font-medium">
          <button
            onClick={() => setActiveTab('cgm')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
              activeTab === 'cgm'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Continuous Glucose Monitor (CGM)</span>
          </button>

          <button
            onClick={() => setActiveTab('wearables')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
              activeTab === 'wearables'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Watch className="w-4 h-4" />
            <span>Wearables (Steps & Sleep)</span>
          </button>
        </div>
      </div>

      {/* Tab 1: CGM Import */}
      {activeTab === 'cgm' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload card */}
          <div className="lg:col-span-7 bg-[#09090b] rounded-2xl border border-zinc-800 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Upload CGM CSV Export</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Supports generic timestamp/glucose formats and Abbott FreeStyle Libre exports.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => downloadSampleCgm(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Generic CSV
                </button>
                <button
                  type="button"
                  onClick={() => downloadSampleCgm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl transition"
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
                    ? 'border-white bg-zinc-900'
                    : cgmFile
                    ? 'border-zinc-500 bg-zinc-900/60'
                    : 'border-zinc-800 hover:border-zinc-600 bg-black/40'
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

                <FileSpreadsheet className="w-10 h-10 text-zinc-400 mx-auto mb-3" />

                {cgmFile ? (
                  <div>
                    <p className="text-sm font-bold text-white font-mono">{cgmFile.name}</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {(cgmFile.size / 1024).toFixed(1)} KB • Click or drop another file to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-zinc-300">
                      Drag & drop your CGM CSV file here, or{' '}
                      <span className="text-white font-bold underline">browse</span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Automatic unit detection (mmol/L or mg/dL) & timestamp de-duplication
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-zinc-500 font-mono">
                  Target: Patient #{effectivePatientId}
                </span>

                <button
                  type="submit"
                  disabled={!cgmFile || importCgmMutation.isPending}
                  className="btn-white text-xs sm:text-sm px-6 py-2.5 disabled:opacity-40"
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
                <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <div>
                      <p className="font-semibold text-rose-200">CGM Ingestion Failed</p>
                      <p className="mt-0.5 text-rose-300">{importCgmMutation.error?.message || 'Invalid CSV format or upload error.'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => importCgmMutation.reset()}
                    className="text-[11px] font-bold text-rose-400 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </form>

            <div className="rounded-xl p-4 bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <Info className="w-4 h-4 text-zinc-400" />
                <span>Automated Post-Import Actions:</span>
              </div>
              <p>• <b>Timestamp Validation & De-duplication:</b> Existing readings are skipped safely.</p>
              <p>• <b>Unit Normalization:</b> mmol/L values are automatically converted to mg/dL (18.0182×).</p>
              <p>• <b>Twin Lifecycle:</b> Triggers prediction reconciliation for matching 3-hour postprandial meals.</p>
              <p>• <b>Safety Governance:</b> Automatically evaluates metabolic alert thresholds.</p>
            </div>
          </div>

          {/* Results card */}
          <div className="lg:col-span-5 bg-[#09090b] rounded-2xl border border-zinc-800 p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-white mb-4">Ingestion Report</h2>

              {cgmReport ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 bg-emerald-950/40 border border-emerald-800/70 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-200">Ingestion Succeeded</p>
                      <p className="text-xs text-emerald-400 mt-0.5">{cgmReport.message}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <p className="text-xs text-zinc-400 font-medium">Readings Accepted</p>
                      <p className="text-2xl font-extrabold text-white font-mono mt-1">{cgmReport.rows_accepted}</p>
                    </div>

                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <p className="text-xs text-zinc-400 font-medium">Rows Skipped</p>
                      <p className="text-2xl font-extrabold text-zinc-400 font-mono mt-1">{cgmReport.rows_skipped}</p>
                    </div>

                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <p className="text-xs text-zinc-400 font-medium">Detected Unit</p>
                      <p className="text-xs font-bold text-white font-mono mt-1 truncate">{cgmReport.units_detected}</p>
                    </div>

                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <p className="text-xs text-zinc-400 font-medium">Reconciled Predictions</p>
                      <p className="text-2xl font-extrabold text-white font-mono mt-1">{cgmReport.predictions_reconciled}</p>
                    </div>
                  </div>

                  {cgmReport.errors && cgmReport.errors.length > 0 && (
                    <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Skipped Rows / Format Warnings ({cgmReport.errors.length})</span>
                      </div>
                      <ul className="text-[11px] text-amber-400 list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                        {cgmReport.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-zinc-500">
                  <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-zinc-300">No import completed yet</p>
                  <p className="text-xs text-zinc-500 mt-1">Upload a CSV to generate an import report</p>
                </div>
              )}
            </div>

            {cgmReport && (
              <button
                onClick={() => setCgmReport(null)}
                className="w-full mt-4 py-2.5 text-xs font-semibold text-zinc-300 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 rounded-xl"
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
          <div className="lg:col-span-7 bg-[#09090b] rounded-2xl border border-zinc-800 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Upload Wearables CSV Telemetry</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Daily step counts and sleep hours (stored per day for display context only).
                </p>
              </div>
              <button
                type="button"
                onClick={downloadSampleWearables}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl transition"
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
                    ? 'border-white bg-zinc-900'
                    : wearablesFile
                    ? 'border-zinc-500 bg-zinc-900/60'
                    : 'border-zinc-800 hover:border-zinc-600 bg-black/40'
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

                <Watch className="w-10 h-10 text-zinc-400 mx-auto mb-3" />

                {wearablesFile ? (
                  <div>
                    <p className="text-sm font-bold text-white font-mono">{wearablesFile.name}</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {(wearablesFile.size / 1024).toFixed(1)} KB • Click or drop another file to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-zinc-300">
                      Drag & drop your Wearables CSV file here, or{' '}
                      <span className="text-white font-bold underline">browse</span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Columns: Date, Steps, Sleep Hours
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-zinc-500 font-mono">
                  Target: Patient #{effectivePatientId}
                </span>

                <button
                  type="submit"
                  disabled={!wearablesFile || importWearablesMutation.isPending}
                  className="btn-white text-xs sm:text-sm px-6 py-2.5 disabled:opacity-40"
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
                <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <div>
                      <p className="font-semibold text-rose-200">Wearables Ingestion Failed</p>
                      <p className="mt-0.5 text-rose-300">{importWearablesMutation.error?.message || 'Invalid CSV format or upload error.'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => importWearablesMutation.reset()}
                    className="text-[11px] font-bold text-rose-400 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </form>

            <div className="rounded-xl p-4 bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <Sparkles className="w-4 h-4 text-zinc-400" />
                <span>Clinical Guardrail:</span>
              </div>
              <p>
                Wearables data is maintained as <b>optional context features for display only</b>.
                Per system specification, step counts and sleep hours are never fed into the underlying metabolic twin ML model.
              </p>
            </div>
          </div>

          {/* Results card */}
          <div className="lg:col-span-5 bg-[#09090b] rounded-2xl border border-zinc-800 p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-white mb-4">Wearables Report</h2>

              {wearablesReport ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 bg-emerald-950/40 border border-emerald-800/70 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-200">Ingestion Succeeded</p>
                      <p className="text-xs text-emerald-400 mt-0.5">{wearablesReport.message}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <p className="text-xs text-zinc-400 font-medium">Daily Records Stored</p>
                      <p className="text-2xl font-extrabold text-white font-mono mt-1">{wearablesReport.rows_accepted}</p>
                    </div>

                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <p className="text-xs text-zinc-400 font-medium">Rows Skipped</p>
                      <p className="text-2xl font-extrabold text-zinc-400 font-mono mt-1">{wearablesReport.rows_skipped}</p>
                    </div>
                  </div>

                  {wearablesReport.errors && wearablesReport.errors.length > 0 && (
                    <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Skipped Rows ({wearablesReport.errors.length})</span>
                      </div>
                      <ul className="text-[11px] text-amber-400 list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                        {wearablesReport.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-zinc-500">
                  <Watch className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-zinc-300">No wearables telemetry imported</p>
                  <p className="text-xs text-zinc-500 mt-1">Upload steps/sleep CSV to inspect daily context</p>
                </div>
              )}
            </div>

            {wearablesReport && (
              <button
                onClick={() => setWearablesReport(null)}
                className="w-full mt-4 py-2.5 text-xs font-semibold text-zinc-300 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 rounded-xl"
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
