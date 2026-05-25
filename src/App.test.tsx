import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("@tauri-apps/api/event", () => ({
  listen: async () => () => {},
}));

// The Search route (rendered at "/") calls kbListSummaries on mount. Stub the
// tauri surface so the integration render exercises routing, not the bridge.
vi.mock("@/lib/tauri", () => ({
  kbListSummaries: vi.fn(async () => ({ status: "ok", data: [] })),
  searchEntries: vi.fn(async () => ({ status: "ok", data: [] })),
  searchSourceDocs: vi.fn(async () => ({ status: "ok", data: [] })),
}));

describe("App", () => {
  it("renders the Search route at /", async () => {
    render(<App />);
    // Routes are lazy-loaded behind Suspense, so wait for the chunk to resolve.
    // The "Search" label also appears in the sidebar nav, so assert on the
    // search input's unique placeholder to confirm the route itself rendered.
    expect(await screen.findByPlaceholderText(/Search entries/i)).toBeInTheDocument();
  });
});
