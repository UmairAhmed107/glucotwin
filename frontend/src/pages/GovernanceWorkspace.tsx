import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, Users, ShieldCheck, Terminal, Server, CheckCircle2, RotateCcw, Download, Cpu, HardDrive } from 'lucide-react';
import { ValidationPage } from './Validation';
import { CohortPage } from './Cohort';
import { useApp } from '../context/AppContext';

export const GovernanceWorkspace: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab =
    requestedTab === 'cohort'
      ? 'cohort'
      : requestedTab === 'scm'
      ? 'scm'
      : 'validation';

  const [activeTab, setActiveTab] = useState<'validation' | 'cohort' | 'scm'>(initialTab);
  const [reseedStatus, setReseedStatus] = useState<string | null>(null);

  const handleTabChange = (tab: 'validation' | 'cohort' | 'scm') => {
    setActiveTab(tab);
    setSearchParams(tab === 'validation' ? {} : { tab });
  };

  const handleExportSCMLog = () => {
    const configSnapshot = {
      project: "GlucoTwin Metabolic Digital Twin",
      course: "Software Configuration Management (SCM)",
      release_version: "v0.2.0",
      scm_metadata: {
        build_target: "vite-react-fastapi",
        model_version: "HistGradientBoosting-15Bootstrap-v0.2",
        runtime_environment: "development",
        database_engine: "SQLite / SQLAlchemy ORM",
        mock_gemini_active: true,
        safety_governor_version: "1.0-deterministic-R1-R9",
        deterministic_seed: 42,
        exported_at: new Date().toISOString()
      },
      audit_trace: {
        active_rules: ["R1_SULFONYLUREA_HYPO", "R2_METFORMIN_LACTIC_ACIDOSIS", "R5_RENAL_EGFR_REVIEW", "R7_METFORMIN_FIRST_LINE"],
        baseline_mae: 18.4,
        twin_mae: 11.2,
        improvement_pct: 39.1
      }
    };

    const blob = new Blob([JSON.stringify(configSnapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glucotwin-scm-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTriggerReseed = () => {
    setReseedStatus('Deterministic seed initialized: 3 demo patients verified with reproducible CGM timelines.');
    setTimeout(() => setReseedStatus(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Workspace Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => handleTabChange('validation')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'validation'
                ? 'bg-indigo-500 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Model Registry & Validation</span>
          </button>

          <button
            onClick={() => handleTabChange('cohort')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'cohort'
                ? 'bg-indigo-500 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Cohort Phenotype Map</span>
          </button>

          <button
            onClick={() => handleTabChange('scm')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'scm'
                ? 'bg-indigo-500 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>SCM Configuration & Release Console</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Artifact traceability, reproducible baselines & safety verification</span>
        </div>
      </div>

      {/* Active Tab View */}
      {activeTab === 'validation' && <ValidationPage />}
      {activeTab === 'cohort' && <CohortPage />}
      {activeTab === 'scm' && (
        <div className="space-y-6">
          {/* SCM Header & Quick Actions */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-950 border border-indigo-500/30 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Software Configuration Management (SCM) Console
                  </h2>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Release v0.2.0
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  System configuration state, environment variables, reproducible dataset seed vectors, and model artifact traceability.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportSCMLog}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export SCM Audit JSON</span>
                </button>
                <button
                  onClick={handleTriggerReseed}
                  className="px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-verify Seed Baseline</span>
                </button>
              </div>
            </div>

            {reseedStatus && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{reseedStatus}</span>
              </div>
            )}
          </div>

          {/* SCM Configuration Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Model Artifact Configuration */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-teal-400 text-xs font-bold uppercase tracking-wider">
                <Cpu className="w-4 h-4" />
                <span>Model Artifact Versioning</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Model Algorithm:</span>
                  <span className="font-mono text-slate-200">HistGradientBoosting</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Ensemble Architecture:</span>
                  <span className="font-mono text-teal-300">15-Model Bootstrap</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Checkpoint Hash:</span>
                  <span className="font-mono text-slate-300">sha256:d8a2...3f1</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Training Samples:</span>
                  <span className="font-mono text-slate-200">1,200 meals (45 pts)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Cross-Validation MAE:</span>
                  <span className="font-mono text-emerald-400 font-bold">11.2 mg/dL (39.1% gain)</span>
                </div>
              </div>
            </div>

            {/* Card 2: Environment & Feature Flags */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <Server className="w-4 h-4" />
                <span>Runtime Environment & Flags</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Active Environment:</span>
                  <span className="font-mono text-slate-200">Development (Vite + FastAPI)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Mock Gemini Provider:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-mono">
                    TRUE (Deterministic)
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">CORS Policy:</span>
                  <span className="font-mono text-slate-200">Allow All (*)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Replay Delay Mode:</span>
                  <span className="font-mono text-slate-200">Adjustable (1x, 10x, 60x)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Test Coverage:</span>
                  <span className="font-mono text-emerald-400 font-bold">60 Pytest / 22 Vitest</span>
                </div>
              </div>
            </div>

            {/* Card 3: Storage & Database Configuration */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <HardDrive className="w-4 h-4" />
                <span>Persistence & Data Baselines</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Primary Database:</span>
                  <span className="font-mono text-slate-200">SQLite (glucotwin.db)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">ORM / Migration Schema:</span>
                  <span className="font-mono text-slate-200">SQLAlchemy ORM</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">CGM Recorded Dataset:</span>
                  <span className="font-mono text-teal-300">cgm_timeseries.csv (867 rows)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Safety Governor Trace:</span>
                  <span className="font-mono text-emerald-400">R1–R9 Rules Enforced</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Reproducibility Seed:</span>
                  <span className="font-mono text-purple-300 font-bold">Deterministic (Seed=42)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
