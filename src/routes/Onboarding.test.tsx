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
