import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastHost } from "@/components/shared";

vi.mock("@/lib/tauri", () => ({
  getAppSettings: vi.fn(async () => ({
    data_dir: "/home/user/.specdex",
    log_dir: "/home/user/.specdex/logs",
    pdfium_version: "bundled (PDFium / pdfium-render 0.8)",
    ocrs_version: "bundled",
    tantivy_version: "0.22",
  })),
  identityGet: vi.fn(async () => ({ status: "ok", data: null })),
  identitySet: vi.fn(async () => ({ status: "ok", data: { display_name: "Sara" } })),
  revealInFileManager: vi.fn(async () => ({ status: "ok", data: null })),
  backupExport: vi.fn(async () => ({ status: "ok", data: {} })),
  backupRestore: vi.fn(async () => ({ status: "ok", data: {} })),
  unwrap: <T,>(res: { status: "ok"; data: T } | { status: "error"; error: unknown }) => {
    if (res.status === "error") throw new Error(String(res.error));
    return res.data;
  },
}));

import Settings from "./Settings";

const renderSettings = () =>
  render(
    <ToastHost>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </ToastHost>,
  );

describe("Settings — Application data card", () => {
  it("shows the data directory path from getAppSettings", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("/home/user/.specdex")).toBeInTheDocument();
    });
  });

  it("renders the 'Open in file manager' button", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open in file manager/i })).toBeInTheDocument();
    });
  });
});

describe("Settings — Identity card", () => {
  it("renders the Identity heading + Save button", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/Identity/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });
  });

  it("calls identitySet when Save is clicked with a non-empty draft", async () => {
    const { identitySet } = await import("@/lib/tauri");
    renderSettings();
    await waitFor(() => screen.getByPlaceholderText(/Display name/i));
    fireEvent.change(screen.getByPlaceholderText(/Display name/i), { target: { value: "Sara" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(identitySet).toHaveBeenCalledWith("Sara");
    });
  });
});

describe("Settings — OCR languages card", () => {
  it("lists the bundled traineddata files", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/OCR language data/i)).toBeInTheDocument();
      expect(screen.getByText("eng")).toBeInTheDocument();
      expect(screen.getByText("osd")).toBeInTheDocument();
    });
  });
});

describe("Settings — Backup card", () => {
  it("renders Export and Restore buttons", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Export full backup ZIP/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Restore from backup ZIP/i })).toBeInTheDocument();
    });
  });
});

describe("Settings — Diagnostics card", () => {
  it("lists Tantivy / PDFium / ocrs versions + log folder + offline banner", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/Tantivy:/i)).toBeInTheDocument();
      expect(screen.getByText(/PDFium:/i)).toBeInTheDocument();
      expect(screen.getByText(/ocrs:/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Open log folder/i })).toBeInTheDocument();
      expect(screen.getByText(/no outbound network requests/i)).toBeInTheDocument();
    });
  });
});

describe("Settings — About card", () => {
  it("shows MIT license + repo URL + Replay-onboarding link", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/MIT/i)).toBeInTheDocument();
      expect(screen.getByText(/github\.com\/bsherifi\/specdex/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Replay onboarding wizard/i })).toBeInTheDocument();
    });
  });
});
