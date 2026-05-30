import type { JSX } from "react";
import { KB_COLOR_HEX, KB_COLOR_NAMES, type KbColorName } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface Props {
  value: KbColorName;
  onChange: (next: KbColorName) => void;
}

export function KbColorPicker({ value, onChange }: Props): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {KB_COLOR_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          aria-pressed={value === name}
          className={cn(
            "size-7 rounded-full outline-none ring-offset-2 ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-ring",
            value === name && "ring-2 ring-foreground",
          )}
          style={{ backgroundColor: KB_COLOR_HEX[name] }}
          aria-label={`Pick color ${name}`}
        />
      ))}
    </div>
  );
}
