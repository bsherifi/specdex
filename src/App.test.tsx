import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the wave-0 marker banner", () => {
    render(<App />);
    expect(screen.getByText(/specdex shell ready/i)).toBeInTheDocument();
  });
});
