import { useState, type JSX } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntryForm } from "@/components/EntryForm";

interface SourceCapture {
  source_doc_id: string;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
  text: string;
}

interface Props {
  kbs: { id: string; name: string; highlight_color: string }[];
  defaultKbId: string | null;
  capture: SourceCapture;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Right-docked panel for creating an entry from a selection without leaving the
 * document. Picks a KB, then renders the full schema-driven EntryForm prefilled
 * with the captured text/source. Docked (not floating) so it never covers the
 * selection or the page.
 */
export function NewEntryPanel({ kbs, defaultKbId, capture, onClose, onSaved }: Props): JSX.Element {
  const [kbId, setKbId] = useState(defaultKbId ?? kbs[0]?.id ?? "");

  return (
    <aside className="flex h-full w-[400px] flex-col border-l border-border bg-background shadow-2xl">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium">New entry</span>
        <Button size="icon-sm" variant="ghost" onClick={onClose} title="Close">
          <X />
        </Button>
      </header>
      <div className="scroll-thin flex-1 space-y-4 overflow-auto p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Knowledge base
          </label>
          {kbs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a knowledge base first.</p>
          ) : (
            <select
              value={kbId}
              onChange={(e) => setKbId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {kbs.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {kbId && (
          // key={kbId} remounts the form (and reloads the schema) on KB change.
          <EntryForm
            key={kbId}
            kbId={kbId}
            initialCapture={capture}
            onSaved={onSaved}
            onCancel={onClose}
          />
        )}
      </div>
    </aside>
  );
}
