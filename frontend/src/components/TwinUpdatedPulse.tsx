import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';

interface TwinUpdatedPulseProps {
  trigger?: any; // value change triggers animation
  showText?: boolean;
  message?: string;
  className?: string;
}

export const TwinUpdatedPulse: React.FC<TwinUpdatedPulseProps> = ({
  trigger,
  showText = true,
  message = 'Twin updated: memory recalibrated',
  className = '',
}) => {
  const [visible, setVisible] = useState(trigger === undefined || trigger === true);

  useEffect(() => {
    if (trigger !== undefined && trigger !== null) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          className={`inline-flex items-center gap-1.5 px-3 py-1 bg-teal-500/15 border border-teal-500/40 rounded-full text-xs font-medium text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.25)] animate-twin-pulse ${className}`}
          role="status"
          aria-live="polite"
        >
          <Zap className="w-3.5 h-3.5 text-teal-400 fill-teal-400 animate-pulse" />
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
