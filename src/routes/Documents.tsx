import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState, ConfirmModal, useToast } from "@/components/shared";
import { FileDropZone } from "@/components/FileDropZone";
import { useStore } from "@/lib/store";
import { sourceDocListRecent, sourceDocDelete } from "@/lib/tauri";

interface DocRow {
  id: string;
  filename: string;
  page_count: number;
  ocr_used: boolean;
  ingested_at: string;
}

type SortKey = "filename" | "page_count" | "ingested_at";

// Commands return the tauri-specta `{ status, data | error }` wrapper (see the
// contract note in `@/lib/tauri`); narrow on `status` rather than casting past it.
function unwrap<T>(res: unknown): T {
  const r = res as { status: "ok"; data: T } | { status: "error"; error: unknown };
  if (r.status === "error") throw new Error(JSON.stringify(r.error));
  return r.data;
}

export default function Documents(): JSX.Element {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ingested_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const { push } = useToast();
  const navigate = useNavigate();
  const setPending = useStore((s) => s.setPendingIngest);

  const reload = async () => {
    setDocs(unwrap<DocRow[]>(await sourceDocListRecent(500)));
  };

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const rows = f ? docs.filter((d) => d.filename.toLowerCase().includes(f)) : docs.slice();
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return rows;
  }, [docs, filter, sortKey, sortAsc]);

  const toggle = (id: string) =>
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDrop = (paths: string[]) => {
    if (paths.length === 0) return;
    const limited = paths.slice(0, 50); // §25 default cap
    setPending(limited.map((p) => ({ path: p, filename: p.split(/[/\\]/).pop() ?? p })));
  };

  const bulkDelete = async () => {
    for (const id of confirm.ids) {
      try {
        unwrap(await sourceDocDelete(id));
      } catch (e) {
        push({ title: "Delete failed", description: String(e), variant: "error" });
      }
    }
    setSelection(new Set());
    setConfirm({ open: false, ids: [] });
    await reload();
  };

  const sortIndicator = (k: SortKey) => (sortKey === k ? (sortAsc ? "▲" : "▼") : "");

  return (
    <FileDropZone onFiles={handleDrop} className="min-h-[60vh]">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Filter by filename…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        {selection.size > 0 && (
          <Button
            variant="destructive"
            onClick={() => setConfirm({ open: true, ids: Array.from(selection) })}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete ({selection.size})
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={docs.length === 0 ? "Drop PDFs here, or click to browse." : "No documents match this filter."}
          {...(docs.length === 0 ? { description: "Up to 50 files per batch." } : {})}
          className="mt-6"
        />
      ) : (
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  checked={selection.size === filtered.length && filtered.length > 0}
                  onChange={(e) =>
                    setSelection(e.target.checked ? new Set(filtered.map((d) => d.id)) : new Set())
                  }
                />
              </TableHead>
              <TableHead onClick={() => { setSortKey("filename"); setSortAsc(!sortAsc); }} className="cursor-pointer">
                Filename {sortIndicator("filename")}
              </TableHead>
              <TableHead onClick={() => { setSortKey("page_count"); setSortAsc(!sortAsc); }} className="cursor-pointer">
                Pages {sortIndicator("page_count")}
              </TableHead>
              <TableHead>OCR</TableHead>
              <TableHead onClick={() => { setSortKey("ingested_at"); setSortAsc(!sortAsc); }} className="cursor-pointer">
                Ingested {sortIndicator("ingested_at")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow
                key={d.id}
                onClick={() => navigate(`/documents/${d.id}`)}
                className="cursor-pointer"
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selection.has(d.id)}
                    onChange={() => toggle(d.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{d.filename}</TableCell>
                <TableCell>{d.page_count}</TableCell>
                <TableCell>{d.ocr_used ? "yes" : "—"}</TableCell>
                <TableCell>{new Date(d.ingested_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmModal
        open={confirm.open}
        title={`Delete ${confirm.ids.length} document(s)?`}
        description="Entries linked to these documents keep their text snippets but lose the source link."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void bulkDelete()}
        onCancel={() => setConfirm({ open: false, ids: [] })}
      />
    </FileDropZone>
  );
}
