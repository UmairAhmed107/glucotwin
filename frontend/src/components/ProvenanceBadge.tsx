import React, { useState } from 'react';
import { Cpu, Sparkles, TrendingUp, ShieldCheck, FlaskConical, AlertCircle } from 'lucide-react';

export type ProvenanceKind =
  | 'TWIN_PREDICTED'
  | 'GUIDELINE_AI'
  | 'PROJECTION'
  | 'SAFETY_CHECKED'
  | 'DEMO_FIXTURE';

interface ProvenanceBadgeProps {
  kind?: ProvenanceKind;
  provenance?: string;
  safetyChecked?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const BADGE_CONFIG: Record<
  ProvenanceKind,
  {
    label: string;
    icon: React.ElementType;
    bg: string;
    border: string;
    text: string;
    description: string;
  }
> = {
  TWIN_PREDICTED: {
    label: 'PERSONALIZED',
    icon: Cpu,
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    text: 'text-teal-400',
    description:
      'Personalized response calculated from the patient profile, historical meal logs, and activity telemetry.',
  },
  GUIDELINE_AI: {
    label: 'CLINICAL GUIDELINE',
    icon: Sparkles,
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-400',
    description:
      'Grounded in verified ADA & ICMR clinical guidelines and evaluated against safety rules.',
  },
  PROJECTION: {
    label: 'CARE DIRECTIVE',
    icon: TrendingUp,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    description:
      'Targeted therapeutic recommendation and standard clinical care pathway directive.',
  },
  SAFETY_CHECKED: {
    label: 'SAFETY-VERIFIED',
    icon: ShieldCheck,
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    description:
      'Evaluated against clinical contraindications, renal safety bounds, and drug-drug safety rules.',
  },
  DEMO_FIXTURE: {
    label: 'SAMPLE RECORD',
    icon: FlaskConical,
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    description:
      'Pre-populated sample record for system demonstration and workflow evaluation.',
  },
};

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({
  kind,
  provenance,
  safetyChecked,
  size = 'md',
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const resolvedKind = (kind || provenance || 'TWIN_PREDICTED') as ProvenanceKind;
  const config = BADGE_CONFIG[resolvedKind] || {
    label: resolvedKind,
    icon: AlertCircle,
    bg: 'bg-slate-700/20',
    border: 'border-slate-700',
    text: 'text-slate-300',
    description: 'System badge',
  };
  const Icon = config.icon;

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px] gap-1'
      : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className="relative inline-flex items-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        tabIndex={0}
        role="note"
        aria-label={`${config.label}: ${config.description}`}
      >
        <span
          className={`inline-flex items-center font-medium uppercase tracking-wider rounded-md border ${config.bg} ${config.border} ${config.text} ${sizeClasses} cursor-help transition-colors select-none ${className}`}
        >
          <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          <span>{config.label}</span>
        </span>

        {showTooltip && (
          <div
            role="tooltip"
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 text-xs text-slate-200 bg-[#162540] border border-slate-700 rounded-md shadow-xl backdrop-blur-md pointer-events-none transition-opacity duration-150 animate-in fade-in"
          >
            <div className="font-semibold text-slate-100 mb-0.5 flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 text-teal-400" />
              {config.label}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {config.description}
            </p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#162540]" />
          </div>
        )}
      </div>

      {safetyChecked && resolvedKind !== 'SAFETY_CHECKED' && (
        <ProvenanceBadge kind="SAFETY_CHECKED" size={size} />
      )}
    </div>
  );
};
