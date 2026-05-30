import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { useStore } from "@/lib/store";

vi.mock("@tauri-apps/api/event", () => ({
  listen: async () => () => {},
}));

// The Search route (rendered at "/") calls kbListSummaries on mount. Stub the
// tauri surface so the integration render exercises routing, not the bridge.
vi.mock("@/lib/tauri", () => ({
  // A returning user (non-null identity) so useFirstRunRedirect stays put and
  // the Search route renders instead of bouncing to /onboarding.
  identityGet: vi.fn(async () => ({ status: "ok", data: { display_name: "Tester" } })),
  kbListSummaries: vi.fn(async () => ({ status: "ok", data: [] })),
  searchEntries: vi.fn(async () => ({ status: "ok", data: [] })),
  searchSourceDocs: vi.fn(async () => ({ status: "ok", data: [] })),
  unwrap: <T,>(res: { status: "ok"; data: T } | { status: "error"; error: unknown }) => {
    if (res.status === "error") throw new Error(String(res.error));
    return res.data;
  },
}));

describe("App", () => {
  it("renders the Search route at /", async () => {
    render(<App />);
    // Routes are lazy-loaded behind Suspense, so wait for the chunk to resolve.
    // The "Search" label also appears in the sidebar nav, so assert on the
    // search input's unique placeholder to confirm the route itself rendered.
    expect(await screen.findByPlaceholderText(/Search entries/i)).toBeInTheDocument();
  });

  // Regression: a completed ingest job renders a <Link> in the queue panel.
  // The panel must live inside the RouterProvider, or the <Link> throws
  // "Right side of assignment cannot be destructured" and white-screens the app.
  it("renders a completed ingest job's link without crashing", async () => {
    useStore.setState({
      ingestJobs: [
        { jobId: "j1", filename: "spec.pdf", progress: 1, state: "done", sourceDocId: "doc-1" },
      ],
    });
    render(<App />);
    expect(await screen.findByText("Open document")).toBeInTheDocument();
    useStore.setState({ ingestJobs: [] });
  });
});
