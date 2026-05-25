import type { JSX } from "react";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { ToastHost } from "@/components/shared";
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
    <ToastHost>
      <RouterProvider router={router} />
      <PreIngestDialog />
      <IngestQueuePanel />
    </ToastHost>
  );
}
