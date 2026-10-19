import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  ShieldCheck,
  Stethoscope,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  Utensils,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { CareTeamLink, User as UserType } from '../api/types';
import { useAuth } from '../context/AuthContext';

export const CareTeamPage: React.FC = () => {
  const { user } = useAuth();
  const [links, setLinks] = useState<CareTeamLink[]>([]);
  const [availableProviders, setAvailableProviders] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<number | ''>('');
  const [requestPatientId, setRequestPatientId] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isPatient = user?.role === 'patient';
  const isProvider = user?.role === 'clinician' || user?.role === 'dietitian';
  const isAdmin = user?.role === 'admin';

  const loadData = async () => {
    setLoading(true);
    try {
      const teamData = await apiRequest<CareTeamLink[]>('/care-team/my-team');
      setLinks(teamData);

      if (isPatient) {
        try {
          const provs = await apiRequest<UserType[]>('/auth/providers');
          setAvailableProviders(provs);
          if (provs.length > 0 && selectedProviderId === '') {
            setSelectedProviderId(provs[0].id);
          }
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to load care team data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleApprove = async (linkId: number) => {
    setActionLoadingId(linkId);
    setFeedbackMsg(null);
    try {
      await apiRequest<CareTeamLink>(`/care-team/${linkId}/approve`, { method: 'POST' });
      setFeedbackMsg({ type: 'success', text: 'Care-team link successfully approved! Provider now has access.' });
      await loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to approve link' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevoke = async (linkId: number) => {
    setActionLoadingId(linkId);
    setFeedbackMsg(null);
    try {
      await apiRequest<CareTeamLink>(`/care-team/${linkId}/revoke`, { method: 'POST' });
      setFeedbackMsg({ type: 'success', text: 'Care-team link revoked. Patient record access has been severed.' });
      await loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to revoke link' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRequestProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProviderId) return;

    setFeedbackMsg(null);
    try {
      await apiRequest<CareTeamLink>('/care-team/request', {
        method: 'POST',
        body: JSON.stringify({ provider_user_id: Number(selectedProviderId) }),
      });
      setFeedbackMsg({ type: 'success', text: 'Provider added to your care team successfully!' });
      await loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to send provider request' });
    }
  };

  const handleRequestPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestPatientId) return;

    setFeedbackMsg(null);
    try {
      await apiRequest<CareTeamLink>('/care-team/request', {
        method: 'POST',
        body: JSON.stringify({ patient_id: Number(requestPatientId) }),
      });
      setFeedbackMsg({ type: 'success', text: `Link request sent for patient #${requestPatientId}. Awaiting patient approval.` });
      setRequestPatientId('');
      await loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to request patient access' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Users className="w-5 h-5 text-teal-400" />
            {isPatient ? 'My Care Team & Provider Access' : 'Care Team & Patient Network'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isPatient
              ? 'Control which clinicians and dietitians are authorized to view your metabolic twin data and recommend therapies.'
              : 'Manage linked patients, pending access requests, and multidisciplinary care partnerships.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2.5 py-1 rounded-full font-mono font-medium border border-slate-700 bg-slate-900/60 text-slate-300">
            Role: <strong className="text-teal-300 uppercase">{user?.role}</strong>
          </span>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Existing Links */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">
              {isPatient ? 'Connected Providers' : 'Patient Care Links'} ({links.length})
            </h2>
            <button
              onClick={loadData}
              className="text-xs text-slate-400 hover:text-slate-200 underline"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-[#0F172A] border border-slate-800 rounded-xl text-xs text-slate-400">
              Loading care team relationships...
            </div>
          ) : links.length === 0 ? (
            <div className="p-8 text-center bg-[#0F172A] border border-slate-800 rounded-xl">
              <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-300">No care team links yet</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                {isPatient
                  ? 'Connect with a clinician or dietitian to grant them access to your twin simulations.'
                  : 'You do not have any active patient links. Request access below to view patient records.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {links.map((link) => {
                const isPending = link.status === 'pending';
                const isActive = link.status === 'active';
                const isRevoked = link.status === 'revoked';

                return (
                  <div
                    key={link.id}
                    className="p-4 bg-[#0F172A] border border-slate-800 rounded-xl hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center shrink-0">
                        {link.role_in_team === 'dietitian' ? (
                          <Utensils className="w-4 h-4 text-emerald-400" />
                        ) : link.role_in_team === 'clinician' ? (
                          <Stethoscope className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <User className="w-4 h-4 text-teal-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-100">
                            {isPatient
                              ? link.provider_name || `Provider #${link.provider_user_id}`
                              : link.patient_name || `Patient #${link.patient_id}`}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                            {link.role_in_team}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1 border ${
                              isActive
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : isPending
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {isActive && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                            {isPending && <Clock className="w-3 h-3 text-amber-400" />}
                            {isRevoked && <XCircle className="w-3 h-3 text-rose-400" />}
                            <span className="capitalize">{link.status}</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {isPatient
                            ? `Associated with your patient record (#${link.patient_id})`
                            : `Patient Profile #${link.patient_id} • Linked on ${new Date(link.created_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {isPending && (isPatient || isAdmin) && (
                        <button
                          type="button"
                          disabled={actionLoadingId === link.id}
                          onClick={() => handleApprove(link.id)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-[#0B1220] text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Approve Access</span>
                        </button>
                      )}

                      {!isRevoked && (
                        <button
                          type="button"
                          disabled={actionLoadingId === link.id}
                          onClick={() => handleRevoke(link.id)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-medium rounded-lg border border-slate-700 hover:border-rose-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          title="Revoke access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (1 col): Request / Add Form */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">
            {isPatient ? 'Add Provider' : 'Request Patient Access'}
          </h2>

          {isPatient ? (
            <div className="p-4 bg-[#0F172A] border border-slate-800 rounded-xl space-y-4">
              <p className="text-xs text-slate-400">
                Grant immediate access to a verified healthcare provider from our directory:
              </p>

              <form onSubmit={handleRequestProvider} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Select Healthcare Provider
                  </label>
                  <select
                    value={selectedProviderId}
                    onChange={(e) => setSelectedProviderId(Number(e.target.value))}
                    className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    {availableProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.role.toUpperCase()}) — {p.email}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!selectedProviderId}
                  className="w-full py-2 px-3 bg-teal-500 hover:bg-teal-400 text-[#0B1220] text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Connect Provider</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="p-4 bg-[#0F172A] border border-slate-800 rounded-xl space-y-4">
              <p className="text-xs text-slate-400">
                Enter a Patient ID to request care-team access. Access remains <strong className="text-amber-300">pending</strong> until approved by the patient:
              </p>

              <form onSubmit={handleRequestPatient} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Patient ID
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={requestPatientId}
                    onChange={(e) => setRequestPatientId(e.target.value)}
                    placeholder="e.g. 1, 2, 3"
                    className="w-full bg-[#0B1220] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Send Access Request</span>
                </button>
              </form>
            </div>
          )}

          {/* Privacy & Governance Notice */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>RBAC Ownership & Privacy</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every data view and therapy simulation is strictly audited in compliance with health data governance.
              Revoking a care-team link immediately blocks access to all clinical records, simulation runs, and timeline entries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
