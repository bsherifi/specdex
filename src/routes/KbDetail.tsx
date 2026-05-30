import { useEffect, useState, type JSX } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ConfirmModal } from "@/components/shared";
import { toast } from "sonner";
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
// A highlight captured in the PDF viewer, handed over via router state.
interface SourceCapture {
  source_doc_id: string;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
  text: string;
}

export default function KbDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [captureForEntry, setCaptureForEntry] = useState<SourceCapture | null>(null);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
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

  // A highlight handed over from the PDF viewer either opens the create form
  // prefilled (text selection) or opens an existing entry (clicked highlight).
  // Clear the router state afterwards so a refresh/back doesn't reopen it.
  useEffect(() => {
    const state = location.state as { capture?: SourceCapture; openEntryId?: string } | null;
    if (state?.capture) {
      setCaptureForEntry(state.capture);
      setNewEntryOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    } else if (state?.openEntryId) {
      setEditEntryId(state.openEntryId);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  if (!kb || !id)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );

  const columns: FieldDef[] = [
    kb.schema.fields.find((f) => f.primary)!,
    ...kb.schema.fields.filter((f) => !f.primary).slice(0, 4),
  ];

  const kbColorName = (Object.entries(KB_COLOR_HEX).find(
    ([, h]) => h === kb.highlight_color,
  )?.[0] ?? "amber") as KbColorName;

  const setColor = async (name: KbColorName) => {
    try {
      unwrap(await kbUpdateMeta(kb.id, { highlight_color: KB_COLOR_HEX[name] }));
      toast.success("Color updated");
      setColorOpen(false);
      void kbGet(kb.id).then((res) => {
        const k = unwrap<WireKb>(res);
        setKb({ ...k, schema: normalizeSchema(k.schema) });
      });
    } catch (e) {
      toast.error("Color update failed", { description: String(e) });
    }
  };

  const saveName = async () => {
    if (!nameDraft.trim() || nameDraft === kb.name) {
      setEditName(false);
      return;
    }
    try {
      unwrap(await kbUpdateMeta(kb.id, { name: nameDraft.trim() }));
      toast.success("Renamed");
      setEditName(false);
      void kbGet(kb.id).then((res) => {
        const k = unwrap<WireKb>(res);
        setKb({ ...k, schema: normalizeSchema(k.schema) });
      });
    } catch (e) {
      toast.error("Rename failed", { description: String(e) });
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
              className="cursor-pointer text-2xl font-semibold tracking-tight hover:underline"
              onClick={() => setEditName(true)}
            >
              {kb.name}
            </h1>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{entries.length} entries</span>
            <span aria-hidden="true">·</span>
            <button
              className="inline-flex items-center gap-1.5 rounded-md hover:text-foreground"
              onClick={() => setColorOpen(true)}
              title="Change highlight color"
            >
              <span
                className="size-3 rounded-full ring-2 ring-background"
                style={{ backgroundColor: kb.highlight_color }}
              />
              <span className="capitalize">{kbColorName}</span>
            </button>
          </div>
          {kb.description && <p className="text-sm text-muted-foreground">{kb.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/kbs/${id}/schema`)}>
            <Edit /> Edit schema
          </Button>
          <Button onClick={() => setNewEntryOpen(true)}>
            <Plus /> New entry
          </Button>
          <Button variant="outline" size="icon" onClick={() => setConfirmKbDelete(true)} title="Delete KB">
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Filter entries…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        {selection.size > 0 && (
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Delete {selection.size}
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Plus />}
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
                  className="size-4 accent-primary"
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
                <TableCell onClick={(ev) => ev.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
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
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: kb.highlight_color }}
                        />
                        <span className="font-medium">{e.primary_value}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{String(e.data[c.name] ?? "")}</span>
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-muted-foreground">{new Date(e.updated_at).toLocaleString()}</TableCell>
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

      <Dialog
        open={newEntryOpen}
        onOpenChange={(o) => {
          setNewEntryOpen(o);
          if (!o) setCaptureForEntry(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New entry</DialogTitle>
          </DialogHeader>
          <EntryForm
            kbId={kb.id}
            {...(captureForEntry ? { initialCapture: captureForEntry } : {})}
            onSaved={() => {
              setNewEntryOpen(false);
              setCaptureForEntry(null);
            }}
            onCancel={() => {
              setNewEntryOpen(false);
              setCaptureForEntry(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editEntryId !== null} onOpenChange={(o) => !o && setEditEntryId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
          </DialogHeader>
          {editEntryId && (
            <EntryForm
              kbId={kb.id}
              entryId={editEntryId}
              onSaved={() => setEditEntryId(null)}
              onCancel={() => setEditEntryId(null)}
            />
          )}
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
            toast.error("Delete failed", { description: String(e) });
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
            toast.error("Delete failed", { description: String(e) });
          }
        }}
        onCancel={() => setConfirmKbDelete(false)}
      />
    </div>
  );
}
