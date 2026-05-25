import type { JSX } from "react";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { ToastHost } from "@/components/shared";
import { useSystemTheme } from "@/hooks/useSystemTheme";
import { subscribeToSpecdexEvents } from "@/lib/events";

export function App(): JSX.Element {
  useSystemTheme();
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
    </ToastHost>
  );
}
