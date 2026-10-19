export const THEME_COLORS = {
  background: '#0B1220',
  card: '#111C30',
  cardHover: '#162540',
  border: '#1E293B',
  subtle: '#0F172A',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Accents
  teal: '#14B8A6',
  tealGlow: '#2DD4BF',
  tealDark: '#0D9488',
  tealLight: '#5EEAD4',
  tealBand: 'rgba(20, 184, 166, 0.15)',

  // Alerts & Severity
  warning: '#F59E0B',
  warningLight: '#FDE68A',
  danger: '#EF4444',
  dangerLight: '#FCA5A5',
  success: '#10B981',

  // Chart Specific
  chart: {
    baseline: '#64748B',            // Slate 500 for baseline curve
    intervention: '#14B8A6',        // Teal 500 for what-if / intervention
    band: 'rgba(20, 184, 166, 0.15)', // 15% opacity teal band
    bandStroke: 'rgba(20, 184, 166, 0.35)',
    projection: '#F59E0B',          // Amber 500 for population literature projection
    projectionBand: 'rgba(245, 158, 11, 0.15)',
    grid: '#1E293B',
    tooltipBg: '#111C30',
  },
} as const;

export type ThemeColors = typeof THEME_COLORS;
