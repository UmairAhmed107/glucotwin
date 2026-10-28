import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  Home,
  Info,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
} from 'lucide-react';
import {
  useAcknowledgeAlert,
  useAlerts,
  useEvaluateAlerts,
  useResolveAlert,
} from '../api/queries';
import { Alert, AlertSeverity, AlertStatus } from '../api/types';
import { useApp } from '../context/AppContext';

export const AlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activePatientId, setActivePatientId } = useApp();

  const [statusTab, setStatusTab] = useState<AlertStatus | 'all'>('open');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: alerts = [],
    isLoading,
    refetch,
    isFetching,
  } = useAlerts(statusTab === 'all' ? undefined : { status: statusTab });

  const acknowledgeMutation = useAcknowledgeAlert();
  const resolveMutation = useResolveAlert();
  const evaluateMutation = useEvaluateAlerts();

  // Filter alerts locally by severity and search query
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (severityFilter !== 'all' && alert.severity !== severityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesMsg = alert.message.toLowerCase().includes(q);
        const matchesRule = alert.rule_key.toLowerCase().includes(q);
        const matchesPatient = (alert.patient_name || '').toLowerCase().includes(q) ||
          alert.patient_id.toString().includes(q);
        if (!matchesMsg && !matchesRule && !matchesPatient) return false;
      }
      return true;
    });
  }, [alerts, severityFilter, searchQuery]);

  // Group counts
  const counts = useMemo(() => {
    const open = alerts.filter((a) => a.status === 'open').length;
    const critical = alerts.filter((a) => a.severity === 'critical' && a.status === 'open').length;
    const warning = alerts.filter((a) => a.severity === 'warning' && a.status === 'open').length;
    const info = alerts.filter((a) => a.severity === 'info' && a.status === 'open').length;
    return { open, critical, warning, info };
  }, [alerts]);

  const handleAcknowledge = (alertId: number) => {
    acknowledgeMutation.mutate(alertId);
  };

  const handleResolve = (alertId: number) => {
    resolveMutation.mutate(alertId);
  };

  const handleManualEvaluate = () => {
    if (activePatientId) {
      evaluateMutation.mutate(activePatientId);
    }
  };

  const handleViewPatient = (patientId: number) => {
    setActivePatientId(patientId);
    navigate('/twin');
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3 h-3" />
            CRITICAL
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            WARNING
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Info className="w-3 h-3" />
            INFO
          </span>
        );
    }
  };

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20">
            Open
          </span>
        );
      case 'acknowledged':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Acknowledged
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            Resolved
          </span>
        );
    }
  };

  const getRuleLabel = (key: string) => {
    switch (key) {
      case 'post_meal_peaks':
        return 'Post-Meal Hyperglycemia';
      case 'hypoglycemia':
        return 'Hypoglycemic Event';
      case 'missing_glucose_48h':
        return 'Sensor Disconnected / Missing Data';
      case 'low_time_in_range':
        return 'Sub-Target Time-in-Range';
      case 'rising_hba1c':
        return 'Elevated & Rising HbA1c';
      case 'renal_metformin_risk':
        return 'Renal-Metformin Safety Flag (R5)';
      default:
        return key.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Top Location Tag, Title & CTA (Matches Reference Image 1) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <Home className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-semibold text-white">Clinical Operations</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">Metabolic Operations</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Clinical Alerts Center
            {isFetching && <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />}
          </h1>

          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Deterministic metabolic safety rules with real-time severity triage, automated monitoring, and clinician audit trails.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 flex items-center justify-center transition"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          {activePatientId && (
            <button
              onClick={handleManualEvaluate}
              disabled={evaluateMutation.isPending}
              className="btn-white text-xs sm:text-sm font-bold shadow-lg shadow-white/5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Play className={`w-4 h-4 text-black ${evaluateMutation.isPending ? 'animate-spin' : ''}`} />
              <span>Evaluate Patient #{activePatientId}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 4 Primary Stat Cards Grid (Pixel-matching Reference Image 1) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              TOTAL REGISTERED
            </span>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
              <FileText className="w-4 h-4 text-zinc-400" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
              {counts.open}
            </span>
          </div>
        </div>

        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
              PENDING REVIEW
            </span>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-rose-400 font-mono">
              {counts.critical}
            </span>
          </div>
        </div>

        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              FIELD DISPATCHED
            </span>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 font-mono">
              {counts.warning}
            </span>
          </div>
        </div>

        <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-5 shadow-sm hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
              RESOLVED & CLOSED
            </span>
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400">
              <Info className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-blue-400 font-mono">
              {counts.info}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar (Pixel-matching Reference Image 1) */}
      <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-full border border-zinc-850 text-xs">
          {(['open', 'acknowledged', 'resolved', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold capitalize transition ${
                statusTab === tab
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab === 'open' ? 'Active Alerts' : tab}
            </button>
          ))}
        </div>

        {/* Severity & Search filters */}
        <div className="flex items-center gap-2 flex-1 sm:max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search token, message, or patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-full text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | 'all')}
            className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-full text-zinc-300 focus:outline-none focus:border-zinc-600 cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {/* 4. Alerts Table / List in Dark Reference Card */}
      <div className="bg-[#09090b] border border-zinc-800/90 rounded-2xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="py-20 text-center text-zinc-400 text-xs flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-white" />
            <p>Loading metabolic alerts...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="py-16 text-center text-zinc-500">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
            <div className="text-base font-bold text-white">No alerts found</div>
            <p className="text-xs text-zinc-400 mt-1">
              {statusTab === 'open'
                ? 'All patients are currently operating within metabolic safety boundaries.'
                : 'No alerts match the selected status and severity filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-5">Severity</th>
                  <th className="py-3.5 px-5">Rule / Condition</th>
                  <th className="py-3.5 px-5">Patient</th>
                  <th className="py-3.5 px-5 min-w-[280px]">Clinical Message</th>
                  <th className="py-3.5 px-5">Time</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {filteredAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className="hover:bg-zinc-900/60 transition group"
                  >
                    <td className="py-4 px-5 whitespace-nowrap">
                      {getSeverityBadge(alert.severity)}
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      <div className="font-bold text-white">
                        {getRuleLabel(alert.rule_key)}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                        {alert.rule_key}
                      </div>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      <button
                        onClick={() => handleViewPatient(alert.patient_id)}
                        className="inline-flex items-center gap-1.5 text-zinc-200 hover:text-white font-semibold group-hover:underline text-left"
                        title="View Twin Overview"
                      >
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{alert.patient_name || `Patient #${alert.patient_id}`}</span>
                      </button>
                    </td>
                    <td className="py-4 px-5 text-zinc-300 leading-relaxed font-normal">
                      {alert.message}
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span>
                          {new Date(alert.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      {getStatusBadge(alert.status)}
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {alert.status === 'open' && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={acknowledgeMutation.isPending}
                            className="px-3 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/30 transition text-xs font-semibold"
                          >
                            Acknowledge
                          </button>
                        )}

                        {alert.status !== 'resolved' && (
                          <button
                            onClick={() => handleResolve(alert.id)}
                            disabled={resolveMutation.isPending}
                            className="px-3 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border border-emerald-500/30 transition text-xs font-semibold"
                          >
                            Resolve
                          </button>
                        )}

                        <button
                          onClick={() => handleViewPatient(alert.patient_id)}
                          className="px-3 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition text-xs font-semibold inline-flex items-center gap-1"
                          title="Open Digital Twin"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
