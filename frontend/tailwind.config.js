/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Starter palette per MIGRATION_PLAN.md §3 — distinct-but-consistent with DondooHomes'
      // ocean-blue system. Confirmed direction: confident indigo primary. Revisit at UI kickoff,
      // not blocking backend work.
      colors: {
        primary: {
          DEFAULT: "#4F46E5",
          dark: "#3730A3",
          light: "#EEF2FF",
        },
        secondary: "#F5F3EE",
        danger: "#B91C1C",
        success: "#15803D",
        warning: "#B45309",
        muted: "#6B7280",
        ink: "#1F2933",
        canvas: "#FAFAF9",
        "canvas-dim": "#F2F1EC",
        night: "#1E1B4B",
        "night-deep": "#14123A",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(31, 41, 51, 0.08), 0 1px 2px -1px rgba(31, 41, 51, 0.08)",
        "card-hover": "0 4px 12px -2px rgba(31, 41, 51, 0.12)",
      },
    },
  },
  plugins: [],
}
