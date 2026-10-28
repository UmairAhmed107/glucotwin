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
  DollarSign,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Flame,
  HelpCircle,
  Home,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import { ClinicianPanelItem } from '../api/types';
import { useApp } from '../context/AppContext';
import { PreConsultationBriefModal, PatientBriefData } from '../components/PreConsultationBriefModal';
import { SoapNoteModal } from '../components/SoapNoteModal';
import { EngagementChurnPredictor } from '../components/EngagementChurnPredictor';

export const PatientPanel: React.FC = () => {
  const { setActivePatientId } = useApp();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [triageMode, setTriageMode] = useState<'all' | 'urgent' | 'monitoring' | 'stable'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'high' | 'moderate' | 'low'>('all');
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical_only' | 'has_alerts' | 'clean'>('all');
  const [sortBy, setSortBy] = useState<'risk_desc' | 'risk_asc' | 'tir_asc' | 'alerts_desc' | 'name'>('risk_desc');

  // Modals state
  const [briefPatient, setBriefPatient] = useState<PatientBriefData | null>(null);
  const [soapPatient, setSoapPatient] = useState<PatientBriefData | null>(null);
  const [showChurnPredictor, setShowChurnPredictor] = useState(false);

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

    // Smart Triage counts
    const urgentCount = panel.filter(
      (p) =>
        p.risk_level === 'critical' ||
        p.risk_level === 'high' ||
        p.alerts_by_severity.critical > 0 ||
        (p.time_in_range_pct !== null && p.time_in_range_pct < 60)
    ).length;

    const monitoringCount = panel.filter(
      (p) =>
        p.risk_level === 'moderate' ||
        (p.time_in_range_pct !== null && p.time_in_range_pct >= 60 && p.time_in_range_pct < 70)
    ).length;

    const stableCount = panel.filter(
      (p) =>
        p.risk_level === 'low' ||
        (p.time_in_range_pct !== null && p.time_in_range_pct >= 70 && p.open_alerts_count === 0)
    ).length;

    return { total, highRisk, totalOpenAlerts, criticalAlerts, avgTir, urgentCount, monitoringCount, stableCount };
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

        // Smart Triage Mode Filter ("Who Needs Me Today?")
        if (triageMode === 'urgent') {
          const isUrgent =
            p.risk_level === 'critical' ||
            p.risk_level === 'high' ||
            p.alerts_by_severity.critical > 0 ||
            (p.time_in_range_pct !== null && p.time_in_range_pct < 60);
          if (!isUrgent) return false;
        } else if (triageMode === 'monitoring') {
          const isMonitoring =
            p.risk_level === 'moderate' ||
            (p.time_in_range_pct !== null && p.time_in_range_pct >= 60 && p.time_in_range_pct < 70);
          if (!isMonitoring) return false;
        } else if (triageMode === 'stable') {
          const isStable =
            p.risk_level === 'low' ||
            (p.time_in_range_pct !== null && p.time_in_range_pct >= 70 && p.open_alerts_count === 0);
          if (!isStable) return false;
        }

        // Secondary filter by risk level dropdown
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
  }, [panel, searchTerm, triageMode, riskFilter, alertFilter, sortBy]);

  const handleSelectPatient = (patientId: number) => {
    setActivePatientId(patientId);
    navigate('/');
  };

  const handleOpenBrief = (e: React.MouseEvent, p: ClinicianPanelItem) => {
    e.stopPropagation();
    setActivePatientId(p.patient_id);
    setBriefPatient({
      patientId: p.patient_id,
      displayName: p.display_name,
      age: p.age,
      sex: p.sex,
      hba1c: p.hba1c_pct,
      tir: p.time_in_range_pct ?? undefined,
      cv: 37.8,
      riskScore: p.risk_score,
      riskLevel: p.risk_level,
      openAlertsCount: p.open_alerts_count,
    });
  };

  const handleOpenSoap = (e: React.MouseEvent, p: ClinicianPanelItem) => {
    e.stopPropagation();
    setActivePatientId(p.patient_id);
    setSoapPatient({
      patientId: p.patient_id,
      displayName: p.display_name,
      age: p.age,
      sex: p.sex,
      hba1c: p.hba1c_pct,
      tir: p.time_in_range_pct ?? undefined,
      cv: 37.8,
      riskScore: p.risk_score,
      riskLevel: p.risk_level,
      openAlertsCount: p.open_alerts_count,
    });
  };

  return (
    <div className="space-y-8">
      {/* 1. Header with Smart Triage Indicator */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <Home className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-semibold text-white">Clinical Operations</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">Smart Triage Queue</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Clinical Patient Panel & Triage
            {isFetching && <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />}
          </h1>

          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Dynamic risk stratification, 30-second pre-consultation briefings, and 1-click SOAP encounter documentation.
          </p>
        </div>

        {/* Primary CTA Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 flex items-center justify-center transition cursor-pointer"
            title="Refresh Panel"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowChurnPredictor(true)}
            className="px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-sm"
            title="Monitor patient engagement, drop-off risks, and RPM CMS billing compliance"
          >
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span>RPM & Churn Predictor</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-rose-300 border border-zinc-800 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
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

      {/* 2. Primary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL REGISTERED */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                TOTAL REGISTERED
              </span>
              <span className="text-xs text-zinc-500 font-medium">Active Roster</span>
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

        {/* Card 2: URGENT / HIGH RISK */}
        <div className="bg-[#09090b] border border-rose-500/30 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">
                URGENT TRIAGE
              </span>
              <span className="text-xs text-zinc-500 font-medium">High Hypo / Low TIR</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-rose-400 font-mono">
              {stats.urgentCount}
            </span>
            <span className="text-xs text-rose-300 font-medium">requires action today</span>
          </div>
        </div>

        {/* Card 3: OPEN ALERTS */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                PENDING REVIEW
              </span>
              <span className="text-xs text-zinc-500 font-medium">Open Safety Alerts</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
              {stats.totalOpenAlerts}
            </span>
          </div>
        </div>

        {/* Card 4: MEAN TIR */}
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                CLINIC TIME-IN-RANGE
              </span>
              <span className="text-xs text-zinc-500 font-medium">Population Mean</span>
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

      {/* 3. "Who Needs Me Today?" - Smart Triage Mode Switcher */}
      <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Triage Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-2xl border border-zinc-850 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setTriageMode('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              triageMode === 'all'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All Patients ({stats.total})
          </button>

          <button
            onClick={() => setTriageMode('urgent')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              triageMode === 'urgent'
                ? 'bg-rose-500 text-white font-bold shadow-sm'
                : 'text-rose-400 hover:text-rose-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>🚨 Urgent Attention ({stats.urgentCount})</span>
          </button>

          <button
            onClick={() => setTriageMode('monitoring')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              triageMode === 'monitoring'
                ? 'bg-amber-400 text-black font-bold shadow-sm'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>⚠️ Needs Review ({stats.monitoringCount})</span>
          </button>

          <button
            onClick={() => setTriageMode('stable')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              triageMode === 'stable'
                ? 'bg-emerald-500 text-black font-bold shadow-sm'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>🟢 Stable Control ({stats.stableCount})</span>
          </button>
        </div>

        {/* Search & Sort */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by name or ID..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-full pl-10 pr-4 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 rounded-full px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              <option value="risk_desc">Priority: High Risk First</option>
              <option value="alerts_desc">Most Alerts</option>
              <option value="tir_asc">Lowest Time-in-Range</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Main Panel Table */}
      <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="p-12 text-center text-zinc-400 text-xs flex flex-col items-center justify-center gap-3">
            <Activity className="w-7 h-7 text-white animate-spin" />
            <p>Loading clinician patient panel and evaluating safety rules...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 text-xs space-y-2">
            <Users className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="font-semibold text-zinc-300">No patients in this triage view</p>
            <p className="text-[11px] text-zinc-500">Try switching triage categories or resetting filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Patient Profile</th>
                  <th className="py-3.5 px-5">Triage Severity</th>
                  <th className="py-3.5 px-5">TIR (7d)</th>
                  <th className="py-3.5 px-5">Active Alerts</th>
                  <th className="py-3.5 px-5">Twin Calibration</th>
                  <th className="py-3.5 px-5 text-right">Rapid Clinician Actions</th>
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

                      {/* Triage Severity Bar */}
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

                      {/* Active Alerts */}
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
                                title="Critical Hypo / Spike Alerts"
                              >
                                <AlertCircle className="w-3 h-3 text-rose-400" />
                                {patient.alerts_by_severity.critical}
                              </span>
                            )}
                            {patient.alerts_by_severity.warning > 0 && (
                              <span
                                className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded font-mono font-bold text-[10px]"
                                title="Warning Alerts"
                              >
                                {patient.alerts_by_severity.warning} warn
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Twin Calibration */}
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

                      {/* Rapid Clinician Action Buttons */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {/* 30s Brief Button */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenBrief(e, patient)}
                            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-amber-300 hover:text-amber-200 rounded-xl font-semibold text-[11px] border border-amber-500/30 hover:border-amber-500/50 transition-all inline-flex items-center gap-1 shadow-sm cursor-pointer"
                            title="30-Second Pre-Consultation Brief"
                          >
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>30s Brief</span>
                          </button>

                          {/* 1-Click SOAP Note Button */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenSoap(e, patient)}
                            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-300 hover:text-emerald-200 rounded-xl font-semibold text-[11px] border border-emerald-500/30 hover:border-emerald-500/50 transition-all inline-flex items-center gap-1 shadow-sm cursor-pointer"
                            title="Generate SOAP Note & Billing Codes"
                          >
                            <FileText className="w-3 h-3 text-emerald-400" />
                            <span>SOAP</span>
                          </button>

                          {/* Inspect Patient */}
                          <button
                            type="button"
                            onClick={() => handleSelectPatient(patient.patient_id)}
                            className="px-2.5 py-1.5 bg-white hover:bg-zinc-200 text-black rounded-xl font-bold text-[11px] transition-all inline-flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <span>Inspect &rarr;</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 30-Second Pre-Consultation Briefing Modal */}
      <PreConsultationBriefModal
        isOpen={Boolean(briefPatient)}
        onClose={() => setBriefPatient(null)}
        patient={briefPatient}
        onOpenSoapNote={() => {
          if (briefPatient) {
            setSoapPatient(briefPatient);
          }
        }}
      />

      {/* 1-Click SOAP Note & Billing Generator Modal */}
      <SoapNoteModal
        isOpen={Boolean(soapPatient)}
        onClose={() => setSoapPatient(null)}
        patient={soapPatient}
      />

      {/* Patient Engagement & Churn / RPM Predictor Modal */}
      {showChurnPredictor && (
        <EngagementChurnPredictor
          isModal={true}
          onClose={() => setShowChurnPredictor(false)}
          onSelectPatient={(id) => {
            setShowChurnPredictor(false);
            handleSelectPatient(id);
          }}
        />
      )}
    </div>
  );
};

export default PatientPanel;
