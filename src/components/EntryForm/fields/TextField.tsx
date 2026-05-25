import type { JSX } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "./Field";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | undefined;
}

export function TextField({ label, value, onChange, required, error }: Props): JSX.Element {
  return (
    <Field label={label} required={required} error={error}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
      />
    </Field>
  );
}
