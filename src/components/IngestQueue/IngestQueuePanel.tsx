import type { JSX } from "react";
import { Loader2, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileRow } from "./FileRow";
import { useStore } from "@/lib/store";

export function IngestQueuePanel(): JSX.Element | null {
  const jobs = useStore((s) => s.ingestJobs);
  const minimized = useStore((s) => s.queueMinimized);
  const setMinimized = useStore((s) => s.setQueueMinimized);
  const clearDone = useStore((s) => s.clearDoneIngestJobs);

  if (jobs.length === 0) return null;

  const active = jobs.filter((j) => j.state === "queued" || j.state === "running").length;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 text-sm shadow-lg backdrop-blur transition-colors hover:bg-accent"
      >
        {active > 0 && <Loader2 className="size-4 animate-spin" />}
        Ingest queue
        <Badge variant="secondary">{active > 0 ? `${active} active` : "done"}</Badge>
      </button>
    );
  }

  return (
    <aside className="scroll-thin fixed bottom-4 right-4 z-40 flex max-h-[50vh] w-80 flex-col overflow-hidden rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur">
      <header className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          Ingest queue
          {active > 0 && <Badge variant="secondary">{active} active</Badge>}
        </span>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" onClick={() => setMinimized(true)} title="Run in background">
            <Minimize2 />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={clearDone} title="Clear completed">
            <X />
          </Button>
        </div>
      </header>
      <div className="flex flex-col gap-2 overflow-auto p-2">
        {jobs.map((j) => (
          <FileRow key={j.jobId} row={j} />
        ))}
      </div>
    </aside>
  );
}
