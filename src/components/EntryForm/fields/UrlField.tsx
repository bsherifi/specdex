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

export function UrlField({ label, value, onChange, required, error }: Props): JSX.Element {
  return (
    <Field label={label} required={required} error={error}>
      <Input
        type="url"
        placeholder="https://…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
      />
      {value && /^https?:\/\//i.test(value) && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="truncate text-xs text-primary underline-offset-4 hover:underline"
        >
          {value}
        </a>
      )}
    </Field>
  );
}
