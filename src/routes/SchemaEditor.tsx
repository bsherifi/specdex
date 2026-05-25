import { useEffect, useState, type JSX } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldEditor } from "@/components/SchemaEditor/FieldEditor";
import { MigrationDiff } from "@/components/SchemaEditor/MigrationDiff";
import {
  diff,
  isEmpty,
  normalizeSchema,
  schemaToWire,
  type FieldDef,
  type Schema,
  type WireSchema,
} from "@/lib/schema-diff";
import { kbGet, kbMigrateSchema, unwrap } from "@/lib/tauri";
import { useToast } from "@/components/shared";

const NEW_FIELD = (i: number): FieldDef => ({
  name: `field_${i}`,
  label: `Field ${i}`,
  type: { kind: "text" },
  required: false,
  searchable: null,
  primary: false,
});

export default function SchemaEditor(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [original, setOriginal] = useState<Schema | null>(null);
  const [draft, setDraft] = useState<Schema | null>(null);
  const [entryCount] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [kbName, setKbName] = useState("");
  const { push } = useToast();

  useEffect(() => {
    if (!id) return;
    void kbGet(id).then((res) => {
      const k = unwrap<{ schema: WireSchema; name: string }>(res);
      const schema = normalizeSchema(k.schema);
      setOriginal(structuredClone(schema));
      setDraft(structuredClone(schema));
      setKbName(k.name);
    });
  }, [id]);

  if (!draft || !original || !id) return <div>Loading…</div>;

  const update = (idx: number, next: FieldDef) =>
    setDraft({ ...draft, fields: draft.fields.map((f, i) => (i === idx ? next : f)) });

  const move = (idx: number, delta: -1 | 1) => {
    const j = idx + delta;
    if (j < 0 || j >= draft.fields.length) return;
    const fields = draft.fields.slice();
    [fields[idx], fields[j]] = [fields[j]!, fields[idx]!];
    setDraft({ ...draft, fields });
  };

  const remove = (idx: number) =>
    setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== idx) });

  const setPrimary = (idx: number) =>
    setDraft({
      ...draft,
      fields: draft.fields.map((f, i) => ({ ...f, primary: i === idx })),
    });

  const setRenameHint = (idx: number, oldName: string | null) =>
    setDraft({
      ...draft,
      fields: draft.fields.map((x, i) =>
        i === idx ? { ...x, _renamed_from: oldName ?? undefined } : x,
      ),
    });

  const d = diff(original, draft);

  const apply = async () => {
    try {
      unwrap(await kbMigrateSchema(id, schemaToWire(draft)));
      push({ title: "Schema updated", variant: "success" });
      navigate(`/kbs/${id}`);
    } catch (e) {
      push({ title: "Migration failed", description: String(e), variant: "error" });
    }
  };

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate(`/kbs/${id}`)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to KB
      </Button>
      <h1 className="mt-2 text-2xl font-semibold">Schema</h1>
      <div className="mt-4 space-y-3">
        {draft.fields.map((f, i) => (
          <div key={i}>
            <FieldEditor
              field={f}
              index={i}
              total={draft.fields.length}
              onChange={(next) => update(i, next)}
              onMove={(delta) => move(i, delta)}
              onRemove={() => remove(i)}
              onSetPrimary={() => setPrimary(i)}
            />
            <details className="mt-1 text-xs text-muted-foreground">
              <summary>Advanced: renamed from</summary>
              <input
                className="rounded border border-border bg-background px-2 py-1"
                placeholder="Old field name (if renamed)"
                value={f._renamed_from ?? ""}
                onChange={(e) => setRenameHint(i, e.target.value || null)}
              />
            </details>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setDraft({ ...draft, fields: [...draft.fields, NEW_FIELD(draft.fields.length + 1)] })}
        >
          <Plus className="mr-2 h-4 w-4" /> Add field
        </Button>
        <Button onClick={() => setConfirm(true)} disabled={isEmpty(d)}>
          Save…
        </Button>
      </div>

      <MigrationDiff
        open={confirm}
        kbName={kbName}
        entryCount={entryCount}
        diff={d}
        onConfirm={() => {
          setConfirm(false);
          void apply();
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
