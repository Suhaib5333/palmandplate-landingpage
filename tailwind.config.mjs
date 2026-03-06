/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        /* Exact brand palette from guidelines */
        clay: "#A42F2A",
        "clay-dark": "#8B2020",
        saffron: "#F5B532",
        "saffron-light": "#F8C95C",
        olive: "#38572D",
        "olive-light": "#4A6E3A",
        cream: "#FCE5C5",
        "cream-light": "#FDF3E7",
        "cream-dark": "#F5D6A8",
        charcoal: "#1B1B1B",
        "charcoal-light": "#2D2D2D",
        porcelain: "#FFFFFF",
      },
      fontFamily: {
        heading: ['"TAN Ashford"', "serif"],
        body: ['"DIN Next"', "sans-serif"],
        logo: ['"Amrys"', "serif"],
      },
      fontSize: {
        "display": ["clamp(2.75rem, 6vw, 5.5rem)", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        "display-sm": ["clamp(2rem, 5vw, 4rem)", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
      },
      spacing: {
        "section": "clamp(5rem, 10vw, 8rem)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
