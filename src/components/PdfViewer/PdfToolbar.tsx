import { useEffect, useState, type JSX } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScopeDropdown } from "./ScopeDropdown";
import type { KbScope } from "./types";
import type { ZoomMode } from "./fit";

interface Props {
  numPages: number;
  currentPage: number;
  onJump: (page: number) => void;
  scalePct: number;
  zoomKind: ZoomMode["kind"];
  onSetZoom: (mode: ZoomMode) => void;
  onZoomDelta: (delta: number) => void;
  kbs: { id: string; name: string; highlight_color: string }[];
  scope: KbScope;
  onScope: (s: KbScope) => void;
  onToggleFind: () => void;
}

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export function PdfToolbar({
  numPages,
  currentPage,
  onJump,
  scalePct,
  zoomKind,
  onSetZoom,
  onZoomDelta,
  kbs,
  scope,
  onScope,
  onToggleFind,
}: Props): JSX.Element {
  const [draft, setDraft] = useState(String(currentPage));
  useEffect(() => setDraft(String(currentPage)), [currentPage]);

  const zoomValue = zoomKind === "scale" ? "scale" : zoomKind;
  const submitJump = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 1 && n <= numPages) onJump(Math.floor(n));
    else setDraft(String(currentPage));
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => onJump(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          title="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="flex items-center gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submitJump}
            onKeyDown={(e) => e.key === "Enter" && submitJump()}
            className="h-7 w-10 rounded-md border border-input bg-background text-center text-sm"
            aria-label="Page number"
          />
          <span>/ {numPages}</span>
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => onJump(Math.min(numPages, currentPage + 1))}
          disabled={currentPage >= numPages}
          title="Next page"
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="ghost" onClick={() => onZoomDelta(-0.2)} title="Zoom out">
          <Minus />
        </Button>
        <select
          value={zoomValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "fit-width") onSetZoom({ kind: "fit-width" });
            else if (v === "fit-page") onSetZoom({ kind: "fit-page" });
            else onSetZoom({ kind: "scale", value: Number(v) });
          }}
          className="h-7 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Zoom"
        >
          <option value="fit-width">Fit width</option>
          <option value="fit-page">Fit page</option>
          {zoomKind === "scale" && !ZOOM_PRESETS.includes(scalePct / 100) && (
            <option value="scale">{scalePct}%</option>
          )}
          {ZOOM_PRESETS.map((z) => (
            <option key={z} value={z}>
              {Math.round(z * 100)}%
            </option>
          ))}
        </select>
        <Button size="icon-sm" variant="ghost" onClick={() => onZoomDelta(0.2)} title="Zoom in">
          <Plus />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onToggleFind} title="Find in document (⌘F)">
          <Search />
        </Button>
        <ScopeDropdown kbs={kbs} value={scope} onChange={onScope} />
      </div>
    </div>
  );
}
