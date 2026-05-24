import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the design showcase header", () => {
    render(<App />);
    expect(screen.getByText(/Specdex Design System/i)).toBeInTheDocument();
  });
});
