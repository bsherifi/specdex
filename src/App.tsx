import type { JSX } from "react";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { Toaster } from "@/components/ui/sonner";
import { IngestQueuePanel, PreIngestDialog } from "@/components/IngestQueue";
import { subscribeToSpecdexEvents } from "@/lib/events";

export function App(): JSX.Element {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void subscribeToSpecdexEvents().then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);
  return (
    <>
      <RouterProvider router={router} />
      <PreIngestDialog />
      <IngestQueuePanel />
      <Toaster richColors closeButton />
    </>
  );
}
