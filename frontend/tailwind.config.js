/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B1220',
        foreground: '#F8FAFC',
        card: {
          DEFAULT: '#111C30',
          hover: '#162540',
          foreground: '#F8FAFC',
        },
        popover: {
          DEFAULT: '#111C30',
          foreground: '#F8FAFC',
        },
        primary: {
          DEFAULT: '#14B8A6', // Teal 500
          foreground: '#0B1220',
          hover: '#0D9488',   // Teal 600
          glow: '#2DD4BF',    // Teal 400
        },
        secondary: {
          DEFAULT: '#1E293B', // Slate 800
          foreground: '#E2E8F0',
        },
        muted: {
          DEFAULT: '#1E293B',
          foreground: '#94A3B8',
        },
        accent: {
          DEFAULT: '#14B8A6',
          foreground: '#0B1220',
        },
        destructive: {
          DEFAULT: '#EF4444', // Red 500
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#F59E0B', // Amber 500
          foreground: '#0B1220',
        },
        border: '#1E293B',
        input: '#1E293B',
        ring: '#14B8A6',
        chart: {
          baseline: '#64748B',      // Slate 500
          intervention: '#14B8A6',  // Teal 500
          band: 'rgba(20, 184, 166, 0.15)', // Teal with 15% opacity
          projection: '#F59E0B',    // Amber 500
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
    },
  },
  plugins: [],
}
