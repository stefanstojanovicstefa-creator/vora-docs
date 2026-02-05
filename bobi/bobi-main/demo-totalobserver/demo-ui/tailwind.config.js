/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'totalobserver-blue': '#2563eb',
        'totalobserver-dark': '#1e293b',
      },
    },
  },
  plugins: [],
}
