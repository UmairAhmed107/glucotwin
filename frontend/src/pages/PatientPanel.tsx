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
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  Users,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Clinical Patient Panel
                {isFetching && <RefreshCw className="w-3.5 h-3.5 text-teal-400 animate-spin" />}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-patient risk stratification, time-in-range monitoring, and automated alerts engine
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold rounded-lg border border-rose-500/30 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Alerts Center</span>
            {stats.totalOpenAlerts > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-[#070D19] rounded-full text-[10px] font-bold">
                {stats.totalOpenAlerts}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 4 Primary Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Patients */}
        <div className="p-4 bg-[#0F172A] border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Linked Patients</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
          <p className="text-[11px] text-slate-400">Active care-team partnerships</p>
        </div>

        {/* Card 2: High / Critical Risk */}
        <div className="p-4 bg-[#0F172A] border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Priority Care Patients</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{stats.highRisk}</div>
          <p className="text-[11px] text-slate-400">Risk Score ≥ 60 (High or Critical)</p>
        </div>

        {/* Card 3: Active Alerts */}
        <div className="p-4 bg-[#0F172A] border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Open Safety Alerts</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 flex items-center gap-2">
            <span>{stats.totalOpenAlerts}</span>
            {stats.criticalAlerts > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                {stats.criticalAlerts} Critical
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">Awaiting clinical review</p>
        </div>

        {/* Card 4: Mean TIR */}
        <div className="p-4 bg-[#0F172A] border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Mean Time-in-Range</span>
            <Activity className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-teal-300">
            {stats.avgTir}
            {stats.avgTir !== '--' && <span className="text-sm font-normal text-slate-400">%</span>}
          </div>
          <p className="text-[11px] text-slate-400">70–180 mg/dL target window</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-[#0F172A] border border-slate-800 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by patient name or ID..."
            className="w-full bg-[#0B1220] border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Risk Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-[11px]">Risk:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="bg-[#0B1220] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="all">All Risks</option>
              <option value="critical">Critical (≥80)</option>
              <option value="high">High (60–79)</option>
              <option value="moderate">Moderate (35–59)</option>
              <option value="low">Low (&lt;35)</option>
            </select>
          </div>

          {/* Alert Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-[11px]">Alerts:</span>
            <select
              value={alertFilter}
              onChange={(e) => setAlertFilter(e.target.value as any)}
              className="bg-[#0B1220] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="critical_only">Critical Alerts Only</option>
              <option value="has_alerts">Has Any Alerts</option>
              <option value="clean">No Open Alerts</option>
            </select>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#0B1220] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
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

      {/* Main Table */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
            <Activity className="w-7 h-7 text-teal-400 animate-spin" />
            <p>Loading clinician patient panel and evaluating safety rules...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-medium text-slate-300">No patients match the selected criteria</p>
            <p className="text-[11px] text-slate-500">Try adjusting your risk filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0B1220]/70 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Patient Profile</th>
                  <th className="py-3 px-4">Metabolic Risk</th>
                  <th className="py-3 px-4">Time-in-Range (7d)</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4">Open Alerts</th>
                  <th className="py-3 px-4">Twin State</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
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
                      ? 'text-slate-400'
                      : tir >= 70.0
                      ? 'text-emerald-400'
                      : tir >= 50.0
                      ? 'text-amber-400'
                      : 'text-rose-400';

                  return (
                    <tr
                      key={patient.patient_id}
                      onClick={() => handleSelectPatient(patient.patient_id)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Patient Name & Demographics */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 font-bold shrink-0 group-hover:border-teal-500 transition-colors">
                            {patient.display_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                              <span>{patient.display_name}</span>
                              <span className="text-[10px] font-mono text-slate-500 font-normal">
                                #{patient.patient_id}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              {patient.age && <span>{patient.age}y</span>}
                              {patient.sex && <span>• {patient.sex}</span>}
                              {patient.hba1c_pct && (
                                <span className="font-medium text-slate-300">
                                  • HbA1c {patient.hba1c_pct.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Risk Score */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5 max-w-[130px]">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${riskBadgeClass}`}
                            >
                              {patient.risk_level}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-200">
                              {patient.risk_score.toFixed(0)}
                              <span className="text-[10px] text-slate-500">/100</span>
                            </span>
                          </div>
                          {/* Mini Progress Bar */}
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
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
                      <td className="py-3.5 px-4">
                        {tir !== null && tir !== undefined ? (
                          <div>
                            <span className={`font-mono font-bold text-xs ${tirColor}`}>{tir.toFixed(1)}%</span>
                            <div className="w-20 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                              <div
                                className={`h-full ${tir >= 70 ? 'bg-emerald-400' : tir >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                                style={{ width: `${Math.min(100, tir)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">No recent data</span>
                        )}
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-4 text-slate-300">
                        {patient.last_reading_time ? (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>{new Date(patient.last_reading_time).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Open Alerts */}
                      <td className="py-3.5 px-4">
                        {patient.open_alerts_count === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Clear</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {patient.alerts_by_severity.critical > 0 && (
                              <span
                                className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded font-bold text-[10px] flex items-center gap-1"
                                title="Critical Alerts"
                              >
                                <AlertCircle className="w-3 h-3 text-rose-400" />
                                {patient.alerts_by_severity.critical}
                              </span>
                            )}
                            {patient.alerts_by_severity.warning > 0 && (
                              <span
                                className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded font-bold text-[10px] flex items-center gap-1"
                                title="Warning Alerts"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                {patient.alerts_by_severity.warning}
                              </span>
                            )}
                            {patient.alerts_by_severity.info > 0 && (
                              <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/40 text-blue-300 rounded font-bold text-[10px]">
                                {patient.alerts_by_severity.info} info
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Twin Personalization */}
                      <td className="py-3.5 px-4">
                        {patient.twin_status.personalized ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
                            <Brain className="w-3 h-3 text-teal-400" />
                            <span>Trained ({patient.twin_status.mem_n})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
                            <span>Baseline</span>
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPatient(patient.patient_id);
                          }}
                          className="px-2.5 py-1 bg-teal-500/10 hover:bg-teal-500 text-teal-300 hover:text-[#0B1220] rounded-lg font-semibold text-xs border border-teal-500/30 transition-all inline-flex items-center gap-1"
                        >
                          <span>Twin Overview</span>
                          <ExternalLink className="w-3 h-3" />
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
