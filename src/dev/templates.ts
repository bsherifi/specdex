import type { FieldDef, Schema } from "@/lib/schema-diff";

export interface KbTemplate {
  id: string;
  name: string;
  description: string;
  defaultColor: string; // hex
  schema: Schema;
}

const text = (name: string, label: string, primary = false, required = primary): FieldDef => ({
  name,
  label,
  type: { kind: "text" },
  required,
  searchable: primary ? true : null,
  primary,
});

const multiline = (name: string, label: string): FieldDef => ({
  name,
  label,
  type: { kind: "text_multiline" },
  required: false,
  searchable: true,
  primary: false,
});

const select = (name: string, label: string, options: string[]): FieldDef => ({
  name,
  label,
  type: { kind: "select", options },
  required: false,
  searchable: true,
  primary: false,
});

export const TEMPLATES: KbTemplate[] = [
  {
    id: "boeing-specs",
    name: "Boeing Specs",
    description: "BAC and AMS codes referenced by Boeing OEM/supplier documents.",
    defaultColor: "#f59e0b",
    schema: {
      fields: [
        text("code", "Code", true),
        multiline("definition", "Definition"),
        select("category", "Category", ["process", "material", "finish", "standard"]),
        text("revision", "Revision"),
      ],
    },
  },
  {
    id: "material-codes",
    name: "Material Codes",
    description: "AMS-, MIL-, ASTM-, and internal alloy / coating codes.",
    defaultColor: "#10b981",
    schema: {
      fields: [
        text("code", "Code", true),
        multiline("definition", "Definition"),
        select("category", "Category", ["alloy", "coating", "polymer", "composite"]),
      ],
    },
  },
  {
    id: "internal-part-numbers",
    name: "Internal Part Numbers",
    description: "Your shop's part numbers, drawing references, and BOM tags.",
    defaultColor: "#38bdf8",
    schema: {
      fields: [
        text("part_number", "Part number", true),
        multiline("description", "Description"),
        text("drawing_ref", "Drawing reference"),
      ],
    },
  },
];

export const EMPTY_TEMPLATE: KbTemplate = {
  id: "empty",
  name: "Empty",
  description: "Start with just a primary code field; add fields later.",
  defaultColor: "#f59e0b",
  schema: { fields: [text("code", "Code", true)] },
};
