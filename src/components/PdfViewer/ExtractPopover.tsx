import type { JSX } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  visible: boolean;
  anchor: { x: number; y: number } | null;
  onAdd: () => void;
  onDismiss: () => void;
}

export function ExtractPopover({
  visible,
  anchor,
  onAdd,
  onDismiss,
}: Props): JSX.Element | null {
  if (!visible || !anchor) return null;
  return (
    <div
      className="absolute z-30 rounded-md border border-border bg-popover p-2 shadow-md"
      style={{ left: anchor.x, top: anchor.y + 8 }}
    >
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onAdd}>
          + Add to KB
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
