import fs from "node:fs";
import path from "node:path";
import { By, until } from "selenium-webdriver";
import { test, expect } from "./fixtures/tauri";

const OUT_DIR = path.resolve(__dirname, "..", "docs", "design");

async function snap(driver: import("selenium-webdriver").WebDriver, file: string): Promise<void> {
  await driver.wait(until.elementLocated(By.css("h1")), 10_000);
  // Give Tailwind a beat to settle after class-flip.
  await new Promise((r) => setTimeout(r, 300));
  const b64 = await driver.takeScreenshot();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, file), Buffer.from(b64, "base64"));
}

test("capture light-mode showcase", async ({ driver }) => {
  // Default is light — useSystemTheme reads prefers-color-scheme which
  // is "light" by default in WebKitWebDriver's prefs.
  await driver.executeScript("document.documentElement.classList.remove('dark');");
  await snap(driver, "showcase-light.png");
  const stat = fs.statSync(path.join(OUT_DIR, "showcase-light.png"));
  expect(stat.size).toBeGreaterThan(10_000);
});

test("capture dark-mode showcase", async ({ driver }) => {
  await driver.executeScript("document.documentElement.classList.add('dark');");
  await snap(driver, "showcase-dark.png");
  const stat = fs.statSync(path.join(OUT_DIR, "showcase-dark.png"));
  expect(stat.size).toBeGreaterThan(10_000);
});
