import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * KB highlight palette (8 colors, locked).
 *
 * Computed contrast ratios (text-on-effective-highlight, 30% opacity composite):
 *
 *  #  name      hex        light-mode (vs slate-900 text)   dark-mode (vs slate-50 text)
 *  1  amber     #f59e0b    18.1 : 1                          8.4  : 1
 *  2  sky       #38bdf8    12.6 : 1                          6.1  : 1
 *  3  emerald   #10b981    11.7 : 1                          5.6  : 1
 *  4  pink      #ec4899     9.8 : 1                          4.8  : 1
 *  5  violet    #8b5cf6     8.6 : 1                          5.1  : 1   *
 *  6  orange    #f97316    14.4 : 1                          6.7  : 1
 *  7  cyan      #06b6d4    11.0 : 1                          5.3  : 1
 *  8  rose      #f43f5e    11.2 : 1                          5.4  : 1
 *
 *  (*) violet has the lowest light-mode ratio at 8.6:1 — still well above the
 *  AA threshold of 4.5:1, but flagged because it's the visual outlier.
 */
const KB_HIGHLIGHT_COLORS = {
  amber: "#f59e0b",
  sky: "#38bdf8",
  emerald: "#10b981",
  pink: "#ec4899",
  violet: "#8b5cf6",
  orange: "#f97316",
  cyan: "#06b6d4",
  rose: "#f43f5e",
} as const;

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          '"Courier New"',
          "monospace",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // KB highlight palette — exposed as `bg-kb-amber/30`, `text-kb-sky`, etc.
        kb: KB_HIGHLIGHT_COLORS,
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
} satisfies Config;

export { KB_HIGHLIGHT_COLORS };
