import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Heart,
  Mail,
  Phone,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { showToast } from '../api/client';

interface CareCircleContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
  notifyHypo: boolean;
  notifyHyper: boolean;
  notifyInactivity: boolean;
}

interface CareCircleModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
}

export const CareCircleModal: React.FC<CareCircleModalProps> = ({
  isOpen,
  onClose,
  patientName,
}) => {
  const [contact, setContact] = useState<CareCircleContact>({
    name: 'Sarah Rivera',
    relationship: 'Spouse & Primary Caregiver',
    phone: '+1 (555) 342-8901',
    email: 'sarah.rivera@example.com',
    notifyHypo: true,
    notifyHyper: true,
    notifyInactivity: false,
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{
    dispatchedAt: string;
    messageText: string;
    deliveryChannel: string;
    latencyMs: number;
  } | null>(null);

  const handleSimulateAlert = () => {
    setIsSimulating(true);
    setSimulationResult(null);

    setTimeout(() => {
      setIsSimulating(false);
      setSimulationResult({
        dispatchedAt: new Date().toLocaleTimeString(),
        messageText: `[GlucoTwin Emergency Alert] 🚨 HIGH PRIORITY: ${patientName}'s continuous glucose sensor recorded acute nocturnal hypoglycemia (48 mg/dL) at 2:14 AM. No rescue carbs logged within 10 minutes. Please check on patient immediately.`,
        deliveryChannel: `SMS via Twilio Telecom Gateway to ${contact.phone}`,
        latencyMs: 740,
      });

      showToast({
        type: 'warning',
        title: 'Emergency Alert Dispatched',
        message: `Simulated high-priority hypo alert delivered to ${contact.name}.`,
      });
    }, 1200);
  };

  const handleSave = () => {
    showToast({
      type: 'success',
      title: 'Care Circle Saved',
      message: `${contact.name} (${contact.relationship}) is active as primary emergency guardian.`,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="fixed inset-3 sm:inset-y-8 sm:inset-x-12 md:inset-x-24 lg:inset-x-60 z-50 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-850 bg-zinc-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Heart className="w-5 h-5 fill-rose-500/20" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">Family & Emergency Care Circle</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                      Active Shield
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Designate loved ones or guardians to automatically receive urgent nocturnal hypoglycemia SMS alerts.
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Primary Contact Details */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
                    <User className="w-4 h-4 text-emerald-400" />
                    <span>Primary Emergency Guardian</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Verified Contact
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Guardian Full Name</label>
                    <input
                      type="text"
                      value={contact.name}
                      onChange={(e) => setContact({ ...contact, name: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Relationship</label>
                    <input
                      type="text"
                      value={contact.relationship}
                      onChange={(e) => setContact({ ...contact, relationship: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Emergency Phone (SMS)</label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        value={contact.phone}
                        onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-white font-mono focus:outline-none focus:border-zinc-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Notification Email</label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => setContact({ ...contact, email: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-white font-mono focus:outline-none focus:border-zinc-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Automated Safety Triggers Toggle */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>Automated Safety Triggers</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* Trigger 1: Nocturnal Hypo */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-850">
                    <div className="space-y-0.5">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Acute Nocturnal Hypoglycemia (&lt; 54 mg/dL)
                      </span>
                      <p className="text-[11px] text-zinc-400">
                        Dispatches SMS alert if glucose drops below 54 mg/dL between 10 PM – 6 AM and is not acknowledged within 10 minutes.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={contact.notifyHypo}
                      onChange={(e) => setContact({ ...contact, notifyHypo: e.target.checked })}
                      className="w-4 h-4 accent-white rounded cursor-pointer"
                    />
                  </div>

                  {/* Trigger 2: Severe Highs */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-850">
                    <div className="space-y-0.5">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        Prolonged Extreme High (&gt; 250 mg/dL &gt; 3 hours)
                      </span>
                      <p className="text-[11px] text-zinc-400">
                        Notifies guardian if high sugar persists to prevent dehydration or diabetic ketoacidosis.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={contact.notifyHyper}
                      onChange={(e) => setContact({ ...contact, notifyHyper: e.target.checked })}
                      className="w-4 h-4 accent-white rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Simulation Sandbox */}
              <div className="bg-rose-500/5 border border-rose-500/25 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-300 uppercase tracking-wider">
                    <Zap className="w-4 h-4 text-rose-400" />
                    <span>Caregiver Alert Testing Sandbox</span>
                  </div>
                  <button
                    onClick={handleSimulateAlert}
                    disabled={isSimulating}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSimulating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Simulate 2 AM Hypo Alert</span>
                  </button>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Test the real-time emergency dispatch pipeline. Verifies delivery latency and SMS payload formatting.
                </p>

                {simulationResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-zinc-950 border border-rose-500/30 space-y-2 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Dispatched & Delivered ({simulationResult.latencyMs}ms)
                      </span>
                      <span>{simulationResult.dispatchedAt}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-sans leading-relaxed">
                      {simulationResult.messageText}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Channel: {simulationResult.deliveryChannel}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-850 bg-zinc-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Encrypted Cellular Gateways Active</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer shadow-md"
                >
                  Save Care Circle
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
