import type { JSX } from "react";
import type { Match, KbColorMap } from "./types";

interface Props {
  matches: Match[];
  page: number;
  scale: number; // pdf.js scale used to render
  pageHeightPdfPoints: number;
  kbColor: KbColorMap;
  onHover: (m: Match | null) => void;
}

export function HighlightLayer({
  matches,
  page,
  scale,
  kbColor,
  onHover,
}: Props): JSX.Element {
  const pageMatches = matches.filter((m) => m.page === page);
  return (
    <div className="pointer-events-none absolute inset-0">
      {pageMatches.map((m, i) => {
        const left = m.bbox.x * scale;
        const top = m.bbox.y * scale;
        const width = m.bbox.w * scale;
        const height = m.bbox.h * scale;
        const hex = kbColor[m.kb_id]?.hex ?? "#f59e0b";
        return (
          <div
            key={`${m.entry_id}-${i}`}
            className="pointer-events-auto absolute rounded-sm"
            style={{
              left,
              top,
              width,
              height,
              backgroundColor: hex,
              opacity: 0.3,
              mixBlendMode: "multiply",
              cursor: "pointer",
            }}
            onMouseEnter={() => onHover(m)}
            onMouseLeave={() => onHover(null)}
            data-entry-id={m.entry_id}
            data-kb-id={m.kb_id}
            title={m.matched_text}
          />
        );
      })}
    </div>
  );
}
