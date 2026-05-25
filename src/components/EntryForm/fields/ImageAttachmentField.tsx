import type { JSX } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  label: string;
  value: string; // relative path under attachments/
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | undefined;
}

/// v1 stores the relative attachment path as the field value. The actual
/// upload UI is deferred to v1.1; for v1 the user types or pastes a path.
/// (The Tauri dialog API can be added in a follow-up if user feedback warrants.)
export function ImageAttachmentField({ label, value, onChange, required, error }: Props): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>
        {label}
        {required && <span className="text-destructive">*</span>}
      </span>
      <Input
        placeholder="attachments/diagram.png"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}
