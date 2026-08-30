import tailwindcssAnimate from "tailwindcss-animate"

/**
 * Colors come in two kinds, and the distinction is what makes dark mode work.
 *
 * Static ramps (primary, accent, neutral) are fixed hex values that mean the same thing in every
 * theme. Reach for a numbered step when you need a specific shade regardless of theme, for example
 * a chart series that must stay distinguishable in both.
 *
 * Semantic tokens (paper, surface, ink, brand, border, and the status colors) resolve through CSS
 * custom properties defined in index.css, so the same class produces the right value in light and
 * dark. Prefer these everywhere in application code. `bg-surface` is correct in both themes;
 * `bg-white` is only ever correct in one.
 *
 * `primary` and `brand` deliberately differ. `primary` is a fill: it sits behind white text, so it
 * has to stay dark enough for that in both themes. `brand` is a text color: it sits on top of a
 * surface, so it has to invert and go light in dark mode. A single token cannot do both jobs, and
 * trying to make it is what leaves brand-colored text invisible on a dark background.
 */
const withAlpha = (variable) => `rgb(var(${variable}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep kanga-teal, the color of trust and money, drawn from kanga-cloth borders.
        primary: {
          50: "#F0F7F5",
          100: "#DCEAE6",
          200: "#B9D6CE",
          300: "#8DBBB0",
          400: "#5F9A8C",
          500: "#3F7D6E",
          600: "#2E645A",
          700: "#245349",
          800: "#1B4D45",
          900: "#163B35",
          950: "#0B211D",
          DEFAULT: withAlpha("--color-primary"),
          light: withAlpha("--color-primary-light"),
          dark: withAlpha("--color-primary-dark"),
        },
        // Saffron gold, reserved for actions and highlights rather than large fills.
        accent: {
          50: "#FEF9EF",
          100: "#FBEBCB",
          200: "#F6D89B",
          300: "#EFC066",
          400: "#E8AE45",
          500: "#E0A233",
          600: "#C4871F",
          700: "#B87D1D",
          800: "#8F5F17",
          900: "#6B4712",
          950: "#3D280A",
          DEFAULT: withAlpha("--color-accent"),
          light: withAlpha("--color-accent-light"),
          dark: withAlpha("--color-accent-dark"),
        },
        // Neutrals carry a slight teal cast so greys sit with the brand instead of against it.
        neutral: {
          50: "#F7F9F8",
          100: "#EEF2F1",
          200: "#DFE6E4",
          300: "#C6D1CE",
          400: "#97A8A3",
          500: "#6E807B",
          600: "#55655F",
          700: "#43504B",
          800: "#2E3835",
          900: "#1C2422",
          950: "#101715",
        },

        // Surfaces, lowest to highest elevation.
        paper: {
          DEFAULT: withAlpha("--color-paper"),
          dim: withAlpha("--color-paper-dim"),
        },
        surface: {
          DEFAULT: withAlpha("--color-surface"),
          sunken: withAlpha("--color-surface-sunken"),
          raised: withAlpha("--color-surface-raised"),
          inverse: withAlpha("--color-surface-inverse"),
        },

        // Text.
        ink: {
          DEFAULT: withAlpha("--color-ink"),
          inverse: withAlpha("--color-ink-inverse"),
        },
        muted: withAlpha("--color-muted"),
        subtle: withAlpha("--color-subtle"),
        brand: withAlpha("--color-brand"),

        border: {
          DEFAULT: withAlpha("--color-border"),
          strong: withAlpha("--color-border-strong"),
        },

        // Status. Each keeps its own hue, distinct from primary and accent, so a status color is
        // never mistaken for brand color.
        success: withAlpha("--color-success"),
        warning: withAlpha("--color-warning"),
        danger: withAlpha("--color-danger"),
        info: withAlpha("--color-info"),

        // Retained so existing dark-surface markup keeps working. Prefer surface-inverse.
        night: {
          DEFAULT: "#12302B",
          deep: "#0B211D",
        },

        // Foreground for surfaces that are dark in BOTH themes: the staff sidebar, the public
        // footer, a saturated brand fill. Deliberately a fixed value rather than a var, because
        // the whole point is that it does not invert.
        //
        // `paper` cannot serve here. It is a surface token, so it flips to near-black in dark
        // mode, and `text-paper` on a fixed dark surface then renders dark on dark.
        "on-dark": "#F7F9F8",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        heading: ["Archivo", "sans-serif"],
        body: ["Public Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      // Elevation is a token, not an ad-hoc shadow, so a raised element reads the same everywhere.
      // Dark themes cannot express elevation with shadow alone, so index.css swaps these for
      // higher-contrast values rather than relying on a black shadow no one can see.
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        raised: "var(--shadow-raised)",
        overlay: "var(--shadow-overlay)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
