import React from 'react';
import { AlertCircle, FolderOpen, RefreshCw } from 'lucide-react';

// ============================================================================
// StatCard
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendText?: string;
  badge?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon: Icon,
  trendText,
  badge,
  className = '',
}) => {
  return (
    <div
      className={`bg-[#111C30] border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700/80 transition-all ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {badge}
          {Icon && <Icon className="w-4 h-4 text-teal-400" />}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-100">
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-slate-400 font-normal">{subValue}</span>
        )}
      </div>
      {trendText && (
        <div className="mt-1.5 text-xs text-slate-400 flex items-center gap-1">
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
      className={`bg-[#111C30] border border-slate-800 rounded-xl p-5 shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            {icon && <span className="text-teal-400 flex items-center">{icon}</span>}
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
            {badge}
          </div>
          {sub && (
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {sub}
            </p>
          )}
        </div>
        {headerAction && <div>{headerAction}</div>}
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
      className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-slate-800 bg-[#0B1220]/50 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-slate-200 mb-1">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
        {description}
      </p>
      {action ? (
        <div>{action}</div>
      ) : actionText && onAction ? (
        <button
          onClick={onAction}
          className="px-3.5 py-1.5 text-xs font-medium bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg transition-colors cursor-pointer"
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
      className={`p-5 rounded-xl border border-red-500/30 bg-red-950/20 text-slate-200 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
              {code}
            </span>
            <h4 className="text-sm font-semibold text-red-200">
              Request Unsuccessful
            </h4>
          </div>
          <p className="text-xs text-slate-300 mb-2 leading-relaxed">
            {message}
          </p>

          {details && Object.keys(details).length > 0 && (
            <div className="mt-2 p-2 bg-[#0B1220] rounded border border-red-900/40 text-[11px] font-mono text-slate-400 overflow-x-auto">
              <pre>{JSON.stringify(details, null, 2)}</pre>
            </div>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-md transition-colors"
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
          className={`${height} bg-slate-800/40 border border-slate-800/60 rounded-xl animate-pulse`}
        />
      ))}
    </div>
  );
};
