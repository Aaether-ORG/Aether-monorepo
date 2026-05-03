/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50:  '#f5f5f7',
          100: '#e9e9ec',
          200: '#cfcfd5',
          400: '#8e8e95',
          600: '#525258',
          800: '#1f1f24',
          900: '#0e0e12',
        },
        accent: {
          DEFAULT: '#7cf2c4',
          dim: '#3aa67d',
        },
        warn: '#f4b860',
        bad: '#ef5e5e',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 240ms ease-out',
      },
      keyframes: {
        'slide-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
