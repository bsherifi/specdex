import { describe, expect, it } from "vitest";
import { stepIndex } from "./find-nav";

describe("stepIndex", () => {
  it("advances and wraps forward 2→0 of 3", () => {
    expect(stepIndex(2, 3, 1)).toBe(0);
  });
  it("wraps backward 0→2 of 3", () => {
    expect(stepIndex(0, 3, -1)).toBe(2);
  });
  it("from null goes to first (forward) or last (backward)", () => {
    expect(stepIndex(null, 3, 1)).toBe(0);
    expect(stepIndex(null, 3, -1)).toBe(2);
  });
  it("returns null when there are no matches", () => {
    expect(stepIndex(null, 0, 1)).toBeNull();
    expect(stepIndex(1, 0, 1)).toBeNull();
  });
});
