import React from 'react';
import { AlertCircle, FolderOpen, RefreshCw } from 'lucide-react';

// ============================================================================
// StatCard (Matches reference UI 4-stat cards)
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendText?: string;
  badge?: React.ReactNode;
  valueColor?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon: Icon,
  trendText,
  badge,
  valueColor = 'text-white',
  className = '',
}) => {
  return (
    <div
      className={`bg-[#09090b] border border-zinc-800/90 hover:border-zinc-700/80 rounded-2xl p-5 shadow-sm transition-all group ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {badge}
          {Icon && (
            <div className="w-9 h-9 rounded-full bg-zinc-900/90 border border-zinc-800 flex items-center justify-center text-zinc-300 group-hover:text-white group-hover:border-zinc-700 transition-colors">
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-extrabold tracking-tight font-mono ${valueColor}`}>
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-zinc-500 font-medium">{subValue}</span>
        )}
      </div>
      {trendText && (
        <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5">
          <span>{trendText}</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SectionCard
// ============================================================================

interface SectionCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  headerAction?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  description,
  headerAction,
  badge,
  icon,
  children,
  className = '',
}) => {
  const sub = description || subtitle;
  return (
    <div
      className={`bg-[#09090b] border border-zinc-800/90 rounded-2xl p-6 shadow-sm hover:border-zinc-700/60 transition-all ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
                {icon}
              </div>
            )}
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            {badge}
          </div>
          {sub && (
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {sub}
            </p>
          )}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
};

// ============================================================================
// EmptyState
// ============================================================================

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = FolderOpen,
  action,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-10 text-center rounded-2xl border border-dashed border-zinc-800 bg-[#09090b]/60 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3.5">
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-bold text-zinc-200 mb-1">{title}</h4>
      <p className="text-xs text-zinc-400 max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      {action ? (
        <div>{action}</div>
      ) : actionText && onAction ? (
        <button
          onClick={onAction}
          className="px-4 py-2 text-xs font-semibold bg-white hover:bg-zinc-200 text-black rounded-full transition-all shadow-sm cursor-pointer"
        >
          {actionText}
        </button>
      ) : null}
    </div>
  );
};

// ============================================================================
// ErrorState
// ============================================================================

interface ErrorStateProps {
  code?: string;
  message: string;
  details?: Record<string, any>;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  code = 'ERROR',
  message,
  details,
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`p-5 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-zinc-200 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3.5">
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
              {code}
            </span>
            <h4 className="text-sm font-semibold text-rose-200">
              Request Unsuccessful
            </h4>
          </div>
          <p className="text-xs text-zinc-300 mb-2 leading-relaxed">
            {message}
          </p>

          {details && Object.keys(details).length > 0 && (
            <div className="mt-2.5 p-3 bg-black/60 rounded-xl border border-rose-900/40 text-[11px] font-mono text-zinc-400 overflow-x-auto">
              <pre>{JSON.stringify(details, null, 2)}</pre>
            </div>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-zinc-700/80 rounded-full transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// LoadingSkeleton
// ============================================================================

interface LoadingSkeletonProps {
  count?: number;
  height?: string;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  count = 1,
  height = 'h-16',
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${height} bg-zinc-900/80 border border-zinc-800/80 rounded-2xl animate-pulse`}
        />
      ))}
    </div>
  );
};
