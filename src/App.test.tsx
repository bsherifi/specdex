import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

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
});
