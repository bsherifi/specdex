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
