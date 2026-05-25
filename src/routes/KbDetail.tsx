import { useEffect, useState, type JSX } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Edit, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, KbBadge, ConfirmModal, useToast } from "@/components/shared";
import { KbColorPicker } from "@/components/KbColorPicker";
import { EntryForm } from "@/components/EntryForm";
import {
  kbGet,
  kbUpdateMeta,
  kbDelete,
  entryList,
  entryBulkDelete,
  unwrap,
} from "@/lib/tauri";
import { useStore } from "@/lib/store";
import { KB_COLOR_HEX, type KbColorName } from "@/lib/theme";
import { normalizeSchema, type FieldDef, type Schema, type WireSchema } from "@/lib/schema-diff";

interface Kb {
  id: string;
  name: string;
  description: string | null;
  schema: Schema;
  primary_field: string;
  highlight_color: string;
}
type WireKb = Omit<Kb, "schema"> & { schema: WireSchema };
interface Entry {
  id: string;
  kb_id: string;
  primary_value: string;
  data: Record<string, unknown>;
  updated_at: string;
}

export default function KbDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [kb, setKb] = useState<Kb | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmKbDelete, setConfirmKbDelete] = useState(false);
  const { push } = useToast();
  const staleByKb = useStore((s) => s.entryStaleByKb);
  const staleForKb = id ? staleByKb[id] ?? 0 : 0;

  useEffect(() => {
    if (!id) return;
    void kbGet(id).then((res) => {
      const k = unwrap<WireKb>(res);
      setKb({ ...k, schema: normalizeSchema(k.schema) });
      setNameDraft(k.name);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void entryList({ kb_id: id, filter: filter || undefined, limit: 5000 }).then((res) =>
      setEntries(unwrap<Entry[]>(res)),
    );
  }, [id, filter, staleForKb]);

  if (!kb || !id) return <div>Loading…</div>;

  const columns: FieldDef[] = [
    kb.schema.fields.find((f) => f.primary)!,
    ...kb.schema.fields.filter((f) => !f.primary).slice(0, 4),
  ];

  const setColor = async (name: KbColorName) => {
    try {
      unwrap(await kbUpdateMeta(kb.id, { highlight_color: KB_COLOR_HEX[name] }));
      push({ title: "Color updated", variant: "success" });
      setColorOpen(false);
      void kbGet(kb.id).then((res) => {
        const k = unwrap<WireKb>(res);
        setKb({ ...k, schema: normalizeSchema(k.schema) });
      });
    } catch (e) {
      push({ title: "Color update failed", description: String(e), variant: "error" });
    }
  };

  const saveName = async () => {
    if (!nameDraft.trim() || nameDraft === kb.name) {
      setEditName(false);
      return;
    }
    try {
      unwrap(await kbUpdateMeta(kb.id, { name: nameDraft.trim() }));
      push({ title: "Renamed", variant: "success" });
      setEditName(false);
      void kbGet(kb.id).then((res) => {
        const k = unwrap<WireKb>(res);
        setKb({ ...k, schema: normalizeSchema(k.schema) });
      });
    } catch (e) {
      push({ title: "Rename failed", description: String(e), variant: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          {editName ? (
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => void saveName()}
              onKeyDown={(e) => e.key === "Enter" && void saveName()}
              autoFocus
              className="text-2xl font-semibold"
            />
          ) : (
            <h1
              className="text-2xl font-semibold hover:underline"
              onClick={() => setEditName(true)}
            >
              {kb.name}
            </h1>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{entries.length} entries</span>
            <button
              className="inline-flex items-center gap-1 hover:underline"
              onClick={() => setColorOpen(true)}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: kb.highlight_color }}
              />
              {kb.highlight_color}
            </button>
          </div>
          {kb.description && <p className="text-muted-foreground">{kb.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/kbs/${id}/schema`)}>
            <Edit className="mr-2 h-4 w-4" /> Edit schema
          </Button>
          <Button onClick={() => setNewEntryOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New entry
          </Button>
          <Button variant="destructive" onClick={() => setConfirmKbDelete(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-between">
        <Input
          placeholder="Filter entries…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        {selection.size > 0 && (
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete {selection.size}
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No entries"
          description="Open a PDF and highlight text to start adding entries."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  checked={selection.size === entries.length && entries.length > 0}
                  onChange={(e) =>
                    setSelection(e.target.checked ? new Set(entries.map((x) => x.id)) : new Set())
                  }
                />
              </TableHead>
              {columns.map((c) => (
                <TableHead key={c.name}>{c.label}</TableHead>
              ))}
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id} id={`entry-${e.id}`}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selection.has(e.id)}
                    onChange={() =>
                      setSelection((s) => {
                        const n = new Set(s);
                        if (n.has(e.id)) n.delete(e.id);
                        else n.add(e.id);
                        return n;
                      })
                    }
                  />
                </TableCell>
                {columns.map((c) => (
                  <TableCell key={c.name}>
                    {c.primary ? (
                      <div className="inline-flex items-center gap-2">
                        <KbBadge name={kb.name} color={"amber"} />
                        <span className="font-medium">{e.primary_value}</span>
                      </div>
                    ) : (
                      String(e.data[c.name] ?? "")
                    )}
                  </TableCell>
                ))}
                <TableCell>{new Date(e.updated_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={colorOpen} onOpenChange={setColorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick a color</DialogTitle>
          </DialogHeader>
          <KbColorPicker
            value={
              (Object.entries(KB_COLOR_HEX).find(([, h]) => h === kb.highlight_color)?.[0] ?? "amber") as KbColorName
            }
            onChange={(c) => void setColor(c)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={newEntryOpen} onOpenChange={setNewEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New entry</DialogTitle>
          </DialogHeader>
          <EntryForm
            kbId={kb.id}
            onSaved={() => setNewEntryOpen(false)}
            onCancel={() => setNewEntryOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={confirmDelete}
        title={`Delete ${selection.size} entries?`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            unwrap(await entryBulkDelete(Array.from(selection)));
            setSelection(new Set());
            setConfirmDelete(false);
          } catch (e) {
            push({ title: "Delete failed", description: String(e), variant: "error" });
          }
        }}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmModal
        open={confirmKbDelete}
        title={`Delete KB "${kb.name}"?`}
        description="This permanently removes the KB and all its entries. Source documents are kept."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            unwrap(await kbDelete(kb.id));
            navigate("/kbs");
          } catch (e) {
            push({ title: "Delete failed", description: String(e), variant: "error" });
          }
        }}
        onCancel={() => setConfirmKbDelete(false)}
      />
    </div>
  );
}
