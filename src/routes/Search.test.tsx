import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Commands resolve to the tauri-specta `{ status, data | error }` wrapper.
vi.mock("@/lib/tauri", () => ({
  searchEntries: vi.fn(async () => ({
    status: "ok",
    data: [
      { entry_id: "e1", kb_id: "kb1", kb_name: "Boeing", primary_value: "BAC3082", score: 1.0 },
    ],
  })),
  searchSourceDocs: vi.fn(async () => ({ status: "ok", data: [] })),
  kbListSummaries: vi.fn(async () => ({
    status: "ok",
    data: [
      { id: "kb1", name: "Boeing", highlight_color: "#f59e0b", entry_count: 1, updated_at: "2026-05-24T00:00:00Z" },
    ],
  })),
}));

import Search from "./Search";

describe("Search route", () => {
  it("renders entry hits after typing", async () => {
    render(<MemoryRouter><Search /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Search entries/i), {
      target: { value: "BAC" },
    });
    await waitFor(() => {
      expect(screen.getByText("BAC3082")).toBeInTheDocument();
    });
  });

  it("switches tabs and queries source docs", async () => {
    render(<MemoryRouter><Search /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Search entries/i), {
      target: { value: "BAC" },
    });
    fireEvent.click(screen.getByRole("tab", { name: /In Documents/i }));
    await waitFor(() => {
      expect(screen.getByText(/No matches/i)).toBeInTheDocument();
    });
  });
});
