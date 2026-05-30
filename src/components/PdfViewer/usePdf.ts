import { useEffect, useState } from "react";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.mjs?worker&url";

// Configure pdf.js worker once.
(pdfjs.GlobalWorkerOptions as { workerSrc: string }).workerSrc = workerSrc;

type PdfDoc = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;

export interface PageSize {
  w: number; // page width in PDF points (== CSS px at scale 1)
  h: number;
}

interface UsePdfResult {
  doc: PdfDoc | null;
  numPages: number;
  /** Per-page dimensions at scale 1, used to size placeholders for virtualization. */
  pageSizes: PageSize[];
  loading: boolean;
  error: string | null;
}

export function usePdf(url: string | null): UsePdfResult {
  const [state, setState] = useState<UsePdfResult>({
    doc: null,
    numPages: 0,
    pageSizes: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    const task = pdfjs.getDocument({ url, isEvalSupported: false });
    task.promise
      .then(async (doc) => {
        if (cancelled) return;
        // Measure every page once so placeholders reserve correct height and
        // scroll position stays stable while pages lazily rasterize.
        const sizes: PageSize[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const p = await doc.getPage(i);
          if (cancelled) return;
          const vp = p.getViewport({ scale: 1 });
          sizes.push({ w: vp.width, h: vp.height });
        }
        if (cancelled) return;
        setState({ doc, numPages: doc.numPages, pageSizes: sizes, loading: false, error: null });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ doc: null, numPages: 0, pageSizes: [], loading: false, error: String(e) });
      });
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [url]);

  return state;
}
