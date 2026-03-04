/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        palm: {
          50: "#fdf8f0",
          100: "#f9eddb",
          200: "#f2d7b0",
          300: "#e9bc7d",
          400: "#df9a48",
          500: "#d4812a",
          600: "#c06820",
          700: "#a0501d",
          800: "#82411f",
          900: "#6b371c",
          950: "#3a1b0c",
        },
        plate: {
          50: "#f0f9f4",
          100: "#dbf0e3",
          200: "#bae0ca",
          300: "#8cc9a8",
          400: "#5aab81",
          500: "#389066",
          600: "#287451",
          700: "#205d42",
          800: "#1c4a36",
          900: "#183d2e",
          950: "#0c221a",
        },
        cream: "#fdfbf7",
        charcoal: "#2d2d2d",
      },
      fontFamily: {
        heading: ["Playfair Display", "serif"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
