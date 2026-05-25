import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastHost } from "@/components/shared";

// Commands resolve to the tauri-specta `{ status, data }` wrapper, which the
// route unwraps; mocks mirror that wire shape.
vi.mock("@/lib/tauri", () => ({
  sourceDocListRecent: vi.fn(async () => ({
    status: "ok",
    data: [
      { id: "d1", filename: "spec.pdf", page_count: 12, ocr_used: false, ingested_at: "2026-05-24T10:00:00Z" },
    ],
  })),
  sourceDocDelete: vi.fn(async () => ({ status: "ok", data: null })),
  ingestFiles: vi.fn(async () => ({ status: "ok", data: { job_ids: [] } })),
}));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: async () => () => {} }),
}));

import Documents from "./Documents";

const renderDocs = () =>
  render(
    <ToastHost>
      <MemoryRouter>
        <Documents />
      </MemoryRouter>
    </ToastHost>,
  );

describe("Documents route", () => {
  it("renders the document list", async () => {
    renderDocs();
    expect(await screen.findByText("spec.pdf")).toBeInTheDocument();
  });

  it("filters by filename", async () => {
    renderDocs();
    fireEvent.change(screen.getByPlaceholderText(/Filter by filename/i), { target: { value: "nope" } });
    expect(screen.queryByText("spec.pdf")).toBeNull();
  });
});
