import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KbBadge } from "./KbBadge";

describe("KbBadge", () => {
  it("renders the KB name and applies a colored swatch by KB color name", () => {
    render(<KbBadge name="Boeing Specs" color="amber" />);
    const badge = screen.getByText("Boeing Specs");
    expect(badge).toBeInTheDocument();
    expect(badge.closest("[data-kb-color]")?.getAttribute("data-kb-color")).toBe("amber");
  });
});
