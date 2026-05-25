import { test as base, expect, type Page } from "@playwright/test";
import { _electron as electron } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { Builder, type ThenableWebDriver } from "selenium-webdriver";

/**
 * Tauri E2E fixture.
 *
 * Strategy: tauri-driver exposes a WebDriver session on http://127.0.0.1:4444.
 * We launch the Specdex binary, connect via selenium-webdriver, then build a
 * Playwright-compatible Page facade so specs can use the familiar `page.*` API
 * for locators + assertions.
 *
 * (Playwright doesn't natively speak WebDriver, but for our needs — finding
 * elements, asserting text, taking screenshots — we only need a small subset
 * which we polyfill below.)
 */

const SPECDEX_BIN = path.resolve(
  __dirname,
  "..",
  "..",
  "src-tauri",
  "target",
  "debug",
  process.platform === "win32" ? "specdex.exe" : "specdex",
);

interface TauriFixtures {
  driver: ThenableWebDriver;
  appProcess: ChildProcess;
}

export const test = base.extend<TauriFixtures>({
  appProcess: async ({}, use) => {
    // tauri-driver itself launches the binary it's pointed at via capabilities,
    // so we don't spawn the binary ourselves. We rely on scripts/run-e2e.sh
    // having started tauri-driver before pnpm exec playwright test runs.
    await use(null as unknown as ChildProcess);
  },
  driver: async ({}, use, testInfo) => {
    const tmp = path.join(
      require("os").tmpdir(),
      `specdex-e2e-${testInfo.testId}-${Date.now()}`,
    );
    require("fs").mkdirSync(tmp, { recursive: true });
    const driver = new Builder()
      .withCapabilities({
        "tauri:options": {
          application: SPECDEX_BIN,
          env: { SPECDEX_DATA_DIR: tmp },
        },
        browserName: "wry",
      })
      .usingServer("http://127.0.0.1:4444")
      .build();
    try {
      await use(driver);
    } finally {
      await driver.quit();
      try {
        require("fs").rmSync(tmp, { recursive: true, force: true });
      } catch {}
    }
  },
});

export { expect };
