import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { PdfPage } from "./PdfPage";
import { ScopeDropdown } from "./ScopeDropdown";
import { ExtractPopover } from "./ExtractPopover";
import { usePdf } from "./usePdf";
import type { KbColorMap, KbScope, Match, SelectionCapture } from "./types";
import { scanDocument, sourceDocResolvePath, kbListSummaries, unwrap } from "@/lib/tauri";
import { useStore } from "@/lib/store";
import type { KbColorName } from "@/lib/theme";

interface Props {
  sourceDocId: string;
  onCapture: (capture: SelectionCapture) => void;
}

type Kb = { id: string; name: string; highlight_color: string };

function hexToColorName(hex: string): KbColorName | undefined {
  const map: Record<string, KbColorName> = {
    "#f59e0b": "amber",
    "#38bdf8": "sky",
    "#10b981": "emerald",
    "#ec4899": "pink",
    "#8b5cf6": "violet",
    "#f97316": "orange",
    "#06b6d4": "cyan",
    "#f43f5e": "rose",
  };
  return map[hex.toLowerCase()];
}

export function PdfViewer({ sourceDocId, onCapture }: Props): JSX.Element {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1.25);
  const [matches, setMatches] = useState<Match[]>([]);
  const [kbs, setKbs] = useState<Kb[]>([]);
  const [selection, setSelection] = useState<SelectionCapture | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number } | null>(null);
  const stored = useStore((s) => s.scopeByDoc[sourceDocId]);
  const setDocScope = useStore((s) => s.setDocScope);

  // Memoize so the scan effect doesn't re-run (and re-scan) every render.
  const scope: KbScope = useMemo(
    () =>
      !stored || stored === "all" ? { kind: "all" } : { kind: "only", kb_id: stored.kbId },
    [stored],
  );

  // Load url + kbs
  useEffect(() => {
    void sourceDocResolvePath(sourceDocId).then((p) => {
      setPdfUrl(convertFileSrc(unwrap<string>(p)));
    });
    void kbListSummaries().then((res) => setKbs(unwrap<Kb[]>(res)));
  }, [sourceDocId]);

  // Run scan whenever doc or scope changes
  useEffect(() => {
    if (!pdfUrl) return;
    const tauriScope =
      scope.kind === "all" ? { kind: "all" } : { kind: "only", kb_id: scope.kb_id! };
    void scanDocument(sourceDocId, tauriScope).then((res) => setMatches(unwrap<Match[]>(res)));
  }, [sourceDocId, pdfUrl, scope]);

  const { doc, numPages, loading, error } = usePdf(pdfUrl);

  const kbColor: KbColorMap = useMemo(
    () =>
      Object.fromEntries(
        kbs.map((kb) => [
          kb.id,
          { name: kb.name, color: hexToColorName(kb.highlight_color), hex: kb.highlight_color },
        ]),
      ),
    [kbs],
  );

  if (error) return <div className="p-6 text-destructive">Couldn&apos;t load PDF: {error}</div>;
  if (loading || !doc) return <div className="p-6">Loading PDF…</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {numPages} pages
        </div>
        <div className="flex items-center gap-2">
          <button className="text-sm" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}>
            −
          </button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <button className="text-sm" onClick={() => setScale((s) => Math.min(3, s + 0.2))}>
            +
          </button>
          <ScopeDropdown
            kbs={kbs}
            value={scope}
            onChange={(s) =>
              setDocScope(sourceDocId, s.kind === "all" ? "all" : { kbId: s.kb_id! })
            }
          />
        </div>
      </div>
      <div className="relative flex-1 overflow-auto bg-muted/30">
        {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
          <PdfPage
            key={p}
            doc={doc}
            pageNumber={p}
            scale={scale}
            matches={matches}
            kbColor={kbColor}
            onHoverMatch={() => {}}
            onSelection={(cap, anchor) => {
              setSelection(cap);
              setPopoverAnchor(anchor);
            }}
          />
        ))}
        <ExtractPopover
          visible={selection !== null}
          anchor={popoverAnchor}
          onAdd={() => {
            if (selection) onCapture(selection);
            setSelection(null);
            setPopoverAnchor(null);
          }}
          onDismiss={() => {
            setSelection(null);
            setPopoverAnchor(null);
          }}
        />
      </div>
    </div>
  );
}
