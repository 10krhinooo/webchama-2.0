/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Design tokens per MIGRATION_PLAN.md section 3, confirmed at UI kickoff. The brand color
      // is a deep ink-indigo, the color of blue-black ledger ink, tying the palette to the
      // literal artifact a chama keeps its records in. Danger, success, and warning each get
      // their own hue (brick, forest, marigold) so status colors never read as brand color.
      colors: {
        primary: {
          DEFAULT: "#3D3A6B",
          dark: "#26244A",
          light: "#E9E7F5",
        },
        secondary: "#F2EBD9",
        danger: "#B23A2E",
        success: "#1E5B3E",
        warning: "#C97F1D",
        muted: "#6E6759",
        ink: "#1C1A17",
        paper: "#FBF7EE",
        "paper-dim": "#F2EBD9",
        night: "#201D18",
        "night-deep": "#14120E",
      },
      fontFamily: {
        display: ["Courier Prime", "ui-monospace", "monospace"],
        mono: ["Courier Prime", "ui-monospace", "monospace"],
        heading: ["Sora", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(28, 26, 23, 0.08), 0 1px 2px -1px rgba(28, 26, 23, 0.08)",
        "card-hover": "0 4px 12px -2px rgba(28, 26, 23, 0.12)",
      },
    },
  },
  plugins: [],
}
