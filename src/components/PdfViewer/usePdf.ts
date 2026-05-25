import { useEffect, useState } from "react";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.mjs?worker&url";

// Configure pdf.js worker once.
(pdfjs.GlobalWorkerOptions as { workerSrc: string }).workerSrc = workerSrc;

type PdfDoc = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;

interface UsePdfResult {
  doc: PdfDoc | null;
  numPages: number;
  loading: boolean;
  error: string | null;
}

export function usePdf(url: string | null): UsePdfResult {
  const [state, setState] = useState<UsePdfResult>({
    doc: null,
    numPages: 0,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!url) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const task = pdfjs.getDocument({ url, isEvalSupported: false });
    task.promise
      .then((doc) => {
        setState({ doc, numPages: doc.numPages, loading: false, error: null });
      })
      .catch((e) => {
        setState({ doc: null, numPages: 0, loading: false, error: String(e) });
      });
    return () => {
      void task.destroy();
    };
  }, [url]);

  return state;
}
