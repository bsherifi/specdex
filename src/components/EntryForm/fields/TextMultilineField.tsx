import type { JSX } from "react";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | undefined;
}

export function TextMultilineField({ label, value, onChange, required, error }: Props): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>
        {label}
        {required && <span className="text-destructive">*</span>}
      </span>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}
