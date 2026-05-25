import type { JSX } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | undefined;
}

export function DateField({ label, value, onChange, required, error }: Props): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>
        {label}
        {required && <span className="text-destructive">*</span>}
      </span>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}
