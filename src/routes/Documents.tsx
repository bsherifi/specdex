import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Upload } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
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
import { EmptyState, ConfirmModal } from "@/components/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileDropZone } from "@/components/FileDropZone";
import { useStore } from "@/lib/store";
import { sourceDocListRecent, sourceDocDelete, unwrap } from "@/lib/tauri";

interface DocRow {
  id: string;
  filename: string;
  page_count: number;
  ocr_used: boolean;
  ingested_at: string;
}

type SortKey = "filename" | "page_count" | "ingested_at";

export default function Documents(): JSX.Element {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ingested_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const navigate = useNavigate();
  const setPending = useStore((s) => s.setPendingIngest);
  const completedIngestCount = useStore((s) => s.ingestJobs.filter((j) => j.state === "done").length);

  const reload = useCallback(async () => {
    setDocs(unwrap<DocRow[]>(await sourceDocListRecent(500)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (completedIngestCount > 0) void reload();
  }, [completedIngestCount, reload]);

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

  const handleDrop = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    const limited = paths.slice(0, 50); // §25 default cap
    setPending(limited.map((p) => ({ path: p, filename: p.split(/[/\\]/).pop() ?? p })));
  }, [setPending]);

  const browse = async () => {
    try {
      const picked = await open({
        multiple: true,
        filters: [{ name: "PDF documents", extensions: ["pdf"] }],
      });
      if (!picked) return;
      handleDrop(Array.isArray(picked) ? picked : [picked]);
    } catch (e) {
      toast.error("File picker failed", { description: String(e) });
    }
  };

  const bulkDelete = async () => {
    for (const id of confirm.ids) {
      try {
        unwrap(await sourceDocDelete(id));
      } catch (e) {
        toast.error("Delete failed", { description: String(e) });
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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void browse()}>
            <Upload />
            Browse PDFs
          </Button>
          {selection.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => setConfirm({ open: true, ids: Array.from(selection) })}
            >
              <Trash2 />
              Delete ({selection.size})
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Upload />}
          title={docs.length === 0 ? "Drop PDFs here, or browse." : "No documents match this filter."}
          {...(docs.length === 0 ? { description: "Up to 50 files per batch." } : {})}
          action={docs.length === 0 ? <Button onClick={() => void browse()}>Browse PDFs</Button> : undefined}
          className="mt-6"
        />
      ) : (
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
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
                    className="size-4 accent-primary"
                    checked={selection.has(d.id)}
                    onChange={() => toggle(d.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{d.filename}</TableCell>
                <TableCell className="text-muted-foreground">{d.page_count}</TableCell>
                <TableCell>
                  {d.ocr_used ? <Badge variant="secondary">OCR</Badge> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(d.ingested_at).toLocaleString()}</TableCell>
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
