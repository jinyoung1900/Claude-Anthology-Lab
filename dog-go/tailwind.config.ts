import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF7EC',
        bark: '#5B3A29',
        moss: '#6BA368',
        sky: '#BFE3F2',
        peach: '#F6B98F',
        berry: '#E0607E',
        rare: '#4F8EF7',
        epic: '#A55EEA',
      },
      fontFamily: { pixel: ['"Press Start 2P"', 'monospace'] },
      boxShadow: { chunky: '0 4px 0 0 rgba(91,58,41,0.35)' },
    },
  },
  plugins: [],
} satisfies Config;
