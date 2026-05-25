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
