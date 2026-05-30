import { useEffect, useState } from "react";
import type { JSX, ReactNode } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  onFiles: (paths: string[]) => void;
  children: ReactNode;
  className?: string;
}

export function FileDropZone({ onFiles, children, className }: FileDropZoneProps): JSX.Element {
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const webview = getCurrentWebview();
    const unlistenPromise = webview.onDragDropEvent((event) => {
      // Narrow on `event.payload.type` directly: `paths` only exists on the
      // `enter`/`drop` variants of Tauri's DragDropEvent union.
      const payload = event.payload;
      if (payload.type === "enter" || payload.type === "over") setIsOver(true);
      else if (payload.type === "leave") setIsOver(false);
      else if (payload.type === "drop") {
        setIsOver(false);
        onFiles(payload.paths);
      }
    });
    return () => {
      void unlistenPromise.then((f) => f());
    };
  }, [onFiles]);

  return (
    <div
      className={cn(
        "rounded-xl transition-shadow data-[drop-over=true]:ring-2 data-[drop-over=true]:ring-ring data-[drop-over=true]:ring-offset-2 data-[drop-over=true]:ring-offset-background",
        className,
      )}
      data-drop-over={isOver}
    >
      {children}
    </div>
  );
}
