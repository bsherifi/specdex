import os from "node:os";
import path from "node:path";
import { test, expect } from "./fixtures/tauri";
import { invoke, seedIdentity, seedBoeingKb } from "./fixtures/helpers";

const listArgs = (kbId: string) => ({
  kb_id: kbId,
  filter: null,
  source_doc_id: null,
  limit: null,
  offset: null,
});

test("Flow G: backup, wipe, restore round-trips a KB + entry", async ({ driver }) => {
  const zipPath = path.join(os.tmpdir(), `specdex-backup-${Date.now()}.zip`);

  await seedIdentity(driver);
  const kbId = await seedBoeingKb(driver);
  await invoke(driver, "entry_create", {
    args: { kb_id: kbId, data: { code: "BAC3082" }, aliases: [], source: null, notes: null },
  });

  // Back up everything to a temp zip.
  await invoke(driver, "backup_export", { outPath: zipPath });

  // Wipe: delete the KB.
  await invoke(driver, "kb_delete", { kbId });
  expect((await invoke<unknown[]>(driver, "kb_list")).length).toBe(0);

  // Restore from the zip → KB + entry come back.
  await invoke(driver, "backup_restore", { zipPath });
  const kbs = await invoke<{ id: string; name: string }[]>(driver, "kb_list");
  const restored = kbs.find((k) => k.name === "Boeing Specs");
  expect(restored).toBeTruthy();

  const entries = await invoke<unknown[]>(driver, "entry_list", {
    args: listArgs(restored!.id),
  });
  expect(entries.length).toBe(1);
});
