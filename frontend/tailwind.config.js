/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Poppins", "Pretendard", "sans-serif"],
        heading: ["Poppins", "sans-serif"],
        body: ["Pretendard", "sans-serif"],
      },
      colors: {
        brand: {
          pink: "#ec4899",
          purple: "#8b5cf6",
          indigo: "#4f46e5",
        },
      },
    },
  },
  plugins: [],
}
