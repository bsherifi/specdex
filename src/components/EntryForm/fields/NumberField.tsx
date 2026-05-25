import type { JSX } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  required?: boolean;
  error?: string | undefined;
}

export function NumberField({ label, value, onChange, required, error }: Props): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>
        {label}
        {required && <span className="text-destructive">*</span>}
      </span>
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}
