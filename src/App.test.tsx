import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("@tauri-apps/api/event", () => ({
  listen: async () => () => {},
}));

describe("App", () => {
  it("renders the Search route at /", async () => {
    render(<App />);
    // Routes are lazy-loaded behind Suspense, so wait for the chunk to resolve.
    // The "Search" label also appears in the sidebar nav, so assert on the
    // Search placeholder's unique copy to confirm the route itself rendered.
    expect(await screen.findByText(/plan 22 fills it in/i)).toBeInTheDocument();
  });
});
