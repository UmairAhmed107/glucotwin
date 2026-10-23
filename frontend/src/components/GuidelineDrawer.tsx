import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, ShieldAlert, ExternalLink, FileText } from 'lucide-react';
import { GuidelineSnippet } from '../api/types';

interface GuidelineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  snippet: GuidelineSnippet | null;
}

export const GuidelineDrawer: React.FC<GuidelineDrawerProps> = ({
  isOpen,
  onClose,
  snippet,
}) => {
  return (
    <AnimatePresence>
      {isOpen && snippet && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#09090b] border-l border-zinc-800 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-[#09090b]">
              <div className="flex items-center space-x-2 text-white">
                <BookOpen className="w-5 h-5 text-white" />
                <h3 className="text-base font-bold text-white">Guideline Evidence Snippet</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                aria-label="Close guideline drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm text-zinc-300">
              <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between">
                <span className="font-mono font-bold">{snippet.id}</span>
                <span className="text-[11px] bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-200 uppercase tracking-wider font-semibold">
                  Evidence Reference
                </span>
              </div>

              <div>
                <h4 className="text-base font-semibold text-white mb-2">{snippet.topic}</h4>
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 leading-relaxed text-xs text-slate-300 whitespace-pre-line font-sans">
                  {snippet.text}
                </div>
              </div>

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
