import { By } from "selenium-webdriver";
import { test } from "./fixtures/tauri";
import {
  invoke,
  seedIdentity,
  seedBoeingKb,
  reloadHome,
  goto,
  clickByText,
  waitFor,
} from "./fixtures/helpers";

const APPLY_BTN = By.xpath("//button[normalize-space()='Apply']");

test("Flow F: edit a KB schema and apply the migration", async ({ driver }) => {
  await seedIdentity(driver);
  const kbId = await seedBoeingKb(driver);

  await reloadHome(driver);
  await goto(driver, "/kbs");
  await goto(driver, `/kbs/${kbId}`);

  // KB detail → schema editor → add a field → open the migration dialog.
  await clickByText(driver, "Edit schema");
  await clickByText(driver, "Add field");
  await clickByText(driver, "Save");

  // Confirm the migration (adding a field is not data-lossy, so Apply is
  // enabled immediately).
  await waitFor(async () => (await driver.findElements(APPLY_BTN)).length > 0, 5_000);
  await driver.findElement(APPLY_BTN).click();

  // The KB now has the added field persisted (schema is a bare FieldDef[]).
  await waitFor(async () => {
    const kb = await invoke<{ schema: unknown[] }>(driver, "kb_get", { kbId });
    return kb.schema.length === 2;
  }, 10_000);
});
