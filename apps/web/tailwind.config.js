/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          600: '#1a56db',
          700: '#1d4ed8',
          900: '#0f337a',
        },
        mq: {
          blue:   '#1A73E8',
          green:  '#34A853',
          amber:  '#F9AB00',
          red:    '#EA4335',
          dark:   '#0D1117',
          card:   '#141B2B',
          sidebar:'#111827',
        },
      },
    },
  },
  plugins: [],
}

