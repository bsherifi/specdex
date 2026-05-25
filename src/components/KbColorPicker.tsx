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
          className={cn(
            "h-7 w-7 rounded-full border-2 transition-all",
            value === name ? "border-foreground" : "border-transparent",
          )}
          style={{ backgroundColor: KB_COLOR_HEX[name] }}
          aria-label={`Pick color ${name}`}
        />
      ))}
    </div>
  );
}
