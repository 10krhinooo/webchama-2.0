import tailwindcssAnimate from "tailwindcss-animate"

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Design system v2 (see issue #84): a Kenyan market/textile-grounded identity, replacing
      // the ink-ledger palette. Primary is a deep kanga-teal (the color of trust and money,
      // drawn from kanga-cloth borders), accent is a saffron gold. Danger, success, and warning
      // each keep their own hue (clay, shamba green, ochre) distinct from primary and accent so
      // status colors never collide with brand color.
      colors: {
        primary: {
          DEFAULT: "#1B4D45",
          dark: "#12302B",
          light: "#DCEAE6",
        },
        accent: {
          DEFAULT: "#E0A233",
          dark: "#B87D1D",
          light: "#FBEBCB",
        },
        danger: "#B84B2E",
        success: "#3F7A3B",
        warning: "#B8860B",
        muted: "#6E6759",
        ink: "#241E1A",
        paper: "#F7F0E4",
        "paper-dim": "#EDE1CC",
        night: "#12302B",
        "night-deep": "#0B211D",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        heading: ["Archivo", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(18, 48, 43, 0.10), 0 1px 2px -1px rgba(18, 48, 43, 0.10)",
        "card-hover": "0 4px 12px -2px rgba(18, 48, 43, 0.16)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
