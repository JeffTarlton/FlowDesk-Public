// Theme colors are CSS variables (RGB channels) defined per color theme in src/themes.css,
// so switching the data-theme attribute on <html> recolors the whole app.
const themeVar = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const themeScale = (name) =>
  Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [step, themeVar(`${name}-${step}`)]));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: themeScale('primary'),
        gray: themeScale('gray'),
        // Page background behind cards
        canvas: {
          DEFAULT: themeVar('canvas'),
          dark: themeVar('canvas-dark'),
        },
        // Card / panel background in dark mode (light mode cards stay white)
        surface: {
          dark: themeVar('surface-dark'),
          'dark-raised': themeVar('surface-dark-raised'),
        },
      },
      keyframes: {
        'slide-in': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.25s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
