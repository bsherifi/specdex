import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastHost } from "@/components/shared";

vi.mock("@/lib/tauri", () => ({
  identitySet: vi.fn(async () => ({})),
  kbCreate: vi.fn(async () => ({})),
}));

import Onboarding from "./Onboarding";

function renderOnboarding() {
  return render(
    <ToastHost>
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    </ToastHost>,
  );
}

describe("Onboarding — Welcome step", () => {
  it("starts at step 1 of 4 with the Welcome heading", () => {
    renderOnboarding();
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome to Specdex/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });
});

describe("Onboarding — Identity step", () => {
  it("enables Next only after a non-empty name is typed", () => {
    renderOnboarding();
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // 0 → 1
    expect(screen.getByPlaceholderText(/Sara Chen/i)).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Sara Chen/i), { target: { value: "Sara" } });
    expect(next).not.toBeDisabled();
  });
});

describe("Onboarding — KB-create step", () => {
  it("calls identitySet then kbCreate on Create click", async () => {
    const { identitySet, kbCreate } = await import("@/lib/tauri");
    renderOnboarding();
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // 0 → 1
    fireEvent.change(screen.getByPlaceholderText(/Sara Chen/i), { target: { value: "Sara" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // 1 → 2
    // The KB name pre-fills from the chosen template.
    fireEvent.click(screen.getByRole("button", { name: /Create/ }));
    await waitFor(() => {
      expect(identitySet).toHaveBeenCalledWith("Sara");
      expect(kbCreate).toHaveBeenCalled();
    });
  });
});
