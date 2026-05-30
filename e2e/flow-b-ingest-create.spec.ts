import path from "node:path";
import { By } from "selenium-webdriver";
import { test, expect } from "./fixtures/tauri";
import {
  invoke,
  ingestPathsViaJs,
  seedIdentity,
  seedBoeingKb,
  reloadHome,
  goto,
  expectText,
  waitFor,
} from "./fixtures/helpers";

const sample = (f: string) => path.resolve(__dirname, "fixtures", "sample-pdfs", f);

test("Flow B: ingest a PDF, open it, create an entry", async ({ driver }) => {
  // Pre-seed identity + KB via core (faster than driving onboarding for setup).
  await seedIdentity(driver);
  const kbId = await seedBoeingKb(driver);

  // Ingest the sample PDF, then reload into the populated app.
  await ingestPathsViaJs(driver, [sample("bac3082-fake.pdf")]);
  await reloadHome(driver);

  // Documents list shows the ingested file once the pipeline finishes.
  await goto(driver, "/documents");
  await expectText(driver, "bac3082-fake.pdf", 20_000);

  // Open the document → /documents/:id.
  await driver
    .findElement(By.xpath("//*[contains(normalize-space(text()), 'bac3082-fake.pdf')]"))
    .click();

  // Create an entry; the KB's entry list reflects it.
  const res = await invoke<{ entry: { primary_value: string } }>(driver, "entry_create", {
    args: { kb_id: kbId, data: { code: "BAC3082" }, aliases: [], source: null, notes: null },
  });
  expect(res.entry.primary_value).toBe("BAC3082");

  await waitFor(async () => {
    const entries = await invoke<unknown[]>(driver, "entry_list", {
      args: { kb_id: kbId, filter: null, source_doc_id: null, limit: null, offset: null },
    });
    return entries.length === 1;
  }, 10_000);
});
