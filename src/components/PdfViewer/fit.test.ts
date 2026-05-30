import { describe, expect, it } from "vitest";
import { fitWidthScale, fitPageScale, resolveScale } from "./fit";

describe("fit", () => {
  it("fit-to-width divides usable width by page width", () => {
    expect(fitWidthScale(1000, 612, 24)).toBeCloseTo((1000 - 24) / 612);
  });

  it("fit-page takes the smaller of width/height fit", () => {
    // Tall page → height is the limiting dimension.
    expect(fitPageScale(1000, 500, 612, 792, 24)).toBeCloseTo((500 - 24) / 792);
  });

  it("resolveScale honors an absolute scale preset", () => {
    expect(resolveScale({ kind: "scale", value: 1.5 }, 1000, 500, 612, 792, 24)).toBe(1.5);
  });

  it("never returns a non-positive scale", () => {
    expect(fitWidthScale(0, 612, 24)).toBeGreaterThan(0);
  });
});
