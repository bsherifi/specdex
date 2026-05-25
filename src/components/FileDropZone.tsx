import { useEffect, useRef, useState } from "react";
import type { JSX, ReactNode } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

interface FileDropZoneProps {
  onFiles: (paths: string[]) => void;
  children: ReactNode;
  className?: string;
}

export function FileDropZone({ onFiles, children, className }: FileDropZoneProps): JSX.Element {
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const onBrowse = () => inputRef.current?.click();

  return (
    <div
      className={className}
      data-drop-over={isOver}
      onClick={onBrowse}
      style={{
        outline: isOver ? "2px dashed hsl(var(--ring))" : undefined,
        cursor: "pointer",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          // Browser File API loses the path; this fallback only works in
          // dev (Tauri's drop-event is the production path). We emit empty
          // for now and rely on the message below.
          const files = Array.from(e.target.files ?? []);
          if (files.length === 0) return;
          alert("Drag-and-drop PDFs onto the window — browse-mode is dev-only.");
        }}
      />
      {children}
    </div>
  );
}
