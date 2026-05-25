import type { JSX } from "react";
import { Link } from "react-router-dom";

interface SourceRef {
  source_doc_id: string;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
  text: string;
}

interface Props {
  source: SourceRef | null;
}

export function SourceBackrefPanel({ source }: Props): JSX.Element {
  if (!source) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
        No source document linked. Open a PDF and use &quot;+ Add to KB&quot; to link one.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border bg-card p-3 text-sm">
      <div className="font-medium">
        Page {source.page} of source document
      </div>
      <blockquote className="mt-2 border-l-2 border-border pl-2 text-muted-foreground">
        {source.text}
      </blockquote>
      <Link
        to={`/documents/${source.source_doc_id}?page=${source.page}`}
        className="mt-2 inline-block text-primary underline"
      >
        Open source
      </Link>
    </div>
  );
}
