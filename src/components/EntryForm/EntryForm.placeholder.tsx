import type { JSX } from "react";

interface Props {
  kbId: string;
  initialData?: Record<string, unknown>;
  initialSource?: unknown;
  onSaved: (entryId: string) => void;
  onCancel: () => void;
}

/// Placeholder — replaced by plan 27. Keeps KbDetail compileable.
export function EntryFormPlaceholder({ onCancel }: Props): JSX.Element {
  return (
    <div className="p-4">
      <p className="text-muted-foreground">EntryForm is added by plan 27.</p>
      <button onClick={onCancel} className="mt-2 underline">Close</button>
    </div>
  );
}
