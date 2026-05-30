import { useEffect, useRef, type JSX } from "react";
import { TextLayer } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFPageProxy } from "pdfjs-dist";

interface Props {
  page: PDFPageProxy;
  scale: number;
}

/**
 * Renders pdf.js's official text layer over the canvas so the browser's native
 * text selection lines up pixel-perfectly. The `.textLayer` class (from
 * pdfjs-dist's bundled CSS) positions the spans using the `--scale-factor`
 * custom property — the piece the old hand-rolled layer was missing.
 */
export function TextSelectionLayer({ page, scale }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const div = ref.current;
    if (!div) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let layer: any = null;
    div.replaceChildren();
    div.style.setProperty("--scale-factor", String(scale));
    const viewport = page.getViewport({ scale });
    void page.getTextContent().then((tc) => {
      if (cancelled || !ref.current) return;
      layer = new TextLayer({ textContentSource: tc, container: div, viewport });
      void layer.render();
    });
    return () => {
      cancelled = true;
      layer?.cancel?.();
      div.replaceChildren();
    };
  }, [page, scale]);

  return <div ref={ref} className="textLayer absolute left-0 top-0" />;
}
