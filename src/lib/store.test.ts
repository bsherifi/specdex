import { describe, expect, it, beforeEach } from "vitest";
import { useStore } from "./store";

describe("ingestJobs", () => {
  beforeEach(() => {
    useStore.setState({ ingestJobs: [] });
  });

  it("inserts new jobs", () => {
    useStore.getState().upsertIngestJob({
      jobId: "a",
      filename: "x.pdf",
      progress: 0,
      state: "queued",
    });
    expect(useStore.getState().ingestJobs).toHaveLength(1);
  });

  it("updates existing job in place", () => {
    useStore.getState().upsertIngestJob({ jobId: "a", filename: "x.pdf", progress: 0, state: "queued" });
    useStore.getState().upsertIngestJob({ jobId: "a", filename: "x.pdf", progress: 0.5, state: "running" });
    const rows = useStore.getState().ingestJobs;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.progress).toBe(0.5);
    expect(rows[0]?.state).toBe("running");
  });

  it("clearDoneIngestJobs removes done rows", () => {
    useStore.getState().upsertIngestJob({ jobId: "a", filename: "x.pdf", progress: 1, state: "done" });
    useStore.getState().upsertIngestJob({ jobId: "b", filename: "y.pdf", progress: 0.5, state: "running" });
    useStore.getState().clearDoneIngestJobs();
    expect(useStore.getState().ingestJobs.map((j) => j.jobId)).toEqual(["b"]);
  });
});
