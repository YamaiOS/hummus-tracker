/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        petro: {
          bg: '#0a1628',
          card: '#0f1d32',
          'card-hover': '#142540',
          border: '#1c2e4a',
          'border-accent': '#2a4060',
          teal: '#00a19c',
          'teal-dim': '#007a76',
          gold: '#c4a35a',
          red: '#c4463a',
          green: '#2d8a6e',
        },
        text: {
          warm: '#e8e4df',
          muted: '#8b9bb4',
          faint: '#566b8a',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
        sans: ['Inter', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
