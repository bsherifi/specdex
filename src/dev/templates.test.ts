import { describe, expect, it } from "vitest";
import { TEMPLATES, EMPTY_TEMPLATE } from "./templates";

describe("KB templates", () => {
  it("ships three named starter KBs", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(["boeing-specs", "material-codes", "internal-part-numbers"]);
  });

  it("EMPTY_TEMPLATE has exactly one primary text field", () => {
    expect(EMPTY_TEMPLATE.schema.fields).toHaveLength(1);
    expect(EMPTY_TEMPLATE.schema.fields[0]!.primary).toBe(true);
    expect(EMPTY_TEMPLATE.schema.fields[0]!.type.kind).toBe("text");
  });

  it("each starter template's primary field is text and required", () => {
    for (const t of TEMPLATES) {
      const primary = t.schema.fields.find((f) => f.primary);
      expect(primary).toBeDefined();
      expect(primary!.type.kind).toBe("text");
      expect(primary!.required).toBe(true);
    }
  });
});
