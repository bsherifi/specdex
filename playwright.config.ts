import { defineConfig } from "@playwright/test";

/**
 * Playwright config.
 *
 * Two projects:
 *  - "smoke" runs against the running Tauri app via tauri-driver (WebDriver).
 *  - "showcase-screenshots" captures dark + light snapshots of the design
 *    showcase. The dark variant emulates prefers-color-scheme via the
 *    fixture (we cannot read system theme from inside Tauri's webview).
 *
 * The webServer block intentionally does NOT manage Tauri; tauri-driver
 * + the Specdex binary are managed by the test fixture (e2e/fixtures/tauri.ts)
 * so test parallelism is honest.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: {
    timeout: 5_000,
  },
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts$/,
    },
    {
      name: "showcase-screenshots",
      testMatch: /screenshots\.spec\.ts$/,
    },
  ],
});
