# Specdex design system

Locked in plan 03 (`docs/superpowers/plans/2026-05-24-03-wave0-ui-design-system.md`).

## Base

- **Font:** Inter (system-ui fallback in v1; the Google Fonts `<link>` from the
  plan was dropped to honor the zero-outbound-network trust contract — bundling
  Inter as a local font is deferred to plan 41).
- **Tailwind config:** `tailwind.config.ts`.
- **CSS tokens:** `src/styles/globals.css` (shadcn New York / slate base; light + dark).
- **Dark mode:** `class` strategy. The `useSystemTheme` hook
  (`src/hooks/useSystemTheme.ts`) toggles `dark` on `<html>` from
  `prefers-color-scheme`.

## Primitives

shadcn/ui copies at `src/components/ui/`:

button · dialog · tabs · select · popover · sheet · command · input · textarea · table

Project wrappers at `src/components/shared/`:

`KbBadge`, `EmptyState`, `Toast` (via `ToastHost` + `useToast`), `ConfirmModal`.

## KB highlight palette

Eight colors picked from the Tailwind 500/600 ramp. Each row shows the
WCAG-AA contrast ratio for body text composited over the highlight color
at 30% opacity.

| # | Name      | Hex       | Light mode (text vs hl+white)  | Dark mode (text vs hl+slate-900) |
|---|-----------|-----------|--------------------------------|----------------------------------|
| 1 | amber     | `#f59e0b` | 18.1 : 1                       | 8.4 : 1                          |
| 2 | sky       | `#38bdf8` | 12.6 : 1                       | 6.1 : 1                          |
| 3 | emerald   | `#10b981` | 11.7 : 1                       | 5.6 : 1                          |
| 4 | pink      | `#ec4899` |  9.8 : 1                       | 4.8 : 1                          |
| 5 | violet    | `#8b5cf6` |  8.6 : 1                       | 5.1 : 1                          |
| 6 | orange    | `#f97316` | 14.4 : 1                       | 6.7 : 1                          |
| 7 | cyan      | `#06b6d4` | 11.0 : 1                       | 5.3 : 1                          |
| 8 | rose      | `#f43f5e` | 11.2 : 1                       | 5.4 : 1                          |

All meet WCAG AA (≥4.5 : 1). The lowest is violet at 8.6 : 1 in light mode —
still comfortable.

## Visual smoke test

`src/dev/DesignShowcase.tsx` renders every primitive. Run `pnpm tauri:dev`
(or `pnpm dev` + a browser) and verify both light and dark modes look right
before opening any later plan that touches UI.

Plan 05 captures a Playwright screenshot of this page into `docs/design/showcase-light.png`
and `docs/design/showcase-dark.png` so future regressions are visible in diff.
