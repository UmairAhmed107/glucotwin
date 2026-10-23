export const THEME_COLORS = {
  background: '#030303',
  card: '#09090b',
  cardHover: '#121215',
  border: '#27272a',
  subtle: '#18181b',
  textPrimary: '#F4F4F5',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',

  // Accents
  teal: '#FFFFFF',
  tealGlow: '#E4E4E7',
  tealDark: '#A1A1AA',
  tealLight: '#FFFFFF',
  tealBand: 'rgba(255, 255, 255, 0.08)',

  // Alerts & Severity
  warning: '#F59E0B',
  warningLight: '#FDE68A',
  danger: '#EF4444',
  dangerLight: '#FCA5A5',
  success: '#10B981',

  // Chart Specific
  chart: {
    baseline: '#71717A',            // Zinc 500 for baseline curve
    intervention: '#10B981',        // Emerald 500 for what-if / intervention
    band: 'rgba(255, 255, 255, 0.08)',
    bandStroke: 'rgba(255, 255, 255, 0.2)',
    projection: '#F59E0B',          // Amber 500
    projectionBand: 'rgba(245, 158, 11, 0.12)',
    grid: '#27272a',
    tooltipBg: '#09090b',
  },
} as const;

export type ThemeColors = typeof THEME_COLORS;
