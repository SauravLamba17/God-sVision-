import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        terminal: '#020817',
        panel: '#0a0f1e',
        header: '#0d1526',
        hover: '#111827',
        accent: '#38bdf8',
        gold: '#f59e0b',
        positive: '#22c55e',
        negative: '#ef4444',
        warning: '#f59e0b',
        neutral: '#94a3b8',
        muted: '#475569',
        'border-dim': '#1e293b',
        'border-medium': '#1e3a5f',
        'border-bright': '#2563eb',
        primary: '#e2e8f0',
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'data':    ['11px', '14px'],
        'data-sm': ['10px', '13px'],
        'data-lg': ['12px', '16px'],
        'label':   ['13px', '16px'],
        'title':   ['14px', '18px'],
      },
      boxShadow: {
        'glow-cyan':  '0 0 12px rgba(56,189,248,0.25)',
        'glow-green': '0 0 12px rgba(34,197,94,0.25)',
        'glow-red':   '0 0 12px rgba(239,68,68,0.25)',
        'glow-gold':  '0 0 12px rgba(245,158,11,0.25)',
        'panel':      '0 4px 24px rgba(0,0,0,0.5)',
      },
      animation: {
        'ticker':      'ticker 60s linear infinite',
        'flash-green': 'flashGreen 0.4s ease-out',
        'flash-red':   'flashRed 0.4s ease-out',
        'blink':       'blink 1s step-end infinite',
        'pulse-dot':   'pulseDot 2s ease-in-out infinite',
        'glow-pulse':  'glowPulse 3s ease-in-out infinite',
        'slide-in':    'slideIn 0.2s ease-out',
        'shimmer':     'shimmer 1.8s linear infinite',
      },
      keyframes: {
        ticker: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        flashGreen: {
          '0%':   { backgroundColor: 'rgba(34,197,94,0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashRed: {
          '0%':   { backgroundColor: 'rgba(239,68,68,0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.5', transform: 'scale(0.75)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(56,189,248,0.3)' },
          '50%':      { boxShadow: '0 0 20px rgba(56,189,248,0.6)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
