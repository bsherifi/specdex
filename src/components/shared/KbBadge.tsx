import type { JSX } from "react";
import type { KbColorName } from "@/lib/theme";
import { KB_COLOR_HEX } from "@/lib/theme";
import { cn } from "@/lib/utils";

export interface KbBadgeProps {
  name: string;
  color: KbColorName;
  className?: string;
}

export function KbBadge({ name, color, className }: KbBadgeProps): JSX.Element {
  const hex = KB_COLOR_HEX[color];
  return (
    <span
      data-kb-color={color}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        "border border-border/60 bg-muted/50 text-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: hex }}
      />
      {name}
    </span>
  );
}
