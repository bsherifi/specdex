import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastHost } from "@/components/shared";
import { useStore } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  sourceDocListRecent: vi.fn(async () => ({
    status: "ok",
    data: [
      { id: "d1", filename: "spec.pdf", page_count: 12, ocr_used: false, ingested_at: "2026-05-24T10:00:00Z" },
    ],
  })),
  sourceDocDelete: vi.fn(async () => ({ status: "ok", data: null })),
  ingestFiles: vi.fn(async () => ({ status: "ok", data: { job_ids: [] } })),
  open: vi.fn(async (): Promise<string | string[] | null> => null),
}));

// Commands resolve to the tauri-specta `{ status, data }` wrapper, which the
// route unwraps; mocks mirror that wire shape.
vi.mock("@/lib/tauri", () => ({
  sourceDocListRecent: mocks.sourceDocListRecent,
  sourceDocDelete: mocks.sourceDocDelete,
  ingestFiles: mocks.ingestFiles,
  unwrap: <T,>(res: { status: "ok"; data: T } | { status: "error"; error: unknown }) => {
    if (res.status === "error") throw new Error(String(res.error));
    return res.data;
  },
}));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: async () => () => {} }),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mocks.open,
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
  beforeEach(() => {
    mocks.sourceDocListRecent.mockClear();
    mocks.open.mockReset();
    mocks.open.mockResolvedValue(null);
    useStore.getState().clearPendingIngest();
  });

  it("renders the document list", async () => {
    renderDocs();
    expect(await screen.findByText("spec.pdf")).toBeInTheDocument();
  });

  it("filters by filename", async () => {
    renderDocs();
    await screen.findByText("spec.pdf");
    fireEvent.change(screen.getByPlaceholderText(/Filter by filename/i), { target: { value: "nope" } });
    expect(screen.queryByText("spec.pdf")).toBeNull();
  });

  it("queues files selected with Browse PDFs", async () => {
    mocks.sourceDocListRecent.mockResolvedValueOnce({ status: "ok", data: [] });
    mocks.open.mockResolvedValueOnce(["/tmp/spec.pdf"]);
    renderDocs();

    const browseButtons = await screen.findAllByRole("button", { name: /Browse PDFs/i });
    fireEvent.click(browseButtons[0]!);

    await waitFor(() => {
      expect(useStore.getState().pendingIngest).toEqual([
        { path: "/tmp/spec.pdf", filename: "spec.pdf" },
      ]);
    });
  });
});
