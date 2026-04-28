/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0d0d0f',
        paper: '#f5f2eb',
        cream: '#ede9df',
        accent: '#c8392b',
        gold: '#b8973a',
        teal: '#1a6b6b',
        mid: '#6b6660',
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
        lora: ['Lora', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}
