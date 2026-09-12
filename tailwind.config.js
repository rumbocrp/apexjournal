/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        canvas: '#09090b',
        obsidian: {
          950: '#09090b',
          900: '#111113',
          850: '#161619',
          800: '#1e1e22',
          700: '#27272e',
          600: '#383842',
          500: '#63636c',
          400: '#9e9ea7',
          300: '#d4d4d8',
          200: '#e4e4e7',
          100: '#ededef',
          50: '#fafafa',
        },
        surface: {
          DEFAULT: '#111113',
          primary: '#111113',
          secondary: '#161619',
          tertiary: '#1c1c20',
          hover: '#1e1e24',
          active: '#24242c',
          border: '#242429',
          borderSubtle: '#1a1a1e',
          borderHighlight: '#36363f',
        },
        financial: {
          positive: '#10b981',
          positiveMuted: '#06281e',
          positiveText: '#34d399',
          positiveBorder: '#0e533c',
          negative: '#ef4444',
          negativeMuted: '#2e0b11',
          negativeText: '#f87171',
          negativeBorder: '#711b25',
          warning: '#f59e0b',
          warningMuted: '#2c1b04',
          warningText: '#fbbf24',
          warningBorder: '#6b4308',
          neutral: '#9e9ea7',
          neutralMuted: '#1c1c20',
        },
        signal: {
          DEFAULT: '#ED775C',
          hover: '#F0866B',
          mist: '#F7CDBE',
        },
        traffic: {
          green: '#10b981',
          greenBg: '#06281e',
          greenBorder: '#0e533c',
          greenText: '#34d399',
          yellow: '#f59e0b',
          yellowBg: '#2c1b04',
          yellowBorder: '#6b4308',
          yellowText: '#fbbf24',
          red: '#ef4444',
          redBg: '#2e0b11',
          redBorder: '#711b25',
          redText: '#f87171',
        }
      },
      fontFamily: {
        sans: [
          '"Cabin"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'system-ui',
          'sans-serif'
        ],
        mono: [
          '"Jost"',
          '"SF Mono"',
          'Menlo',
          'Monaco',
          'monospace'
        ],
        serif: [
          '"Lora"',
          'Georgia',
          'serif'
        ],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 1px 2px -1px rgba(0, 0, 0, 0.5)',
        'modal': '0 20px 25px -5px rgba(0, 0, 0, 0.8), 0 8px 10px -6px rgba(0, 0, 0, 0.8)',
      }
    },
  },
  plugins: [],
}
