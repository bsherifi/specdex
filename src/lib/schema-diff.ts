export type FieldKind =
  | { kind: "text" }
  | { kind: "text_multiline" }
  | { kind: "number" }
  | { kind: "date" }
  | { kind: "select"; options: string[] }
  | { kind: "url" }
  | { kind: "image_attachment" };

export interface FieldDef {
  name: string;
  label: string;
  type: FieldKind;
  required: boolean;
  searchable: boolean | null;
  primary: boolean;
  _renamed_from?: string | undefined;
}

export interface Schema {
  fields: FieldDef[];
}

export interface SchemaDiff {
  added: FieldDef[];
  removed: FieldDef[];
  renamed: [string, FieldDef][];
  type_changed: [FieldDef, FieldDef][];
  options_changed: [FieldDef, FieldDef][];
  primary_changed: [string, string] | null;
}

export function diff(oldS: Schema, newS: Schema): SchemaDiff {
  const oldByName: Record<string, FieldDef> = {};
  for (const f of oldS.fields) oldByName[f.name] = f;
  const seenOld = new Set<string>();
  const added: FieldDef[] = [];
  const removed: FieldDef[] = [];
  const renamed: [string, FieldDef][] = [];
  const type_changed: [FieldDef, FieldDef][] = [];
  const options_changed: [FieldDef, FieldDef][] = [];

  for (const f of newS.fields) {
    if (f._renamed_from && oldByName[f._renamed_from]) {
      const cleared = { ...f, _renamed_from: undefined };
      renamed.push([f._renamed_from, cleared]);
      seenOld.add(f._renamed_from);
      const oldF = oldByName[f._renamed_from]!;
      if (oldF.type.kind !== f.type.kind) type_changed.push([oldF, cleared]);
      else if (
        oldF.type.kind === "select" &&
        f.type.kind === "select" &&
        JSON.stringify(oldF.type.options) !== JSON.stringify(f.type.options)
      ) {
        options_changed.push([oldF, cleared]);
      }
      continue;
    }
    const oldF = oldByName[f.name];
    if (!oldF) {
      added.push(f);
      continue;
    }
    seenOld.add(f.name);
    if (oldF.type.kind !== f.type.kind) {
      type_changed.push([oldF, f]);
    } else if (
      oldF.type.kind === "select" &&
      f.type.kind === "select" &&
      JSON.stringify(oldF.type.options) !== JSON.stringify(f.type.options)
    ) {
      options_changed.push([oldF, f]);
    }
  }

  for (const f of oldS.fields) {
    if (!seenOld.has(f.name)) removed.push(f);
  }

  const oldPrimary = oldS.fields.find((x) => x.primary)?.name;
  const newPrimary = newS.fields.find((x) => x.primary)?.name;
  const primary_changed =
    oldPrimary && newPrimary && oldPrimary !== newPrimary
      ? ([oldPrimary, newPrimary] as [string, string])
      : null;

  return { added, removed, renamed, type_changed, options_changed, primary_changed };
}

export function isEmpty(d: SchemaDiff): boolean {
  return (
    d.added.length === 0 &&
    d.removed.length === 0 &&
    d.renamed.length === 0 &&
    d.type_changed.length === 0 &&
    d.options_changed.length === 0 &&
    !d.primary_changed
  );
}
