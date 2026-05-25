import type { JSX } from "react";
import { Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileRow } from "./FileRow";
import { useStore } from "@/lib/store";

export function IngestQueuePanel(): JSX.Element | null {
  const jobs = useStore((s) => s.ingestJobs);
  const minimized = useStore((s) => s.queueMinimized);
  const setMinimized = useStore((s) => s.setQueueMinimized);
  const clearDone = useStore((s) => s.clearDoneIngestJobs);

  if (jobs.length === 0) return null;

  if (minimized) {
    const active = jobs.filter((j) => j.state === "queued" || j.state === "running").length;
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-40 rounded-md border border-border bg-card px-3 py-2 text-sm shadow"
      >
        Ingesting · {active} active
      </button>
    );
  }

  return (
    <aside className="fixed bottom-4 right-4 z-40 flex max-h-[50vh] w-80 flex-col rounded-md border border-border bg-card shadow-lg">
      <header className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-medium">
        <span>Ingest queue</span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setMinimized(true)} title="Run in background">
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={clearDone} title="Clear completed">
            <X className="h-4 w-4" />
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
