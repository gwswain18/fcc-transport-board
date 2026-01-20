/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Hospital brand colors
        primary: {
          DEFAULT: '#002952',  // Prussian Blue
          50: '#e6eef5',
          100: '#ccdcea',
          200: '#99b9d5',
          300: '#6696c0',
          400: '#3373ab',
          500: '#002952',
          600: '#002147',
          700: '#00193b',
          800: '#001230',
          900: '#000a24',
        },
        secondary: {
          DEFAULT: '#8598c1',  // Wisteria Blue
          50: '#f2f4f8',
          100: '#e5e9f1',
          200: '#cbd3e3',
          300: '#b1bdd5',
          400: '#8598c1',
          500: '#6b7fad',
          600: '#566699',
          700: '#414d85',
          800: '#2c3471',
          900: '#171b5d',
        },
        accent: {
          DEFAULT: '#a36d00',  // Golden Earth
          50: '#fff8e6',
          100: '#fff1cc',
          200: '#ffe399',
          300: '#ffd566',
          400: '#ffc733',
          500: '#a36d00',
          600: '#8a5c00',
          700: '#714b00',
          800: '#583a00',
          900: '#3f2900',
        },
        olive: {
          DEFAULT: '#715f3d',  // Olive Wood
          50: '#f5f3ef',
          100: '#ebe7df',
          200: '#d7cfbf',
          300: '#c3b79f',
          400: '#9a8b6e',
          500: '#715f3d',
          600: '#5f5034',
          700: '#4d412b',
          800: '#3b3222',
          900: '#292319',
        },
        smoke: '#f5f5f5',      // White Smoke (background)
        alabaster: '#e0e0e0', // Alabaster Grey (borders)
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
