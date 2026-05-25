import { test } from "./fixtures/tauri";
import {
  invoke,
  seedIdentity,
  seedBoeingKb,
  reloadHome,
  typeInto,
  expectText,
} from "./fixtures/helpers";

test("Flow D: quick lookup finds a seeded entry from search", async ({ driver }) => {
  await seedIdentity(driver);
  const kbId = await seedBoeingKb(driver);
  await invoke(driver, "entry_create", {
    args: { kb_id: kbId, data: { code: "BAC3082" }, aliases: [], source: null, notes: null },
  });

  await reloadHome(driver);

  // Home (`/`) is the search route; type into its box and the hit appears.
  await typeInto(driver, "input[placeholder^='Search entries']", "BAC3082");
  await expectText(driver, "BAC3082", 10_000);
});
