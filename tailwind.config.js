/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#1d2522',
        canvas: '#f8f8f6',
        line: '#e5e7e4',
        muted: '#6e7772'
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
