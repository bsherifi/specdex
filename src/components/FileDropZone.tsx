import { useEffect, useState } from "react";
import type { JSX, ReactNode } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

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
      className={className}
      data-drop-over={isOver}
      style={{
        outline: isOver ? "2px dashed hsl(var(--ring))" : undefined,
      }}
    >
      {children}
    </div>
  );
}
