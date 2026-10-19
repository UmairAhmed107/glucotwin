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
  Filter,
  Info,
  Play,
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
  const { activePatientId, setActivePatientId, currentPatient } = useApp();

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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            CRITICAL
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            WARNING
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Info className="w-3.5 h-3.5" />
            INFO
          </span>
        );
    }
  };

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
            Open
          </span>
        );
      case 'acknowledged':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Acknowledged
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                Clinical Alerts Center
              </h1>
              <p className="text-sm text-slate-400">
                Deterministic metabolic safety rules with real-time severity triage and automated monitoring
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activePatientId && (
            <button
              onClick={handleManualEvaluate}
              disabled={evaluateMutation.isPending}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
              title={`Evaluate metabolic rules for ${currentPatient?.display_name || `Patient #${activePatientId}`}`}
            >
              <Play className={`w-4 h-4 ${evaluateMutation.isPending ? 'animate-spin' : ''}`} />
              <span>Evaluate Patient #{activePatientId}</span>
            </button>
          )}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Open Alerts</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-100">{counts.open}</div>
          <div className="mt-1 text-xs text-slate-500">Awaiting clinical review</div>
        </div>

        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/30 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-rose-400 font-medium">Critical</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-300">{counts.critical}</div>
          <div className="mt-1 text-xs text-rose-400/80">Immediate attention required</div>
        </div>

        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/30 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-amber-400 font-medium">Warning</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-300">{counts.warning}</div>
          <div className="mt-1 text-xs text-amber-400/80">Metabolic drift or peaks</div>
        </div>

        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/30 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-blue-400 font-medium">Informational</span>
            <Info className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-300">{counts.info}</div>
          <div className="mt-1 text-xs text-blue-400/80">Adherence and logging notes</div>
        </div>
      </div>

      {/* Rules Legend banner */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="font-semibold text-slate-300">Active Metabolic Rules:</span>
        <span>• 3+ peaks &gt; 250 mg/dL (7d)</span>
        <span>• Hypo &lt; 70 mg/dL (Critical &lt; 54)</span>
        <span>• No glucose entry 48h</span>
        <span>• TIR (70-180) &lt; 50%</span>
        <span>• HbA1c &gt; 7.0% rising</span>
        <span>• eGFR &amp; Metformin (R5)</span>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-lg border border-slate-800">
          {(['open', 'acknowledged', 'resolved', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition ${
                statusTab === tab
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Severity & Search filters */}
        <div className="flex items-center gap-2 flex-1 sm:max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search message or patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900/80 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | 'all')}
            className="px-2.5 py-1.5 text-xs bg-slate-900/80 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-teal-500 cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {/* Alerts Table / List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
            Loading metabolic alerts...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400/60" />
            <div className="text-base font-semibold text-slate-300">No alerts found</div>
            <p className="text-xs text-slate-500 mt-1">
              {statusTab === 'open'
                ? 'All patients are currently operating within metabolic safety boundaries.'
                : 'No alerts match the selected status and severity filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Rule / Condition</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4 min-w-[280px]">Clinical Message</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className="hover:bg-slate-800/40 transition group"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getSeverityBadge(alert.severity)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-200">
                        {getRuleLabel(alert.rule_key)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {alert.rule_key}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        onClick={() => handleViewPatient(alert.patient_id)}
                        className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 font-medium group-hover:underline text-left"
                        title="View Twin Overview"
                      >
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{alert.patient_name || `Patient #${alert.patient_id}`}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 leading-relaxed font-normal">
                      {alert.message}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
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
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(alert.status)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {alert.status === 'open' && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={acknowledgeMutation.isPending}
                            className="px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition text-xs font-medium"
                            title="Mark as acknowledged by clinician"
                          >
                            Acknowledge
                          </button>
                        )}

                        {alert.status !== 'resolved' && (
                          <button
                            onClick={() => handleResolve(alert.id)}
                            disabled={resolveMutation.isPending}
                            className="px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition text-xs font-medium"
                            title="Mark issue as resolved"
                          >
                            Resolve
                          </button>
                        )}

                        <button
                          onClick={() => handleViewPatient(alert.patient_id)}
                          className="p-1 rounded text-slate-400 hover:text-teal-300 hover:bg-slate-800 transition"
                          title="Open Digital Twin"
                        >
                          <ArrowRight className="w-4 h-4" />
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
