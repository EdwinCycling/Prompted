/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#09090b', // Zinc 950
        surface: '#18181b', // Zinc 900
        primary: '#8b5cf6', // Violet 500
        'primary-hover': '#7c3aed', // Violet 600
        text: '#f4f4f5', // Zinc 100
        muted: '#a1a1aa', // Zinc 400
        border: '#27272a', // Zinc 800
      }
    },
  },
  plugins: [],
}
