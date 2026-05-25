import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastHost } from "@/components/shared";

vi.mock("@/lib/tauri", () => ({
  kbCreate: vi.fn(async () => ({ status: "ok", data: { id: "kb1" } })),
  unwrap: <T,>(res: { status: "ok"; data: T } | { status: "error"; error: unknown }) => {
    if (res.status === "error") throw new Error(String(res.error));
    return res.data;
  },
}));

import { KbCreateDialog } from "./KbCreateDialog";

describe("KbCreateDialog", () => {
  it("sends the wire schema array when creating a KB", async () => {
    const { kbCreate } = await import("@/lib/tauri");
    render(
      <ToastHost>
        <KbCreateDialog open existingCount={0} onClose={() => {}} onCreated={() => {}} />
      </ToastHost>,
    );

    fireEvent.change(screen.getByPlaceholderText(/Name/i), {
      target: { value: "Specs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(kbCreate).toHaveBeenCalledWith(expect.objectContaining({
        schema: expect.any(Array),
      }));
    });
  });
});
