import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title, description, and optional action", () => {
    render(
      <EmptyState
        title="No knowledge bases yet"
        description="Create your first KB to start ingesting documents."
        action={<button>Create KB</button>}
      />,
    );
    expect(screen.getByText("No knowledge bases yet")).toBeInTheDocument();
    expect(screen.getByText(/Create your first KB/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create KB" })).toBeInTheDocument();
  });
});
