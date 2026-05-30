import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { PdfPageView } from "./PdfPageView";
import { PdfToolbar } from "./PdfToolbar";
import { FindBar } from "./FindBar";
import { NewEntryPanel } from "./NewEntryPanel";
import { usePdf } from "./usePdf";
import { resolveScale, type ZoomMode } from "./fit";
import { stepIndex } from "./find-nav";
import type { FindMatch, KbColorMap, KbScope, Match, SelectionCapture } from "./types";
import {
  scanDocument,
  sourceDocResolvePath,
  kbListSummaries,
  findInDocument,
  unwrap,
} from "@/lib/tauri";
import { useStore } from "@/lib/store";
import { useDebounce } from "@/hooks/useDebounce";
import type { KbColorName } from "@/lib/theme";

interface Props {
  sourceDocId: string;
  onOpenEntry: (entryId: string, kbId: string) => void;
}

type Kb = { id: string; name: string; highlight_color: string };

const PADDING = 40; // horizontal breathing room for fit-to-width
const PANEL_W = 400; // width of the New-entry drawer (keep in sync with NewEntryPanel)

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

export function PdfViewer({ sourceDocId, onOpenEntry }: Props): JSX.Element {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [kbs, setKbs] = useState<Kb[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [zoomMode, setZoomMode] = useState<ZoomMode>({ kind: "fit-width" });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [selection, setSelection] = useState<SelectionCapture | null>(null);
  const [chipScreen, setChipScreen] = useState<{ x: number; y: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findMatches, setFindMatches] = useState<FindMatch[]>([]);
  const [activeFind, setActiveFind] = useState<number | null>(null);
  const debouncedQuery = useDebounce(findQuery, 200);

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const stored = useStore((s) => s.scopeByDoc[sourceDocId]);
  const setDocScope = useStore((s) => s.setDocScope);
  const scope: KbScope = useMemo(
    () => (!stored || stored === "all" ? { kind: "all" } : { kind: "only", kb_id: stored.kbId }),
    [stored],
  );

  // Load URL + KBs.
  useEffect(() => {
    void sourceDocResolvePath(sourceDocId).then((p) => setPdfUrl(convertFileSrc(unwrap<string>(p))));
    void kbListSummaries().then((res) => setKbs(unwrap<Kb[]>(res)));
  }, [sourceDocId]);

  // Scan for known codes when doc/scope changes (and re-run after a new entry).
  const runScan = useCallback(() => {
    if (!pdfUrl) return;
    const tauriScope = scope.kind === "all" ? { kind: "all" } : { kind: "only", kb_id: scope.kb_id! };
    void scanDocument(sourceDocId, tauriScope).then((res) => setMatches(unwrap<Match[]>(res)));
  }, [sourceDocId, pdfUrl, scope]);
  useEffect(() => runScan(), [runScan]);

  const { doc, numPages, pageSizes, loading, error } = usePdf(pdfUrl);

  // Track container size for fit-to-width / fit-page.
  useEffect(() => {
    if (!scrollEl) return;
    const ro = new ResizeObserver(() =>
      setContainerSize({ w: scrollEl.clientWidth, h: scrollEl.clientHeight }),
    );
    ro.observe(scrollEl);
    setContainerSize({ w: scrollEl.clientWidth, h: scrollEl.clientHeight });
    return () => ro.disconnect();
  }, [scrollEl]);

  const scale = useMemo(() => {
    const first = pageSizes[0];
    if (!first || containerSize.w === 0) return 1.25;
    // When the drawer is open it reserves PANEL_W on the right; fit modes and
    // centering use the remaining (visible) width so the page stays centered.
    const usableW = containerSize.w - (panelOpen ? PANEL_W : 0);
    return resolveScale(zoomMode, usableW, containerSize.h, first.w, first.h, PADDING);
  }, [zoomMode, containerSize, pageSizes, panelOpen]);

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

  const pageTop = useCallback(
    (idx: number) => {
      const el = pageRefs.current[idx];
      if (!el || !scrollEl) return 0;
      return el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    },
    [scrollEl],
  );

  const jumpToPage = useCallback(
    (n: number) => {
      if (!scrollEl) return;
      scrollEl.scrollTo({ top: pageTop(n - 1) - 8, behavior: "smooth" });
    },
    [scrollEl, pageTop],
  );

  // Current-page indicator from scroll position.
  const onScroll = useCallback(() => {
    if (!scrollEl) return;
    const probe = scrollEl.scrollTop + 80;
    let cur = 1;
    for (let i = 0; i < numPages; i++) {
      if (pageTop(i) <= probe) cur = i + 1;
      else break;
    }
    setCurrentPage(cur);
  }, [scrollEl, numPages, pageTop]);

  // Find-in-document.
  useEffect(() => {
    if (!findOpen || debouncedQuery.trim() === "") {
      setFindMatches([]);
      setActiveFind(null);
      return;
    }
    let cancelled = false;
    void findInDocument(sourceDocId, debouncedQuery).then((res) => {
      if (cancelled) return;
      const hits = unwrap<FindMatch[]>(res);
      setFindMatches(hits);
      setActiveFind(hits.length > 0 ? 0 : null);
    });
    return () => {
      cancelled = true;
    };
  }, [findOpen, debouncedQuery, sourceDocId]);

  // Scroll to the active find match.
  useEffect(() => {
    if (activeFind === null || !scrollEl) return;
    const m = findMatches[activeFind];
    if (!m) return;
    scrollEl.scrollTo({ top: pageTop(m.page - 1) + m.bbox.y * scale - 120, behavior: "smooth" });
  }, [activeFind, findMatches, scrollEl, pageTop, scale]);

  // ⌘F / Ctrl+F toggles the find bar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeFind = () => {
    setFindOpen(false);
    setFindQuery("");
    setFindMatches([]);
    setActiveFind(null);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setSelection(null);
    setChipScreen(null);
  };

  if (error) return <div className="p-6 text-destructive">Couldn&apos;t load PDF: {error}</div>;
  if (loading || !doc) return <div className="p-6">Loading PDF…</div>;

  return (
    <div className="flex h-full flex-col">
      <PdfToolbar
        numPages={numPages}
        currentPage={currentPage}
        onJump={jumpToPage}
        scalePct={Math.round(scale * 100)}
        zoomKind={zoomMode.kind}
        onSetZoom={setZoomMode}
        onZoomDelta={(d) =>
          setZoomMode({ kind: "scale", value: Math.min(3, Math.max(0.25, scale + d)) })
        }
        kbs={kbs}
        scope={scope}
        onScope={(s) => setDocScope(sourceDocId, s.kind === "all" ? "all" : { kbId: s.kb_id! })}
        onToggleFind={() => setFindOpen((o) => !o)}
      />
      <div className="relative flex flex-1 overflow-hidden">
        <div
          ref={setScrollEl}
          onScroll={onScroll}
          className="relative flex-1 overflow-auto bg-muted/30"
          style={{ scrollbarGutter: "stable", paddingRight: panelOpen ? PANEL_W : 0 }}
        >
          {findOpen && (
            <FindBar
              query={findQuery}
              onQuery={setFindQuery}
              count={findMatches.length}
              activeIndex={activeFind}
              onPrev={() => setActiveFind((cur) => stepIndex(cur, findMatches.length, -1))}
              onNext={() => setActiveFind((cur) => stepIndex(cur, findMatches.length, 1))}
              onClose={closeFind}
            />
          )}
          {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => {
            const sz = pageSizes[p - 1] ?? { w: 612, h: 792 };
            return (
              <PdfPageView
                key={p}
                doc={doc}
                pageNumber={p}
                scale={scale}
                baseWidth={sz.w}
                baseHeight={sz.h}
                matches={matches}
                findMatches={findMatches}
                activeFindIndex={activeFind}
                kbColor={kbColor}
                scrollRoot={scrollEl}
                onOpenEntry={onOpenEntry}
                onSelect={(cap, anchor) => {
                  if (panelOpen) return;
                  setSelection(cap);
                  setChipScreen(anchor);
                }}
                pageRef={(el) => {
                  pageRefs.current[p - 1] = el;
                }}
              />
            );
          })}
        </div>
        {panelOpen && selection && (
          // Overlay drawer (absolute, out of flow) so opening it does NOT
          // resize the scroll area — that resize was recomputing fit-width and
          // re-rasterizing every page, which caused the laggy open.
          <div className="absolute right-0 top-0 z-20 h-full">
            <NewEntryPanel
              kbs={kbs}
              defaultKbId={scope.kind === "only" ? scope.kb_id! : null}
              capture={{ ...selection, source_doc_id: sourceDocId }}
              onClose={closePanel}
              onSaved={() => {
                runScan();
                closePanel();
              }}
            />
          </div>
        )}
      </div>
      {selection && chipScreen && !panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          style={{
            position: "fixed",
            left: Math.min(chipScreen.x + 6, window.innerWidth - 150),
            top: Math.max(8, chipScreen.y - 4),
            zIndex: 50,
          }}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-popover px-3 py-1 text-xs font-medium shadow-md hover:bg-accent"
        >
          + New entry
        </button>
      )}
    </div>
  );
}
