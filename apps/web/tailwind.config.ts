import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media',
  content: ['./**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        condensed: ['Saira Condensed', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'fan-xs': '2px', 'fan-sm': '4px', 'fan-md': '8px', 'fan-base': '12px',
        'fan-lg': '16px', 'fan-xl': '20px', 'fan-xxl': '24px', 'fan-xxxl': '32px',
      },
      borderRadius: {
        'fan-sm': '4px', 'fan-md': '8px', 'fan-lg': '14px', 'fan-xl': '18px', 'fan-pill': '999px',
      },
      fontSize: {
        'fan-scoreHero': ['48px', { lineHeight: '1.0', letterSpacing: '-1px', fontWeight: '800' }],
        'fan-scoreCompact': ['32px', { lineHeight: '1.0', letterSpacing: '-0.5px', fontWeight: '800' }],
        'fan-scoreDash': ['24px', { lineHeight: '1.0', letterSpacing: '0px', fontWeight: '600' }],
        'fan-headline': ['24px', { lineHeight: '1.2', letterSpacing: '0.2px', fontWeight: '700' }],
        'fan-title': ['15px', { lineHeight: '1.3', letterSpacing: '0.1px', fontWeight: '700' }],
        'fan-body': ['14px', { lineHeight: '1.55', letterSpacing: '0px', fontWeight: '400' }],
        'fan-caption': ['10px', { lineHeight: '1.3', letterSpacing: '0.2px', fontWeight: '500' }],
        'fan-tag': ['8px', { lineHeight: '1.2', letterSpacing: '1.2px', fontWeight: '700' }],
        'fan-button': ['10px', { lineHeight: '1.2', letterSpacing: '0.4px', fontWeight: '700' }],
        'fan-statValue': ['16px', { lineHeight: '1.0', letterSpacing: '0px', fontWeight: '800' }],
        'fan-statDelta': ['19px', { lineHeight: '1.2', letterSpacing: '0.3px', fontWeight: '300' }],
        'fan-votePct': ['16px', { lineHeight: '1.0', letterSpacing: '0px', fontWeight: '600' }],
        'fan-competition': ['9px', { lineHeight: '1.2', letterSpacing: '1.4px', fontWeight: '600' }],
      },
      boxShadow: {
        'fan-subtle': 'var(--fan-shadow-subtle)', 'fan-card': 'var(--fan-shadow-card)',
        'fan-elevated': 'var(--fan-shadow-elevated)', 'fan-glow': 'var(--fan-shadow-glow)',
        'fan-button': 'var(--fan-shadow-button)',
      },
      colors: {
        fan: {
          background: 'var(--fan-background)', backgroundTint: 'var(--fan-background-tint)',
          surface: 'var(--fan-surface)', surfaceElevated: 'var(--fan-surface-elevated)',
          surfaceSunken: 'var(--fan-surface-sunken)', inputSurface: 'var(--fan-input-surface)',
          border: 'var(--fan-border)', borderActive: 'var(--fan-border-active)', borderFocus: 'var(--fan-border-focus)',
          primary: 'var(--fan-primary)', primaryDark: 'var(--fan-primary-dark)', primaryMuted: 'var(--fan-primary-muted)',
          primaryDim: 'var(--fan-primary-dim)', secondary: 'var(--fan-secondary)', secondaryDim: 'var(--fan-secondary-dim)',
          draw: 'var(--fan-draw)', drawDim: 'var(--fan-draw-dim)', away: 'var(--fan-away)', awayDim: 'var(--fan-away-dim)',
          live: 'var(--fan-live)', textPrimary: 'var(--fan-text-primary)', textSecondary: 'var(--fan-text-secondary)',
          textTertiary: 'var(--fan-text-tertiary)', textInverse: 'var(--fan-text-inverse)',
          scoreAway: 'var(--fan-score-away)', scoreDash: 'var(--fan-score-dash)',
        },
      },
    },
  },
  plugins: [],
};
export default config;