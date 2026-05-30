import { useEffect, useRef, useState, type JSX } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { HighlightLayer } from "./HighlightLayer";
import { FindHighlightLayer } from "./FindHighlightLayer";
import { TextSelectionLayer } from "./TextSelectionLayer";
import type { FindMatch, KbColorMap, Match, SelectionCapture } from "./types";

interface Props {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  baseWidth: number; // page width at scale 1 (PDF points)
  baseHeight: number;
  matches: Match[];
  findMatches: FindMatch[];
  activeFindIndex: number | null;
  kbColor: KbColorMap;
  scrollRoot: HTMLElement | null;
  onOpenEntry: (entryId: string, kbId: string) => void;
  onSelect: (capture: SelectionCapture | null, anchor: { x: number; y: number } | null) => void;
  pageRef: (el: HTMLDivElement | null) => void;
}

export function PdfPageView({
  doc,
  pageNumber,
  scale,
  baseWidth,
  baseHeight,
  matches,
  findMatches,
  activeFindIndex,
  kbColor,
  scrollRoot,
  onOpenEntry,
  onSelect,
  pageRef,
}: Props): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [visible, setVisible] = useState(false);

  const cssW = Math.floor(baseWidth * scale);
  const cssH = Math.floor(baseHeight * scale);

  // Virtualization: only rasterize pages near the viewport.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !scrollRoot) return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { root: scrollRoot, rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot]);

  // Load the page object the first time it comes near the viewport.
  useEffect(() => {
    if (!visible || page) return;
    let cancelled = false;
    void doc.getPage(pageNumber).then((p) => {
      if (!cancelled) setPage(p);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, page, doc, pageNumber]);

  // Render the canvas at devicePixelRatio for crisp output on HiDPI displays.
  useEffect(() => {
    if (!visible || !page || !canvasRef.current) return;
    const viewport = page.getViewport({ scale });
    // Cap the effective resolution so high zoom doesn't blow up memory.
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3 / scale));
    const canvas = canvasRef.current;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const task = page.render({
      canvasContext: ctx,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    });
    void task.promise.catch(() => {});
    return () => task.cancel();
  }, [visible, page, scale]);

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return onSelect(null, null);
    const text = sel.toString().trim();
    if (!text) return onSelect(null, null);
    const range = sel.getRangeAt(0);
    const rects = range.getClientRects();
    if (rects.length === 0) return onSelect(null, null);
    const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let screenRight = -Infinity; // viewport coords, for the trigger chip
    let screenTop = Infinity;
    for (let i = 0; i < rects.length; i++) {
      const r = rects.item(i);
      if (!r) continue;
      minX = Math.min(minX, r.left - box.left);
      minY = Math.min(minY, r.top - box.top);
      maxX = Math.max(maxX, r.right - box.left);
      maxY = Math.max(maxY, r.bottom - box.top);
      screenRight = Math.max(screenRight, r.right);
      screenTop = Math.min(screenTop, r.top);
    }
    const bbox = {
      x: minX / scale,
      y: minY / scale,
      w: (maxX - minX) / scale,
      h: (maxY - minY) / scale,
    };
    // Anchor the chip just past the selection's top-right, in viewport (fixed)
    // coordinates, so it never overlaps the selected text.
    onSelect({ text, page: pageNumber, bbox }, { x: screenRight, y: screenTop });
  };

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
        pageRef(el);
      }}
      data-page-number={pageNumber}
      className="relative mx-auto my-4 border border-border bg-card shadow"
      style={{ width: cssW, height: cssH }}
      onMouseUp={handleMouseUp}
    >
      {visible && page ? (
        <>
          <canvas ref={canvasRef} className="absolute left-0 top-0" />
          <TextSelectionLayer page={page} scale={scale} />
          <HighlightLayer
            matches={matches}
            page={pageNumber}
            scale={scale}
            kbColor={kbColor}
            onOpenEntry={onOpenEntry}
          />
          <FindHighlightLayer
            matches={findMatches}
            page={pageNumber}
            scale={scale}
            activeIndex={activeFindIndex}
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
          {pageNumber}
        </div>
      )}
    </div>
  );
}
