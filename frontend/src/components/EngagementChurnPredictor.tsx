import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  HeartHandshake,
  HelpCircle,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { showToast } from '../api/client';

export interface EngagementPatientItem {
  id: number;
  displayName: string;
  daysSinceLastSync: number;
  weeklyLogsCount: number;
  previousWeeklyLogsCount: number;
  unreadCareTeamMessages: number;
  churnRiskScore: number;
  churnRiskLevel: 'high' | 'moderate' | 'low';
  rpmStatus: 'at_risk' | 'compliant';
  recommendedNudge: string;
}

export const INITIAL_ENGAGEMENT_PATIENTS: EngagementPatientItem[] = [
  {
    id: 3,
    displayName: 'Arthur Pendelton',
    daysSinceLastSync: 6,
    weeklyLogsCount: 2,
    previousWeeklyLogsCount: 14,
    unreadCareTeamMessages: 2,
    churnRiskScore: 86,
    churnRiskLevel: 'high',
    rpmStatus: 'at_risk',
    recommendedNudge: "Hi Arthur, we noticed your glucose sensor hasn't transmitted readings in 6 days. Is your sensor applicator working alright? Reply here or call the clinic if you need a replacement sensor!",
  },
  {
    id: 5,
    displayName: 'Charles Montgomery',
    daysSinceLastSync: 4,
    weeklyLogsCount: 4,
    previousWeeklyLogsCount: 12,
    unreadCareTeamMessages: 1,
    churnRiskScore: 68,
    churnRiskLevel: 'high',
    rpmStatus: 'at_risk',
    recommendedNudge: "Hello Charles, checking in from your care team! We noticed a gap in your evening glucose logs this week. How are you feeling with the new dinner routine? We're here if you need any adjustments.",
  },
  {
    id: 4,
    displayName: 'Beatrix Vane',
    daysSinceLastSync: 2,
    weeklyLogsCount: 8,
    previousWeeklyLogsCount: 15,
    unreadCareTeamMessages: 0,
    churnRiskScore: 44,
    churnRiskLevel: 'moderate',
    rpmStatus: 'compliant',
    recommendedNudge: "Hi Beatrix! Great work maintaining your morning logs. A quick reminder to take a few photos of your lunch this week so your dietitian can review your glycemic response.",
  },
  {
    id: 1,
    displayName: 'Alex Rivera',
    daysSinceLastSync: 0,
    weeklyLogsCount: 18,
    previousWeeklyLogsCount: 16,
    unreadCareTeamMessages: 0,
    churnRiskScore: 12,
    churnRiskLevel: 'low',
    rpmStatus: 'compliant',
    recommendedNudge: "Hi Alex, fantastic logging consistency! You have logged 18 meals this week and your stability score is on track for a new streak record.",
  },
];

interface EngagementChurnPredictorProps {
  isModal?: boolean;
  onClose?: () => void;
  onSelectPatient?: (patientId: number) => void;
}

