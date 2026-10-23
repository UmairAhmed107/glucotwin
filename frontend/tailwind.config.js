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
        background: '#030303',
        foreground: '#F4F4F5',
        card: {
          DEFAULT: '#09090b',
          hover: '#121215',
          foreground: '#F4F4F5',
        },
        popover: {
          DEFAULT: '#09090b',
          foreground: '#F4F4F5',
        },
        primary: {
          DEFAULT: '#FFFFFF', // High-contrast White from reference UI
          foreground: '#000000',
          hover: '#E4E4E7',
          glow: '#A1A1AA',
        },
        secondary: {
          DEFAULT: '#18181b', // Zinc 900
          foreground: '#F4F4F5',
        },
        muted: {
          DEFAULT: '#18181b',
          foreground: '#A1A1AA',
        },
        accent: {
          DEFAULT: '#FFFFFF',
          foreground: '#000000',
        },
        destructive: {
          DEFAULT: '#EF4444', // Red 500
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#F59E0B', // Amber 500
          foreground: '#000000',
        },
        border: '#27272a',
        input: '#09090b',
        ring: '#FFFFFF',
        chart: {
          baseline: '#71717A',      // Zinc 500
          intervention: '#10B981',  // Emerald 500
          band: 'rgba(255, 255, 255, 0.1)',
          projection: '#F59E0B',    // Amber 500
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
