import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { ingestFiles, unwrap } from "@/lib/tauri";
import { toast } from "sonner";

interface FileRow {
  path: string;
  filename: string;
  ocr: boolean;
}

export function PreIngestDialog(): JSX.Element {
  const pending = useStore((s) => s.pendingIngest);
  const clear = useStore((s) => s.clearPendingIngest);
  const [rows, setRows] = useState<FileRow[]>([]);

  useEffect(() => {
    setRows(pending.map((p) => ({ ...p, ocr: false })));
  }, [pending]);

  const open = pending.length > 0;

  const start = async () => {
    try {
      unwrap(await ingestFiles({ files: rows.map((r) => ({ path: r.path, ocr: r.ocr })) }));
      toast.info("Ingest started", {
        description: `${rows.length} file(s) queued.`,
      });
    } catch (e) {
      toast.error("Ingest failed to start", { description: String(e) });
    }
    clear();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && clear()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ingest {rows.length} file(s)?</DialogTitle>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-auto">
          {rows.map((r, i) => (
            <div
              key={r.path}
              className="flex items-center justify-between rounded-md border border-border bg-card p-2"
            >
              <div className="truncate text-sm">{r.filename}</div>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={r.ocr}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, j) => (j === i ? { ...x, ocr: e.target.checked } : x)))
                  }
                />
                Run OCR
              </label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={clear}>
            Cancel
          </Button>
          <Button onClick={() => void start()}>Start ingest</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
