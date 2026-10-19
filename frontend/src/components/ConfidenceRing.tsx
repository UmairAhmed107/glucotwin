import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface ConfidenceRingProps {
  score: number; // 0.0 to 1.0
  size?: number; // width & height in px
  strokeWidth?: number;
  components?: {
    n_component?: number;
    band_component?: number;
    mem_n?: number;
    band_width?: number;
  };
  label?: string;
  className?: string;
}

export const ConfidenceRing: React.FC<ConfidenceRingProps> = ({
  score = 0.0,
  size = 110,
  strokeWidth = 9,
  components,
  label = 'Twin Confidence',
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Normalize score between 0 and 1
  const clampedScore = Math.max(0, Math.min(1, score));
  const percentage = Math.round(clampedScore * 100);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - clampedScore * circumference;

  // Color coding by confidence tier
  let ringColor = '#14B8A6'; // Teal (good)
  if (clampedScore < 0.35) {
    ringColor = '#F59E0B'; // Amber (low/baseline)
  } else if (clampedScore < 0.65) {
    ringColor = '#2DD4BF'; // Bright Teal (moderate)
  }

  const nComp = components?.n_component ?? 0.6 * (1 - Math.exp(-(components?.mem_n ?? 0) / 5));
  const bandComp = components?.band_component ?? 0.4 * 0.5;

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${percentage}%`}
    >
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1E293B"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Inner Score Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold tracking-tight text-slate-100">
            {percentage}%
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
            Confidence
          </span>
        </div>
      </div>

      {label && (
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-400 font-medium cursor-help">
          <span>{label}</span>
          <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
        </div>
      )}

      {/* Breakdown Tooltip */}
      {showTooltip && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs text-slate-200 bg-[#162540] border border-slate-700 rounded-lg shadow-2xl backdrop-blur-md pointer-events-none transition-opacity animate-in fade-in"
        >
          <div className="font-semibold text-teal-400 mb-1 flex items-center justify-between">
            <span>Twin Personalisation Formula</span>
            <span className="text-[11px] text-slate-300 font-mono">
              Score: {clampedScore.toFixed(2)}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
            Confidence grows as the twin logs more real meals and narrows its 10th–90th prediction band.
          </p>

          <div className="space-y-1.5 border-t border-slate-800 pt-2 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Meal History Weight (60%):</span>
              <span className="font-mono text-slate-200">
                {(nComp * 100).toFixed(0)}% (n = {components?.mem_n ?? 0})
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Ensemble Sharpness (40%):</span>
              <span className="font-mono text-slate-200">
                {(bandComp * 100).toFixed(0)}%
              </span>
            </div>
            {components?.band_width !== undefined && (
              <div className="flex justify-between items-center text-slate-400">
                <span>Band Width (p90 - p10):</span>
                <span className="font-mono text-teal-300">
                  {components.band_width.toFixed(1)} mg/dL
                </span>
              </div>
            )}
          </div>

          <div className="mt-2 text-[10px] text-slate-400 italic font-mono bg-[#0B1220]/70 p-1.5 rounded">
            0.6*(1 - e^(-n/5)) + 0.4*(1 - norm_band)
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#162540]" />
        </div>
      )}
    </div>
  );
};
