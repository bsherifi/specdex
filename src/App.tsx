import type { JSX } from "react";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { subscribeToSpecdexEvents } from "@/lib/events";

export function App(): JSX.Element {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void subscribeToSpecdexEvents().then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);
  // NOTE: the ingest overlays (PreIngestDialog/IngestQueuePanel) render inside
  // the router via Layout, not here — they use <Link>/navigate and would crash
  // outside the RouterProvider context.
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Toaster richColors closeButton />
    </ErrorBoundary>
  );
}
