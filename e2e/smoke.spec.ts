import { By, until } from "selenium-webdriver";
import { test, expect } from "./fixtures/tauri";

test("design showcase loads and shows the marker header", async ({ driver }) => {
  await driver.wait(until.elementLocated(By.css("h1")), 10_000);
  const heading = await driver.findElement(By.css("h1")).getText();
  expect(heading).toMatch(/Specdex Design System/i);
});
