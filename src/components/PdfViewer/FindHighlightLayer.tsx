import type { JSX } from "react";
import type { FindMatch } from "./types";

interface Props {
  matches: FindMatch[]; // full list (global indices preserved)
  page: number;
  scale: number;
  activeIndex: number | null; // global index of the focused match
}

/**
 * Renders find-in-document hits as bordered boxes (no fill) so they read as
 * transient "search" results, visually distinct from KB highlights (which are
 * soft color fills). The active hit gets a bright animated ring.
 */
export function FindHighlightLayer({ matches, page, scale, activeIndex }: Props): JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0">
      {matches.map((m, i) => {
        if (m.page !== page) return null;
        const active = i === activeIndex;
        return (
          <div
            key={`${i}-${m.start_offset}`}
            className={active ? "absolute rounded-[2px] animate-pulse" : "absolute rounded-[2px]"}
            style={{
              left: m.bbox.x * scale - 1,
              top: m.bbox.y * scale - 1,
              width: m.bbox.w * scale + 2,
              height: m.bbox.h * scale + 2,
              border: active ? "2px solid #ea580c" : "1.5px solid #ca8a04",
              boxShadow: active ? "0 0 0 3px rgba(234,88,12,0.35)" : "none",
              backgroundColor: active ? "rgba(251,146,60,0.12)" : "transparent",
            }}
            data-find-index={i}
          />
        );
      })}
    </div>
  );
}
