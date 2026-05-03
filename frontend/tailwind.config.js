/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Bone-on-near-black mission control palette.
        ink: {
          50:  '#F6F4EE',
          100: '#E8E1CF',
          200: '#C7BFA8',
          300: '#9C9582',
          400: '#6F6A5C',
          500: '#4A463E',
          600: '#2E2C28',
          700: '#1B1A18',
          800: '#101012',
          900: '#07090F',
        },
        // Amber CRT phosphor — the dominant signal colour.
        phosphor: {
          DEFAULT: '#FFB454',
          bright:  '#FFC97A',
          dim:     '#A87534',
          deep:    '#5C3F1B',
        },
        // Cyan oscilloscope — used for confirmations / scopes.
        scope: {
          DEFAULT: '#5CE5E5',
          dim:     '#3FA0A0',
          deep:    '#1F5050',
        },
        // Iron-oxide red for errors / aborts.
        ferric: {
          DEFAULT: '#C73E32',
          bright:  '#E25A4D',
          dim:     '#7A2620',
        },
        // Legacy aliases so any unswept callers keep compiling.
        accent: { DEFAULT: '#FFB454', dim: '#A87534' },
        warn:    '#FFB454',
        bad:     '#C73E32',
      },
      fontFamily: {
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        widest: '0.22em',
      },
      animation: {
        'crt-flicker':     'crt-flicker 3.4s steps(2, end) infinite',
        'cursor-blink':    'cursor-blink 1.05s steps(2, end) infinite',
        'phosphor-pulse':  'phosphor-pulse 2.4s ease-in-out infinite',
        'scope-sweep':     'scope-sweep 6s linear infinite',
        'tape-feed':       'tape-feed 280ms cubic-bezier(.2,.6,.2,1) both',
        'pulse-soft':      'pulse-soft 2.4s ease-in-out infinite',
        'pulse-slow':      'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in':        'tape-feed 240ms ease-out',
        'pip-pulse':       'pip-pulse 1.6s ease-in-out infinite',
      },
      keyframes: {
        'crt-flicker': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.97' },
        },
        'cursor-blink': {
          '0%, 49%':   { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        'phosphor-pulse': {
          '0%, 100%': { textShadow: '0 0 0 rgba(255,180,84,0)' },
          '50%':      { textShadow: '0 0 12px rgba(255,180,84,0.55)' },
        },
        'scope-sweep': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'tape-feed': {
          '0%':   { opacity: '0', transform: 'translateY(6px) skewY(-0.4deg)', filter: 'blur(2px)' },
          '60%':  { filter: 'blur(0)' },
          '100%': { opacity: '1', transform: 'translateY(0) skewY(0)', filter: 'blur(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.7' },
          '50%':      { opacity: '1' },
        },
        'pip-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 currentColor' },
          '50%':      { boxShadow: '0 0 0 4px transparent' },
        },
      },
    },
  },
  plugins: [],
};
