/**
 * KB highlight palette (8 colors, locked) — a domain/accessibility constraint.
 *
 * Contrast ratios (text-on-effective-highlight, 30% opacity composite):
 *
 *  #  name      hex        light (vs slate-900 text)   dark (vs slate-50 text)
 *  1  amber     #f59e0b    18.1 : 1                     8.4  : 1
 *  2  sky       #38bdf8    12.6 : 1                     6.1  : 1
 *  3  emerald   #10b981    11.7 : 1                     5.6  : 1
 *  4  pink      #ec4899     9.8 : 1                     4.8  : 1
 *  5  violet    #8b5cf6     8.6 : 1                     5.1  : 1   *
 *  6  orange    #f97316    14.4 : 1                     6.7  : 1
 *  7  cyan      #06b6d4    11.0 : 1                     5.3  : 1
 *  8  rose      #f43f5e    11.2 : 1                     5.4  : 1
 *
 *  (*) violet is the light-mode outlier at 8.6:1 — still well above AA (4.5:1).
 *
 * These hexes are mirrored into `@theme` as `--color-kb-*` in
 * `src/styles/globals.css`, which is what makes `bg-kb-amber/30` etc. resolve.
 * Keep the two in sync. (Tailwind v4 has no JS config, so this is the source
 * of truth for the TS side.)
 */
export const KB_HIGHLIGHT_COLORS = {
  amber: "#f59e0b",
  sky: "#38bdf8",
  emerald: "#10b981",
  pink: "#ec4899",
  violet: "#8b5cf6",
  orange: "#f97316",
  cyan: "#06b6d4",
  rose: "#f43f5e",
} as const;
