/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        meme: {
          yellow: '#FFE500',
          dark: '#0f172a',
          surface: '#1e293b',
          card: '#182234',
          border: '#334155',
          accent: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        meme: ['Arial Black', 'Impact', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

