import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Brain,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Home,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import { ClinicianPanelItem } from '../api/types';
import { useApp } from '../context/AppContext';

export const PatientPanel: React.FC = () => {
  const { setActivePatientId } = useApp();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'high' | 'moderate' | 'low'>('all');
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical_only' | 'has_alerts' | 'clean'>('all');
  const [sortBy, setSortBy] = useState<'risk_desc' | 'risk_asc' | 'tir_asc' | 'alerts_desc' | 'name'>('risk_desc');

  const {
    data: panel = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<ClinicianPanelItem[]>({
    queryKey: ['clinician-panel'],
    queryFn: () => apiRequest<ClinicianPanelItem[]>('/clinician/panel'),
    refetchInterval: 15000,
  });

  // Top metric calculations
  const stats = useMemo(() => {
    const total = panel.length;
    const highRisk = panel.filter((p) => p.risk_level === 'high' || p.risk_level === 'critical').length;
    const totalOpenAlerts = panel.reduce((sum, p) => sum + p.open_alerts_count, 0);
    const criticalAlerts = panel.reduce((sum, p) => sum + p.alerts_by_severity.critical, 0);

    const validTirs = panel.filter((p) => p.time_in_range_pct !== null).map((p) => p.time_in_range_pct as number);
    const avgTir = validTirs.length > 0 ? (validTirs.reduce((a, b) => a + b, 0) / validTirs.length).toFixed(1) : '--';

    return { total, highRisk, totalOpenAlerts, criticalAlerts, avgTir };
  }, [panel]);

  // Filter and sort items
  const filteredPatients = useMemo(() => {
    return panel
      .filter((p) => {
        // Search by name or ID
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchesName = p.display_name.toLowerCase().includes(q);
          const matchesId = p.patient_id.toString().includes(q);
          if (!matchesName && !matchesId) return false;
        }

        // Filter by risk level
        if (riskFilter !== 'all' && p.risk_level !== riskFilter) {
          return false;
        }

        // Filter by alert category
        if (alertFilter === 'critical_only' && p.alerts_by_severity.critical === 0) {
          return false;
        }
        if (alertFilter === 'has_alerts' && p.open_alerts_count === 0) {
          return false;
        }
        if (alertFilter === 'clean' && p.open_alerts_count > 0) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'risk_desc') return b.risk_score - a.risk_score;
        if (sortBy === 'risk_asc') return a.risk_score - b.risk_score;
        if (sortBy === 'alerts_desc') return b.open_alerts_count - a.open_alerts_count;
        if (sortBy === 'tir_asc') {
          return (a.time_in_range_pct ?? 100) - (b.time_in_range_pct ?? 100);
        }
        if (sortBy === 'name') return a.display_name.localeCompare(b.display_name);
        return 0;
      });
  }, [panel, searchTerm, riskFilter, alertFilter, sortBy]);

  const handleSelectPatient = (patientId: number) => {
    setActivePatientId(patientId);
    navigate('/');
  };

  return (
    <div className="space-y-8">
      {/* 1. Header (Matches Reference Image 1) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <Home className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-semibold text-white">Clinical Operations</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">Panel Operations Hub</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Clinical Patient Panel
            {isFetching && <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />}
          </h1>

          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Multi-patient metabolic risk stratification, time-in-range monitoring, and automated alerts engine.
          </p>
        </div>

        {/* Primary CTA Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 flex items-center justify-center transition"
            title="Refresh Panel"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-rose-300 border border-zinc-800 text-xs font-semibold flex items-center gap-2 transition"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Alerts Center</span>
            {stats.totalOpenAlerts > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-black rounded-full text-[10px] font-bold">
                {stats.totalOpenAlerts}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/patients/setup')}
            className="btn-white text-xs sm:text-sm font-bold shadow-lg shadow-white/5 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-black stroke-[3]" />
            <span>Add Patient Profile</span>
          </button>
        </div>
      </div>

      {/* 2. 4 Primary Stat Cards (Matches Reference Image 1) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL REGISTERED / Linked Patients */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                TOTAL REGISTERED
              </span>
              <span className="text-xs text-zinc-500 font-medium">Linked Patients</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
              <Users className="w-4 h-4 text-zinc-400" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
              {stats.total}
            </span>
          </div>
        </div>

        {/* Card 2: PENDING REVIEW / Open Safety Alerts */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                PENDING REVIEW
              </span>
              <span className="text-xs text-zinc-500 font-medium">Open Safety Alerts</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 font-mono">
              {stats.totalOpenAlerts}
            </span>
            {stats.criticalAlerts > 0 && (
              <span className="text-xs font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                {stats.criticalAlerts} Critical
              </span>
            )}
          </div>
        </div>

        {/* Card 3: FIELD DISPATCHED / Priority Care Patients */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider block">
                FIELD DISPATCHED
              </span>
              <span className="text-xs text-zinc-500 font-medium">Priority Care Patients</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <AlertTriangle className="w-4 h-4 text-zinc-300" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
              {stats.highRisk}
            </span>
          </div>
        </div>

        {/* Card 4: RESOLVED & CLOSED / Mean Time-in-Range */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                RESOLVED & CLOSED
              </span>
              <span className="text-xs text-zinc-500 font-medium">Mean Time-in-Range</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono">
              {stats.avgTir}
            </span>
            {stats.avgTir !== '--' && <span className="text-sm font-normal text-zinc-400">%</span>}
          </div>
        </div>
      </div>

      {/* 3. Filter and Search Bar (Matching Reference Image 1) */}
      <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by patient name, token, or ID..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-full pl-10 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Risk Filter */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">Risk:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 rounded-full px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              <option value="all">All Risks</option>
              <option value="critical">Critical (≥80)</option>
              <option value="high">High (60–79)</option>
              <option value="moderate">Moderate (35–59)</option>
              <option value="low">Low (&lt;35)</option>
            </select>
          </div>

          {/* Alert Filter */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">Alerts:</span>
            <select
              value={alertFilter}
              onChange={(e) => setAlertFilter(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 rounded-full px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="critical_only">Critical Only</option>
              <option value="has_alerts">Has Any Alerts</option>
              <option value="clean">Clear</option>
            </select>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 rounded-full px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              <option value="risk_desc">Risk: High to Low</option>
              <option value="risk_asc">Risk: Low to High</option>
              <option value="alerts_desc">Most Alerts</option>
              <option value="tir_asc">Lowest Time-in-Range</option>
              <option value="name">Patient Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Main Panel Table in Dark Reference Card */}
      <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="p-12 text-center text-zinc-400 text-xs flex flex-col items-center justify-center gap-3">
            <Activity className="w-7 h-7 text-white animate-spin" />
            <p>Loading clinician patient panel and evaluating safety rules...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 text-xs space-y-2">
            <Users className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="font-semibold text-zinc-300">No patients match the selected criteria</p>
            <p className="text-[11px] text-zinc-500">Try adjusting your risk filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Patient Profile</th>
                  <th className="py-3.5 px-5">Metabolic Risk</th>
                  <th className="py-3.5 px-5">Time-in-Range (7d)</th>
                  <th className="py-3.5 px-5">Last Activity</th>
                  <th className="py-3.5 px-5">Open Alerts</th>
                  <th className="py-3.5 px-5">Twin State</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850 text-xs">
                {filteredPatients.map((patient) => {
                  const riskLevel = patient.risk_level;
                  const isCritical = riskLevel === 'critical';
                  const isHigh = riskLevel === 'high';
                  const isModerate = riskLevel === 'moderate';

                  const riskBadgeClass = isCritical
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : isHigh
                    ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                    : isModerate
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';

                  const tir = patient.time_in_range_pct;
                  const tirColor =
                    tir === null || tir === undefined
                      ? 'text-zinc-500'
                      : tir >= 70.0
                      ? 'text-emerald-400'
                      : tir >= 50.0
                      ? 'text-amber-400'
                      : 'text-rose-400';

                  return (
                    <tr
                      key={patient.patient_id}
                      onClick={() => handleSelectPatient(patient.patient_id)}
                      className="hover:bg-zinc-900/60 transition-colors cursor-pointer group"
                    >
                      {/* Patient Name & Demographics */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white font-bold shrink-0 group-hover:border-zinc-700 transition-colors">
                            {patient.display_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{patient.display_name}</span>
                              <span className="text-[10px] font-mono text-zinc-500 font-normal">
                                #{patient.patient_id}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5 font-mono">
                              {patient.age && <span>{patient.age}y</span>}
                              {patient.sex && <span>• {patient.sex}</span>}
                              {patient.hba1c_pct && (
                                <span className="font-semibold text-zinc-300">
                                  • HbA1c {patient.hba1c_pct.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Risk Score */}
                      <td className="py-4 px-5">
                        <div className="space-y-1.5 max-w-[130px]">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border ${riskBadgeClass}`}
                            >
                              {patient.risk_level}
                            </span>
                            <span className="text-xs font-mono font-bold text-zinc-200">
                              {patient.risk_score.toFixed(0)}
                              <span className="text-[10px] text-zinc-500">/100</span>
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isCritical
                                  ? 'bg-rose-500'
                                  : isHigh
                                  ? 'bg-orange-500'
                                  : isModerate
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, patient.risk_score))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Time-in-Range */}
                      <td className="py-4 px-5">
                        {tir !== null && tir !== undefined ? (
                          <div>
                            <span className={`font-mono font-bold text-xs ${tirColor}`}>{tir.toFixed(1)}%</span>
                            <div className="w-20 h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                              <div
                                className={`h-full ${tir >= 70 ? 'bg-emerald-400' : tir >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                                style={{ width: `${Math.min(100, tir)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-[11px]">No data</span>
                        )}
                      </td>

                      {/* Last Activity */}
                      <td className="py-4 px-5 text-zinc-400">
                        {patient.last_reading_time ? (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono">
                            <Clock className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{new Date(patient.last_reading_time).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Open Alerts */}
                      <td className="py-4 px-5">
                        {patient.open_alerts_count === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Clear</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {patient.alerts_by_severity.critical > 0 && (
                              <span
                                className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded font-mono font-bold text-[10px] flex items-center gap-1"
                                title="Critical Alerts"
                              >
                                <AlertCircle className="w-3 h-3 text-rose-400" />
                                {patient.alerts_by_severity.critical}
                              </span>
                            )}
                            {patient.alerts_by_severity.warning > 0 && (
                              <span
                                className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded font-mono font-bold text-[10px] flex items-center gap-1"
                                title="Warning Alerts"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                {patient.alerts_by_severity.warning}
                              </span>
                            )}
                            {patient.alerts_by_severity.info > 0 && (
                              <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/40 text-blue-300 rounded font-mono font-bold text-[10px]">
                                {patient.alerts_by_severity.info} info
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Twin Personalization */}
                      <td className="py-4 px-5">
                        {patient.twin_status.personalized ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-full">
                            <Brain className="w-3 h-3 text-zinc-400" />
                            <span>Trained ({patient.twin_status.mem_n})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-full">
                            <span>Baseline</span>
                          </span>
                        )}
                      </td>

                      {/* Action Button: Matches + Inspect Ticket Lifecycle style */}
                      <td className="py-4 px-5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPatient(patient.patient_id);
                          }}
                          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white rounded-full font-semibold text-xs border border-zinc-700/80 transition-all inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <span>+ Inspect Lifecycle</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientPanel;
