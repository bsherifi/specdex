import type { JSX } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "./Field";

interface Props {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  required?: boolean;
  error?: string | undefined;
}

export function NumberField({ label, value, onChange, required, error }: Props): JSX.Element {
  return (
    <Field label={label} required={required} error={error}>
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        aria-invalid={error ? true : undefined}
      />
    </Field>
  );
}
