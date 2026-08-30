/**
 * Props to spread onto a recharts `<Tooltip>` so its floating box follows the theme.
 *
 * Recharts styles the tooltip inline, with a white background and near-black text, and nothing in
 * a stylesheet reaches it. Left alone it is a white card floating over a dark page, so the values
 * a reader hovers for are the one part of a chart that ignores dark mode.
 *
 * Exported as props rather than as a component because recharts identifies `Tooltip` by looking at
 * the element type of its children: a wrapper component that renders one is simply not found.
 *
 * The tokens are RGB triples, which is what lets them compose with an alpha channel elsewhere, so
 * they are read here through `rgb(...)` rather than used directly.
 */
export const chartTooltipProps = {
  contentStyle: {
    background: 'rgb(var(--color-surface))',
    border: '1px solid rgb(var(--color-border-strong))',
    borderRadius: '0.75rem',
    boxShadow: 'var(--shadow-raised)',
    color: 'rgb(var(--color-ink))',
  },
  labelStyle: { color: 'rgb(var(--color-muted))' },
  itemStyle: { color: 'rgb(var(--color-ink))' },
} as const

/** Shared axis tick styling. `currentColor` inherits the text colour the container sets. */
export const chartAxisProps = {
  tick: { fontSize: 12, fill: 'currentColor' },
  axisLine: false,
  tickLine: false,
} as const
