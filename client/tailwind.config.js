/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0D0D0D',
        paper: '#F5F0E8',
        gold: '#C8A84B',
        'gold-light': '#E8D08A',
        green: '#1A3C2E',
        'green-mid': '#2D5C43',
        cream: '#FAF7F0',
        rust: '#8B3A2A',
        gray: '#6B6B6B',
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        playfair: ['Playfair Display', 'serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