export const EngagementChurnPredictor: React.FC<EngagementChurnPredictorProps> = ({
  isModal = false,
  onClose,
  onSelectPatient,
}) => {
  const [patients, setPatients] = useState<EngagementPatientItem[]>(INITIAL_ENGAGEMENT_PATIENTS);
  const [filter, setFilter] = useState<'all' | 'high' | 'moderate' | 'low'>('all');
  const [nudgedPatientIds, setNudgedPatientIds] = useState<Set<number>>(new Set());
  const [activeNudgePatient, setActiveNudgePatient] = useState<EngagementPatientItem | null>(null);
  const [nudgeMessageText, setNudgeMessageText] = useState('');
  const [isSendingNudge, setIsSendingNudge] = useState(false);

  // Statistics
  const highRiskCount = patients.filter((p) => p.churnRiskLevel === 'high').length;
  const compliantCount = patients.filter((p) => p.rpmStatus === 'compliant').length;
  const atRiskRevenue = highRiskCount * 120; // $120 CPT 99454 / patient / mo

  const filteredPatients = patients.filter((p) => {
    if (filter === 'all') return true;
    return p.churnRiskLevel === filter;
  });

  const handleOpenNudgeModal = (p: EngagementPatientItem) => {
    setActiveNudgePatient(p);
    setNudgeMessageText(p.recommendedNudge);
  };

  const handleDispatchNudge = () => {
    if (!activeNudgePatient) return;
    setIsSendingNudge(true);
    setTimeout(() => {
      setIsSendingNudge(false);
      setNudgedPatientIds((prev) => new Set(prev).add(activeNudgePatient.id));
      showToast({
        type: 'success',
        title: 'Support Nudge Dispatched',
        message: `Friendly re-engagement SMS sent to ${activeNudgePatient.displayName}.`,
      });
      setActiveNudgePatient(null);
    }, 800);
  };

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-850">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Clinic Operations & Retention
            </span>
            <span className="text-xs text-zinc-500 font-mono">CMS RPM Compliance Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-amber-400" />
            <span>Patient Engagement & Churn Predictor</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Proactively identifies patients at risk of abandoning sensor wear or dietary logging. Prevent care drop-offs and protect remote patient monitoring (RPM) reimbursement.
          </p>
        </div>

        {isModal && onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors self-start"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Top 4 Operational Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: AT-RISK PATIENTS */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-rose-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Churn Hazard</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold font-mono text-rose-400">{highRiskCount}</span>
              <span className="text-xs text-zinc-400">Patients</span>
            </div>
            <span className="text-[10px] text-rose-300 mt-0.5 block">&gt; 4 days without sensor sync</span>
          </div>
        </div>

        {/* Card 2: RPM COMPLIANT */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">RPM Compliant</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold font-mono text-emerald-400">{compliantCount}</span>
              <span className="text-xs text-zinc-400">Patients</span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-0.5 block">&ge; 16 days active sensor wear</span>
          </div>
        </div>

        {/* Card 3: REIMBURSEMENT AT RISK */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Revenue at Risk</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold font-mono text-amber-400">${atRiskRevenue}</span>
              <span className="text-xs text-zinc-400">/mo</span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-0.5 block">CPT 99453 / 99454 threshold</span>
          </div>
        </div>

        {/* Card 4: OUTREACH STATUS */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Outreach Nudges</span>
            <Send className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold font-mono text-white">{nudgedPatientIds.size}</span>
              <span className="text-xs text-zinc-400">Sent today</span>
            </div>
            <span className="text-[10px] text-emerald-400 mt-0.5 block">Automated Care Team SMS</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            filter === 'all' ? 'bg-white text-black font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
        >
          All Monitored ({patients.length})
        </button>
        <button
          onClick={() => setFilter('high')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            filter === 'high' ? 'bg-rose-500 text-white font-bold' : 'bg-zinc-900 text-rose-400 hover:text-rose-300 border border-zinc-800'
          }`}
        >
          High Churn Risk ({highRiskCount})
        </button>
        <button
          onClick={() => setFilter('moderate')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            filter === 'moderate' ? 'bg-amber-400 text-black font-bold' : 'bg-zinc-900 text-amber-400 hover:text-amber-300 border border-zinc-800'
          }`}
        >
          Moderate Risk
        </button>
        <button
          onClick={() => setFilter('low')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            filter === 'low' ? 'bg-emerald-500 text-black font-bold' : 'bg-zinc-900 text-emerald-400 hover:text-emerald-300 border border-zinc-800'
          }`}
        >
          Engaged
        </button>
      </div>

      {/* Roster Table */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-5">Patient Name</th>
                <th className="py-3 px-5">Sensor Sync Gap</th>
                <th className="py-3 px-5">Logging Trend</th>
                <th className="py-3 px-5">Unread Notes</th>
                <th className="py-3 px-5">Churn Risk Score</th>
                <th className="py-3 px-5 text-right">Proactive Re-engagement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {filteredPatients.map((patient) => {
                const isNudged = nudgedPatientIds.has(patient.id);
                const isHigh = patient.churnRiskLevel === 'high';
                const isModerate = patient.churnRiskLevel === 'moderate';

                return (
                  <tr key={patient.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-4 px-5">
                      <div
                        onClick={() => {
                          if (onSelectPatient) {
                            onSelectPatient(patient.id);
                            onClose?.();
                          }
                        }}
                        className={`font-bold text-white flex items-center gap-2 ${onSelectPatient ? 'cursor-pointer hover:text-emerald-400 group' : ''}`}
                      >
                        <span className="group-hover:underline">{patient.displayName}</span>
                        <span className="text-[10px] font-mono text-zinc-500 font-normal">#{patient.id}</span>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {patient.rpmStatus === 'at_risk' ? (
                          <span className="text-amber-400 font-medium">&bull; $120 RPM At Risk</span>
                        ) : (
                          <span className="text-emerald-400">&bull; RPM Target Met (16+ days)</span>
                        )}
                      </span>
                    </td>

                    {/* Sensor Gap */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Clock className={`w-3.5 h-3.5 ${patient.daysSinceLastSync >= 4 ? 'text-rose-400' : 'text-zinc-500'}`} />
                        <span className={`font-bold ${patient.daysSinceLastSync >= 4 ? 'text-rose-300' : 'text-zinc-300'}`}>
                          {patient.daysSinceLastSync === 0 ? 'Today (Synced)' : `${patient.daysSinceLastSync} days ago`}
                        </span>
                      </div>
                    </td>

                    {/* Logging Trend */}
                    <td className="py-4 px-5">
                      <div className="space-y-0.5">
                        <span className="font-mono text-zinc-200">
                          {patient.weeklyLogsCount} meals <span className="text-[10px] text-zinc-500">this wk</span>
                        </span>
                        <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                          {patient.weeklyLogsCount < patient.previousWeeklyLogsCount ? (
                            <span className="text-rose-400 flex items-center gap-0.5 font-bold">
                              <TrendingDown className="w-3 h-3" /> Down from {patient.previousWeeklyLogsCount}
                            </span>
                          ) : (
                            <span className="text-emerald-400 flex items-center gap-0.5 font-bold">
                              <TrendingUp className="w-3 h-3" /> Up from {patient.previousWeeklyLogsCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Unread Notes */}
                    <td className="py-4 px-5">
                      {patient.unreadCareTeamMessages > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px] border border-amber-500/30">
                          {patient.unreadCareTeamMessages} unread
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-[11px]">All read</span>
                      )}
                    </td>

                    {/* Churn Risk Bar */}
                    <td className="py-4 px-5">
                      <div className="space-y-1 max-w-[120px]">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className={`font-bold ${isHigh ? 'text-rose-400' : isModerate ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {patient.churnRiskScore}%
                          </span>
                          <span className="text-[10px] text-zinc-500 uppercase">{patient.churnRiskLevel}</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isHigh ? 'bg-rose-500' : isModerate ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${patient.churnRiskScore}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Action Button */}
                    <td className="py-4 px-5 text-right">
                      {isNudged ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Nudged Today</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleOpenNudgeModal(patient)}
                          className="px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-amber-300 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/50 text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                        >
                          <Send className="w-3 h-3 text-amber-400" />
                          <span>Send Re-engagement Nudge</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outreach Nudge Drawer/Modal */}
      <AnimatePresence>
        {activeNudgePatient && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveNudgePatient(null)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed inset-4 sm:inset-y-24 sm:inset-x-20 md:inset-x-44 lg:inset-x-72 z-50 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl p-6 flex flex-col justify-between text-zinc-100"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-amber-400" />
                    <h3 className="font-bold text-base text-white">
                      Dispatch Care Team Nudge to {activeNudgePatient.displayName}
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveNudgePatient(null)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                  <span className="font-bold">Detected Dropout Risk: </span>
                  No sensor telemetry in {activeNudgePatient.daysSinceLastSync} days &bull; Meal logging dropped by 75%.
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">SMS / Chat Message Preview:</label>
                  <textarea
                    rows={4}
                    value={nudgeMessageText}
                    onChange={(e) => setNudgeMessageText(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-zinc-600 leading-relaxed font-sans"
                  />
                  <span className="text-[11px] text-zinc-500 mt-1 block">
                    Dispatches directly to patient's mobile phone via clinic gateway and logs in Care Team Messages.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-850">
                <button
                  onClick={() => setActiveNudgePatient(null)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDispatchNudge}
                  disabled={isSendingNudge}
                  className="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-xs flex items-center gap-2 hover:bg-zinc-200 transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSendingNudge ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" /> : <Send className="w-3.5 h-3.5 text-black" />}
                  <span>Dispatch SMS Nudge</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );

  if (isModal) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="fixed inset-3 sm:inset-y-8 sm:inset-x-12 md:inset-x-24 lg:inset-x-52 z-50 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl p-6 overflow-y-auto text-zinc-100"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    );
  }

  return content;
};
