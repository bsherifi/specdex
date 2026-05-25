import type { JSX } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface IngestJobRow {
  jobId: string;
  filename: string;
  progress: number;
  state: "queued" | "running" | "done" | "failed";
  message?: string;
  sourceDocId?: string;
}

interface Props {
  row: IngestJobRow;
}

function StatusBadge({ state }: { state: IngestJobRow["state"] }): JSX.Element {
  switch (state) {
    case "queued":
      return (
        <Badge variant="secondary">
          <Clock />
          Queued
        </Badge>
      );
    case "running":
      return (
        <Badge variant="secondary">
          <Loader2 className="animate-spin" />
          Processing
        </Badge>
      );
    case "done":
      return (
        <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 />
          Done
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle />
          Failed
        </Badge>
      );
  }
}

export function FileRow({ row }: Props): JSX.Element {
  const pct = Math.round((row.progress ?? 0) * 100);
  return (
    <div className="rounded-md border border-border bg-card p-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{row.filename || row.jobId}</span>
        <StatusBadge state={row.state} />
      </div>
      {row.state === "running" && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {row.state === "failed" && row.message && (
        <div className="mt-1 text-xs text-destructive">{row.message}</div>
      )}
      {row.state === "done" && row.sourceDocId && (
        <Link
          to={`/documents/${row.sourceDocId}`}
          className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline"
        >
          Open document
        </Link>
      )}
    </div>
  );
}
