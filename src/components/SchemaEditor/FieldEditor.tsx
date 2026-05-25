import type { JSX } from "react";
import { Trash2, MoveUp, MoveDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FieldDef } from "@/lib/schema-diff";

interface Props {
  field: FieldDef;
  index: number;
  total: number;
  onChange: (next: FieldDef) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onSetPrimary: () => void;
}

const TYPES = [
  { value: "text", label: "Text" },
  { value: "text_multiline", label: "Text (multiline)" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "url", label: "URL" },
  { value: "image_attachment", label: "Image attachment" },
] as const;

export function FieldEditor({ field, index, total, onChange, onMove, onRemove, onSetPrimary }: Props): JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={field.name}
          onChange={(e) => onChange({ ...field, name: e.target.value })}
          placeholder="snake_case_name"
          className="max-w-[200px] font-mono"
        />
        <Input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="Human-readable label"
          className="max-w-[280px]"
        />
        <Select
          value={field.type.kind}
          onValueChange={(v) =>
            onChange({
              ...field,
              type:
                v === "select"
                  ? { kind: "select", options: field.type.kind === "select" ? field.type.options : [] }
                  : ({ kind: v } as FieldDef["type"]),
            })
          }
        >
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="ml-2 inline-flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
          />
          Required
        </label>

        <label className="ml-2 inline-flex items-center gap-1.5 text-sm">
          <input
            type="radio"
            className="size-4 accent-primary"
            checked={field.primary}
            onChange={onSetPrimary}
            name="primary"
            disabled={field.type.kind !== "text"}
          />
          Primary
        </label>

        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => onMove(-1)} disabled={index === 0}>
            <MoveUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onMove(1)} disabled={index === total - 1}>
            <MoveDown className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onRemove} disabled={field.primary}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {field.type.kind === "select" && (
        <div className="mt-2">
          <Input
            value={field.type.options.join(", ")}
            onChange={(e) =>
              onChange({
                ...field,
                type: { kind: "select", options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) },
              })
            }
            placeholder="Comma-separated options"
          />
        </div>
      )}
    </div>
  );
}
