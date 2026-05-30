import type { JSX } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./Field";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | undefined;
}

export function TextMultilineField({ label, value, onChange, required, error }: Props): JSX.Element {
  return (
    <Field label={label} required={required} error={error}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
      />
    </Field>
  );
}
