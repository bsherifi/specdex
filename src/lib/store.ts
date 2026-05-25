import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Identity, KbSummary } from "./bindings";

interface IngestJobRow {
  jobId: string;
  filename: string;
  progress: number;
  state: "queued" | "running" | "done" | "failed";
  message?: string;
}

interface SpecdexStore {
  identity: Identity | null;
  setIdentity: (i: Identity | null) => void;

  kbSummaries: KbSummary[];
  setKbSummaries: (s: KbSummary[]) => void;
  bumpKbsStale: () => void;
  kbsStaleCounter: number;

  entryStaleByKb: Record<string, number>;
  bumpEntryStale: (kbId: string) => void;

  ingestJobs: IngestJobRow[];
  upsertIngestJob: (row: IngestJobRow) => void;
  clearDoneIngestJobs: () => void;

  /// Document viewer KB-scope dropdown selection — keyed by source_doc_id.
  /// Reset to "all" whenever a viewer reopens (§7.3).
  scopeByDoc: Record<string, "all" | { kbId: string }>;
  setDocScope: (docId: string, scope: "all" | { kbId: string }) => void;
}

export const useStore = create<SpecdexStore>()(
  subscribeWithSelector((set) => ({
    identity: null,
    setIdentity: (i) => set({ identity: i }),

    kbSummaries: [],
    setKbSummaries: (s) => set({ kbSummaries: s }),
    bumpKbsStale: () => set((p) => ({ kbsStaleCounter: p.kbsStaleCounter + 1 })),
    kbsStaleCounter: 0,

    entryStaleByKb: {},
    bumpEntryStale: (kbId) =>
      set((p) => ({
        entryStaleByKb: { ...p.entryStaleByKb, [kbId]: (p.entryStaleByKb[kbId] ?? 0) + 1 },
      })),

    ingestJobs: [],
    upsertIngestJob: (row) =>
      set((p) => {
        const idx = p.ingestJobs.findIndex((j) => j.jobId === row.jobId);
        if (idx === -1) return { ingestJobs: [...p.ingestJobs, row] };
        const next = [...p.ingestJobs];
        next[idx] = { ...next[idx], ...row };
        return { ingestJobs: next };
      }),
    clearDoneIngestJobs: () =>
      set((p) => ({ ingestJobs: p.ingestJobs.filter((j) => j.state !== "done") })),

    scopeByDoc: {},
    setDocScope: (docId, scope) =>
      set((p) => ({ scopeByDoc: { ...p.scopeByDoc, [docId]: scope } })),
  })),
);
