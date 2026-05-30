import { test, expect } from "./fixtures/tauri";
import { invoke, seedIdentity, seedBoeingKb } from "./fixtures/helpers";

test("Flow E: export a KB to JSON and re-import it", async ({ driver }) => {
  await seedIdentity(driver);
  const kbId = await seedBoeingKb(driver);
  await invoke(driver, "entry_create", {
    args: { kb_id: kbId, data: { code: "BAC3082" }, aliases: [], source: null, notes: null },
  });

  // Export → import. Import suffixes the name with " (imported)".
  const exported = await invoke<unknown>(driver, "kb_export_json", { kbId });
  await invoke(driver, "kb_import_json", { json: JSON.stringify(exported) });

  const kbs = await invoke<{ name: string }[]>(driver, "kb_list");
  expect(kbs.some((k) => k.name.endsWith("(imported)"))).toBe(true);
});
