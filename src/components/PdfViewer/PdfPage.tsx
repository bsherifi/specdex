import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { HighlightLayer } from "./HighlightLayer";
import type { KbColorMap, Match, SelectionCapture } from "./types";

interface Props {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  matches: Match[];
  kbColor: KbColorMap;
  onHoverMatch: (m: Match | null) => void;
  onSelection: (
    capture: SelectionCapture | null,
    anchor: { x: number; y: number } | null,
  ) => void;
}

export function PdfPage({
  doc,
  pageNumber,
  scale,
  matches,
  kbColor,
  onHoverMatch,
  onSelection,
}: Props): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0, pdfH: 0 });

  useEffect(() => {
    let cancelled = false;
    void doc.getPage(pageNumber).then((p) => {
      if (cancelled) return;
      setPage(p);
    });
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber]);

  useEffect(() => {
    if (!page || !canvasRef.current) return;
    const viewport = page.getViewport({ scale });
    setSize({ w: viewport.width, h: viewport.height, pdfH: viewport.viewBox[3] ?? 0 });
    const canvas = canvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const task = page.render({ canvasContext: ctx, viewport });
    void task.promise.catch(() => {});

    // Text layer
    if (textLayerRef.current) {
      textLayerRef.current.innerHTML = "";
      textLayerRef.current.style.width = `${viewport.width}px`;
      textLayerRef.current.style.height = `${viewport.height}px`;
      // Use pdf.js's text-layer renderer:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void import("pdfjs-dist/legacy/build/pdf.mjs").then((mod: any) => {
        void page.getTextContent().then((tc) => {
          const TextLayerBuilder = mod.TextLayer ?? mod.renderTextLayer;
          if (!TextLayerBuilder) return;
          if (TextLayerBuilder.prototype && TextLayerBuilder.prototype.render) {
            const tl = new TextLayerBuilder({
              textContentSource: tc,
              container: textLayerRef.current,
              viewport,
            });
            void tl.render();
          } else {
            // renderTextLayer-style API
            TextLayerBuilder({
              textContent: tc,
              container: textLayerRef.current,
              viewport,
              textDivs: [],
            });
          }
        });
      });
    }
    return () => task.cancel();
  }, [page, scale]);

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      onSelection(null, null);
      return;
    }
    const text = selection.toString().trim();
    if (!text) {
      onSelection(null, null);
      return;
    }
    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    if (rects.length === 0) {
      onSelection(null, null);
      return;
    }
    const containerRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    // Compute union of rects in viewport-relative pixels, then convert to PDF points.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < rects.length; i++) {
      const r = rects.item(i);
      if (!r) continue;
      minX = Math.min(minX, r.left - containerRect.left);
      minY = Math.min(minY, r.top - containerRect.top);
      maxX = Math.max(maxX, r.right - containerRect.left);
      maxY = Math.max(maxY, r.bottom - containerRect.top);
    }
    const bbox = {
      x: minX / scale,
      y: minY / scale,
      w: (maxX - minX) / scale,
      h: (maxY - minY) / scale,
    };
    const anchor = { x: maxX, y: maxY };
    onSelection({ text, page: pageNumber, bbox }, anchor);
  };

  return (
    <div
      data-page-number={pageNumber}
      className="relative mx-auto my-4 border border-border bg-card shadow"
      style={{ width: size.w, height: size.h }}
      onMouseUp={handleMouseUp}
    >
      <canvas ref={canvasRef} />
      <div
        ref={textLayerRef}
        className="absolute inset-0 text-transparent"
        style={{
          // Selection-friendly: keep the text positioned but invisible (pdf.js's renderTextLayer styles this).
          userSelect: "text",
        }}
      />
      <HighlightLayer
        matches={matches}
        page={pageNumber}
        scale={scale}
        pageHeightPdfPoints={size.pdfH}
        kbColor={kbColor}
        onHover={onHoverMatch}
      />
    </div>
  );
}
