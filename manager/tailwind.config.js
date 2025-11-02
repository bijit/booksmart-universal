/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode
        'light-bg': '#f8f9fa',
        'light-card': '#ffffff',
        'light-text': '#1a1a1a',
        'light-text-secondary': '#6c757d',
        'light-border': '#e5e7eb',

        // Dark mode
        'dark-bg': '#1a1a1a',
        'dark-card': '#242424',
        'dark-text': '#e5e5e5',
        'dark-text-secondary': '#a3a3a3',
        'dark-border': '#3d3d3d',

        // Accent colors
        'accent': '#2563eb',
        'accent-hover': '#1d4ed8',
        'accent-dark': '#3b82f6',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      transitionDuration: {
        '200': '200ms',
      },
    },
  },
  plugins: [],
}
