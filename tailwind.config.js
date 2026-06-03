/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './public/**/*.{html,js}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1A2E3B', // soft navy
        "primary-600": '#1A2E3B',
        "primary-700": '#16324A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
