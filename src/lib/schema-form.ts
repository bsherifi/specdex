import type { FieldDef, Schema } from "./schema-diff";

export interface EntryFormValue {
  [field: string]: unknown;
}

export interface FieldError {
  field: string;
  message: string;
}

export function initialValue(schema: Schema, existing?: EntryFormValue): EntryFormValue {
  const v: EntryFormValue = {};
  for (const f of schema.fields) {
    if (existing && f.name in existing) {
      v[f.name] = existing[f.name];
    } else {
      v[f.name] = defaultForField(f);
    }
  }
  return v;
}

export function defaultForField(f: FieldDef): unknown {
  switch (f.type.kind) {
    case "number":
      return null;
    case "date":
      return "";
    case "select":
      return "";
    default:
      return "";
  }
}

export function validate(schema: Schema, value: EntryFormValue): FieldError[] {
  const errs: FieldError[] = [];
  for (const f of schema.fields) {
    const raw = value[f.name];
    if (f.required) {
      if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
        errs.push({ field: f.name, message: "Required" });
        continue;
      }
    }
    if (raw === undefined || raw === null || raw === "") continue;
    switch (f.type.kind) {
      case "number":
        if (typeof raw !== "number" || Number.isNaN(raw)) {
          errs.push({ field: f.name, message: "Must be a number" });
        }
        break;
      case "date":
        if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          errs.push({ field: f.name, message: "Must be YYYY-MM-DD" });
        }
        break;
      case "select":
        if (typeof raw !== "string" || !f.type.options.includes(raw)) {
          errs.push({ field: f.name, message: "Must be one of the options" });
        }
        break;
      case "url":
        if (typeof raw !== "string" || !/^https?:\/\//i.test(raw)) {
          errs.push({ field: f.name, message: "Must be a URL" });
        }
        break;
      default:
        if (typeof raw !== "string") errs.push({ field: f.name, message: "Must be text" });
    }
  }
  return errs;
}
