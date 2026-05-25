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

test("Flow C: receiving a PO highlights both known codes", async ({ driver }) => {
  await seedIdentity(driver);
  const kbId = await seedBoeingKb(driver);

  // Two known codes — both appear in po-fake.pdf.
  for (const code of ["BAC3082", "AMS-C-5541"]) {
    await invoke(driver, "entry_create", {
      args: { kb_id: kbId, data: { code }, aliases: [], source: null, notes: null },
    });
  }

  await ingestPathsViaJs(driver, [sample("po-fake.pdf")]);

  // Wait for the pipeline to register the doc, then locate its id.
  let docId = "";
  await waitFor(async () => {
    const docs = await invoke<{ id: string; filename: string }[]>(
      driver,
      "source_doc_list_recent",
      { limit: 10 },
    );
    const d = docs.find((x) => x.filename === "po-fake.pdf");
    if (d) docId = d.id;
    return Boolean(d);
  }, 20_000);

  // Scanner finds both codes in the document text.
  const matches = await invoke<unknown[]>(driver, "scan_document", {
    sourceDocId: docId,
    scope: { kind: "all" },
  });
  expect(matches.length).toBe(2);

  // The viewer renders one highlight overlay per match.
  await reloadHome(driver);
  await goto(driver, "/documents");
  await expectText(driver, "po-fake.pdf", 20_000);
  await driver
    .findElement(By.xpath("//*[contains(normalize-space(text()), 'po-fake.pdf')]"))
    .click();

  await waitFor(async () => {
    const els = await driver.findElements(By.css("[data-entry-id]"));
    return els.length === 2;
  }, 20_000);
});
