import type { Config } from 'tailwindcss';

// Colors pulled directly from the Flutter app (BottomNavigation, MatchCard,
// GameExtension.winnerColor, etc. in the original lib/ source).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        funspot: {
          bg: '#0B0F1A', // app background (near-black)
          surface: '#121A30', // splash / card background from pubspec native splash
          green: '#10B981', // primary accent (nav, CTAs)
          greenDark: '#059669',
          blue: '#3B82F6', // away-win color
          purple: '#8B5CF6', // draw color
          amber: '#F59E0B', // open bet / pending
        },
      },
    },
  },
  plugins: [],
};
export default config;
