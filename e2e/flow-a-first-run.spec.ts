import { test, expect } from "./fixtures/tauri";
import { clickByText, typeInto, expectText } from "./fixtures/helpers";

test("Flow A: first-run onboarding creates identity + first KB", async ({ driver }) => {
  // App boots → useFirstRunRedirect kicks in → /onboarding.
  await expectText(driver, "Welcome to Specdex");
  await clickByText(driver, "Next");

  // Step 2: identity
  await typeInto(driver, "input[placeholder='e.g. Sara Chen']", "Sara Chen");
  await clickByText(driver, "Next");

  // Step 3: template + name
  await clickByText(driver, "Boeing Specs");
  await clickByText(driver, "Create");

  // Step 4: done
  await expectText(driver, "You're ready");
  await clickByText(driver, "Open Specdex");

  // Land at /
  await expectText(driver, "Search entries and documents");
});
