import type { JSX } from "react";
import { EntryHoverCard } from "./EntryHoverCard";
import type { Match, KbColorMap } from "./types";

interface Props {
  matches: Match[];
  page: number;
  scale: number; // pdf.js scale used to render
  kbColor: KbColorMap;
  onOpenEntry: (entryId: string, kbId: string) => void;
}

export function HighlightLayer({
  matches,
  page,
  scale,
  kbColor,
  onOpenEntry,
}: Props): JSX.Element {
  const pageMatches = matches.filter((m) => m.page === page);
  return (
    <div className="pointer-events-none absolute inset-0">
      {pageMatches.map((m, i) => {
        const hex = kbColor[m.kb_id]?.hex ?? "#f59e0b";
        return (
          <EntryHoverCard
            key={`${m.entry_id}-${i}`}
            entryId={m.entry_id}
            kbId={m.kb_id}
            hex={hex}
            onOpenEntry={onOpenEntry}
          >
            <button
              type="button"
              className="pointer-events-auto absolute rounded-sm transition-[outline] hover:outline hover:outline-2"
              style={{
                left: m.bbox.x * scale,
                top: m.bbox.y * scale,
                width: m.bbox.w * scale,
                height: m.bbox.h * scale,
                backgroundColor: hex,
                opacity: 0.3,
                mixBlendMode: "multiply",
                cursor: "pointer",
                outlineColor: hex,
              }}
              onClick={() => onOpenEntry(m.entry_id, m.kb_id)}
              data-entry-id={m.entry_id}
              data-kb-id={m.kb_id}
              aria-label={`Open entry for ${m.matched_text}`}
            />
          </EntryHoverCard>
        );
      })}
    </div>
  );
}
