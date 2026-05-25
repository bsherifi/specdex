import { useState, type JSX } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

function normalize(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = raw.trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function AliasList({ value, onChange }: Props): JSX.Element {
  const [draft, setDraft] = useState("");

  const addOne = () => {
    if (!draft.trim()) return;
    onChange(normalize([...value, draft]));
    setDraft("");
  };

  const bulkPaste = (text: string) => {
    const items = text.split(/[\n,]/g);
    onChange(normalize([...value, ...items]));
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (/[\n,]/.test(t)) {
              e.preventDefault();
              bulkPaste(t);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOne();
            }
          }}
          placeholder="Add alias (paste a list to add many)"
        />
        <Button size="sm" onClick={addOne}>Add</Button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {value.map((a) => (
          <li
            key={a}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs"
          >
            {a}
            <button
              onClick={() => onChange(value.filter((x) => x !== a))}
              aria-label={`Remove ${a}`}
            >
              <X className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
