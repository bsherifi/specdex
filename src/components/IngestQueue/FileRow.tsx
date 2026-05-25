import type { JSX } from "react";
import { Link } from "react-router-dom";

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

export function FileRow({ row }: Props): JSX.Element {
  const pct = Math.round((row.progress ?? 0) * 100);
  return (
    <div className="rounded-md border border-border bg-card p-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="truncate">{row.filename || row.jobId}</span>
        <span className="text-xs text-muted-foreground">{row.state}</span>
      </div>
      {row.state === "running" && (
        <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      )}
      {row.state === "failed" && row.message && (
        <div className="mt-1 text-xs text-destructive">{row.message}</div>
      )}
      {row.state === "done" && row.sourceDocId && (
        <Link to={`/documents/${row.sourceDocId}`} className="text-xs text-primary underline">
          Open document
        </Link>
      )}
    </div>
  );
}
