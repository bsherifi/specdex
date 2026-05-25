import { By, until, type WebDriver } from "selenium-webdriver";

export async function clickByText(driver: WebDriver, text: string, timeoutMs = 5_000) {
  const el = await driver.wait(
    until.elementLocated(
      By.xpath(`//*[contains(normalize-space(text()), ${JSON.stringify(text)})]`),
    ),
    timeoutMs,
  );
  await el.click();
}

export async function typeInto(driver: WebDriver, selector: string, value: string) {
  const el = await driver.wait(until.elementLocated(By.css(selector)), 5_000);
  await el.clear();
  await el.sendKeys(value);
}

export async function expectText(driver: WebDriver, text: string, timeoutMs = 5_000) {
  await driver.wait(
    until.elementLocated(
      By.xpath(`//*[contains(normalize-space(text()), ${JSON.stringify(text)})]`),
    ),
    timeoutMs,
  );
}

export async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 5_000, intervalMs = 100) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("waitFor timeout");
}

/// Tauri drop event isn't exposed via WebDriver. As a workaround, we invoke
/// the `ingest_files` command directly via JS in the webview.
export async function ingestPathsViaJs(driver: WebDriver, paths: string[], ocr = false) {
  await driver.executeAsyncScript(
    async (paths: string[], ocr: boolean, done: (value: unknown) => void) => {
      // window.__TAURI_INVOKE__ is populated when tauri-specta wires invoke();
      // call the underlying core directly.
      const invoke = (window as unknown as { __TAURI_INTERNALS__: { invoke: (n: string, a: unknown) => Promise<unknown> } })
        .__TAURI_INTERNALS__.invoke;
      const res = await invoke("ingest_files", {
        args: { files: paths.map((p) => ({ path: p, ocr })) },
      });
      done(res);
    },
    paths,
    ocr,
  );
}

/// Generic invoke into the Tauri core from inside the webview. Used by the
/// derived flows (B–G) to pre-seed state — identity, KBs, entries — without
/// driving the full UI for setup, which keeps each flow fast and focused on
/// the one path it asserts. Mirrors `ingestPathsViaJs`'s invoke shape.
export async function invoke<T = unknown>(
  driver: WebDriver,
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return (await driver.executeAsyncScript(
    async (command: string, args: unknown, done: (value: unknown) => void) => {
      const inv = (window as unknown as {
        __TAURI_INTERNALS__: { invoke: (n: string, a: unknown) => Promise<unknown> };
      }).__TAURI_INTERNALS__.invoke;
      done(await inv(command, args));
    },
    command,
    args,
  )) as T;
}

/// Boeing-style schema with a single primary `code` field. `Schema` is
/// `#[serde(transparent)]` over `Vec<FieldDef>` in core, so the wire shape is
/// a bare array (not `{ fields: [...] }`).
export const BOEING_SCHEMA = [
  { name: "code", label: "Code", type: { kind: "text" }, required: true, primary: true },
];

/// Pre-seed identity (skips the onboarding identity step for flows that only
/// assert a later path).
export async function seedIdentity(driver: WebDriver, displayName = "Sara Chen") {
  await invoke(driver, "identity_set", { displayName });
}

/// Pre-seed a Boeing-style KB and return its id.
export async function seedBoeingKb(
  driver: WebDriver,
  name = "Boeing Specs",
): Promise<string> {
  const kb = await invoke<{ id: string }>(driver, "kb_create", {
    args: { name, description: null, schema: BOEING_SCHEMA, highlight_color: "#f59e0b" },
  });
  return kb.id;
}

/// Reload the SPA at `/`. After identity + KB are seeded, `useFirstRunRedirect`
/// no longer bounces to /onboarding, so this lands on the populated app with
/// the sidebar chrome (deep-link reloads aren't guaranteed, but `/` always is).
export async function reloadHome(driver: WebDriver) {
  await driver.executeScript("window.location.assign('/')");
  await driver.wait(until.elementLocated(By.css("a[href='/documents']")), 10_000);
}

/// Navigate by clicking the sidebar link for a route (react-router owns
/// history; a hard `location.assign` would full-reload the SPA). Falls back
/// to any anchor whose href matches when the link isn't in the sidebar.
export async function goto(driver: WebDriver, href: string) {
  const el = await driver.wait(
    until.elementLocated(By.css(`a[href=${JSON.stringify(href)}]`)),
    5_000,
  );
  await el.click();
}
