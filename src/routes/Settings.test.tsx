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
  identityGet: vi.fn(async () => null),
  identitySet: vi.fn(async () => ({})),
  revealInFileManager: vi.fn(async () => {}),
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
