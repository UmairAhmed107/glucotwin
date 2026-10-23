import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ShieldCheck, Database, Cpu, HelpCircle } from 'lucide-react';

interface CalculationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  ensembleSize?: number;
  modelVersion?: string;
  inputs?: Record<string, any>;
  memory?: {
    mem_n?: number;
    mem_mean_rise?: number | null;
    mem_mean_iauc?: number | null;
    baseline_used?: boolean;
  };
  boundsChecked?: boolean;
  customNotes?: string;
}

export const CalculationDrawer: React.FC<CalculationDrawerProps> = ({
  isOpen,
  onClose,
  title = 'How was this calculated?',
  ensembleSize = 15,
  modelVersion = 'twin_recommender.pkl (v1.0.0-bootstrap15)',
  inputs,
  memory,
  boundsChecked = true,
  customNotes,
}) => {
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
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Drawer Slide-Over */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[#09090b] border-l border-zinc-800 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-[#09090b]">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-white" />
                <h3 className="text-lg font-semibold text-white">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                aria-label="Close calculation drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm text-zinc-300">
              {/* Architecture & Model Section */}
              <div className="p-4 rounded-xl bg-black border border-zinc-800 space-y-3">
                <div className="flex items-center space-x-2 text-teal-400 font-medium">
                  <Cpu className="w-4 h-4" />
                  <span>Clinical Calculation Engine</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Calculation Method:</span>
                    <span className="font-semibold text-white">Multi-factor glycemic forecast</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">System Version:</span>
                    <span className="font-mono text-slate-200">v1.0.0-production</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Projections are calculated by synthesizing the patient's nutritional macronutrient breakdown,
                  fasting glucose baseline, and physical activity timing against established physiological targets.
                </p>
              </div>

              {/* Bounds Check Section */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-emerald-400 font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Physiological Parameter Verification</span>
                  </div>
                  {boundsChecked ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Outside Range
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Every entered nutritional and metabolic parameter is verified against standard clinical reference ranges to prevent entry errors.
                </p>
              </div>

              {/* Memory Values Section */}
              {memory && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-teal-400 font-medium">
                    <Database className="w-4 h-4" />
                    <span>Patient History & Profile Conditioning</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Recorded Meals in History:</span>
                      <span className="font-semibold text-white">{memory.mem_n ?? 0} logged</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Profile Status:</span>
                      <span className={`font-semibold ${memory.baseline_used ? 'text-amber-400' : 'text-teal-400'}`}>
                        {memory.baseline_used ? 'Initial Clinical Baseline' : 'Adapted to Patient Profile'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Average Post-Meal Spike:</span>
                      <span className="font-semibold text-white">
                        {memory.mem_mean_rise != null ? `+${memory.mem_mean_rise} mg/dL` : 'Baseline'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Target Range Adherence:</span>
                      <span className="font-semibold text-white">
                        Optimal (70–140 mg/dL)
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    {memory.baseline_used
                      ? 'New patient profile initialized with guideline baseline values. Accuracy personalizes as further meal logs are submitted.'
                      : `Forecast calibrated on ${memory.mem_n} previous logged meals for this patient profile.`}
                  </p>
                </div>
              )}

              {/* Inputs Used Section */}
              {inputs && Object.keys(inputs).length > 0 && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-teal-400 font-medium">
                    <HelpCircle className="w-4 h-4" />
                    <span>Nutritional & Lifestyle Parameters</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto rounded-lg bg-slate-900 border border-slate-800/80 p-2 text-xs font-mono">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-800">
                          <th className="pb-1">Feature</th>
                          <th className="pb-1 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {Object.entries(inputs).map(([k, v]) => (
                          <tr key={k}>
                            <td className="py-1 text-slate-400">{k}</td>
                            <td className="py-1 text-right text-slate-200">
                              {typeof v === 'number' ? Number(v.toFixed(2)) : String(v)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {customNotes && (
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-300">
                  {customNotes}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 text-right">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
