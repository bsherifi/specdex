import { describe, it, expect } from "vitest";
import { diff } from "./schema-diff";

describe("schema-diff", () => {
  it("detects rename via _renamed_from", () => {
    const oldS = { fields: [
      { name: "code", label: "Code", type: { kind: "text" as const }, required: true, searchable: true, primary: true },
      { name: "notes", label: "Notes", type: { kind: "text" as const }, required: false, searchable: null, primary: false },
    ]};
    const newS = { fields: [
      ...oldS.fields.slice(0, 1),
      { name: "comments", label: "Comments", type: { kind: "text" as const }, required: false, searchable: null, primary: false, _renamed_from: "notes" },
    ]};
    const d = diff(oldS, newS);
    expect(d.renamed.length).toBe(1);
    expect(d.added.length).toBe(0);
    expect(d.removed.length).toBe(0);
  });

  it("detects add+remove+type change", () => {
    const oldS = { fields: [
      { name: "code", label: "Code", type: { kind: "text" as const }, required: true, searchable: true, primary: true },
      { name: "qty", label: "Qty", type: { kind: "text" as const }, required: false, searchable: null, primary: false },
    ]};
    const newS = { fields: [
      oldS.fields[0]!,
      { name: "qty", label: "Qty", type: { kind: "number" as const }, required: false, searchable: null, primary: false },
      { name: "new_one", label: "New", type: { kind: "text" as const }, required: false, searchable: null, primary: false },
    ]};
    const d = diff(oldS, newS);
    expect(d.type_changed.length).toBe(1);
    expect(d.added.map((x) => x.name)).toEqual(["new_one"]);
  });
});
