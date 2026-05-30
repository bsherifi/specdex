import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

// Tauri commands return the `{ status, data }` wrapper for Result-typed
// commands; mock that shape so the hook exercises real production behavior.
vi.mock("@/lib/tauri", () => ({
  identityGet: vi.fn(async () => ({ status: "ok", data: null })),
  kbListSummaries: vi.fn(async () => ({ status: "ok", data: [] })),
  unwrap: <T,>(res: { status: "ok"; data: T } | { status: "error"; error: unknown }) => {
    if (res.status === "error") throw new Error(String(res.error));
    return res.data;
  },
}));

import { useFirstRunRedirect } from "./useFirstRunRedirect";

function Probe() {
  useFirstRunRedirect();
  return <div>probe</div>;
}

describe("useFirstRunRedirect", () => {
  it("navigates to /onboarding when identity is null and no KBs exist", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(navigateSpy).toHaveBeenCalledWith("/onboarding");
  });
});
