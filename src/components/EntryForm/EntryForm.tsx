import { useEffect, useMemo, useState, type JSX } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared";
import { TextField } from "./fields/TextField";
import { TextMultilineField } from "./fields/TextMultilineField";
import { NumberField } from "./fields/NumberField";
import { DateField } from "./fields/DateField";
import { SelectField } from "./fields/SelectField";
import { UrlField } from "./fields/UrlField";
import { ImageAttachmentField } from "./fields/ImageAttachmentField";
import { AliasList } from "./AliasList";
import { SourceBackrefPanel } from "./SourceBackrefPanel";
import { initialValue, validate, type EntryFormValue } from "@/lib/schema-form";
import { normalizeSchema, type Schema, type FieldDef, type WireSchema } from "@/lib/schema-diff";
import { kbGet, entryCreate, entryGet, entryUpdate, unwrap } from "@/lib/tauri";

interface SourceRef {
  source_doc_id: string;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
  text: string;
}

interface Props {
  kbId: string;
  entryId?: string;
  initialCapture?: SourceRef;
  onSaved: (entryId: string) => void;
  onCancel: () => void;
}

export function EntryForm({ kbId, entryId, initialCapture, onSaved, onCancel }: Props): JSX.Element {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [value, setValue] = useState<EntryFormValue | null>(null);
  const [aliases, setAliases] = useState<string[]>([]);
  const [source, setSource] = useState<SourceRef | null>(initialCapture ?? null);
  const [notes, setNotes] = useState("");
  const { push } = useToast();

  useEffect(() => {
    void kbGet(kbId).then((res) => {
      const k = unwrap<{ schema: WireSchema }>(res);
      const schema = normalizeSchema(k.schema);
      setSchema(schema);
      if (!entryId) {
        const init = initialValue(schema);
        if (initialCapture) {
          const primary = schema.fields.find((f) => f.primary);
          if (primary) init[primary.name] = initialCapture.text.trim();
        }
        setValue(init);
      }
    });
    if (entryId) {
      void entryGet(entryId).then((res) => {
        const e = unwrap<{ data: EntryFormValue; aliases: string[]; source: SourceRef | null; notes: string | null }>(res);
        setValue(e.data);
        setAliases(e.aliases);
        setSource(e.source);
        setNotes(e.notes ?? "");
      });
    }
  }, [kbId, entryId, initialCapture]);

  const errors = useMemo(() => {
    if (!schema || !value) return [];
    return validate(schema, value);
  }, [schema, value]);

  const errFor = (name: string) => errors.find((e) => e.field === name)?.message;

  if (!schema || !value) return <div>Loading…</div>;

  const save = async () => {
    try {
      if (entryId) {
        const updated = await entryUpdate(entryId, {
          data: value,
          aliases,
          source: source ? source : null,
          notes: notes || null,
        });
        onSaved(unwrap<{ id: string }>(updated).id);
      } else {
        const res = unwrap<{ entry: { id: string }; warning: { existing_entry_id: string } | null }>(
          await entryCreate({
            kb_id: kbId,
            data: value,
            aliases,
            source,
            notes: notes || null,
          }),
        );
        if (res.warning) {
          push({
            title: "Possible duplicate",
            description: "Another entry with this primary value already exists.",
            variant: "warning",
          });
        }
        onSaved(res.entry.id);
      }
    } catch (e) {
      push({ title: "Couldn't save entry", description: String(e), variant: "error" });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {schema.fields.map((f) => (
          <FieldByType
            key={f.name}
            field={f}
            value={value[f.name]}
            onChange={(v) => setValue({ ...value, [f.name]: v })}
            error={errFor(f.name)}
          />
        ))}
        <TextMultilineField
          label="Notes (free-form)"
          value={notes}
          onChange={setNotes}
        />
      </div>
      <aside className="space-y-3">
        <section>
          <h3 className="mb-2 text-sm font-semibold">Aliases</h3>
          <AliasList value={aliases} onChange={setAliases} />
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Source</h3>
          <SourceBackrefPanel source={source} />
        </section>
      </aside>
      <div className="lg:col-span-3 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => void save()} disabled={errors.length > 0}>Save</Button>
      </div>
    </div>
  );
}

function FieldByType({
  field,
  value,
  onChange,
  error,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string | undefined;
}): JSX.Element | null {
  const common = { label: field.label, required: field.required, error };
  switch (field.type.kind) {
    case "text":
      return <TextField {...common} value={(value as string) ?? ""} onChange={onChange} />;
    case "text_multiline":
      return <TextMultilineField {...common} value={(value as string) ?? ""} onChange={onChange} />;
    case "number":
      return <NumberField {...common} value={value as number | null} onChange={onChange} />;
    case "date":
      return <DateField {...common} value={(value as string) ?? ""} onChange={onChange} />;
    case "select":
      return (
        <SelectField {...common} value={(value as string) ?? ""} options={field.type.options} onChange={onChange} />
      );
    case "url":
      return <UrlField {...common} value={(value as string) ?? ""} onChange={onChange} />;
    case "image_attachment":
      return <ImageAttachmentField {...common} value={(value as string) ?? ""} onChange={onChange} />;
    default:
      return null;
  }
}
