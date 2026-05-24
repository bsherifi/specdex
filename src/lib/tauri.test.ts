import { describe, expect, it, vi } from "vitest";

// Mock the generated module before importing the wrapper. tauri-specta emits a
// `commands` namespace; the field is snake_case (`git_short_sha`) because
// specta-typescript 0.0.9 mirrors the serde wire format verbatim.
vi.mock("./bindings", async () => {
  return {
    commands: {
      getAppVersion: async () => ({ app: "0.1.0", git_short_sha: null }),
    },
  };
});

import { getAppVersion } from "./tauri";

describe("tauri wrapper", () => {
  it("re-exports getAppVersion that resolves to the generated shape", async () => {
    const v = await getAppVersion();
    expect(v.app).toBe("0.1.0");
    expect(v.git_short_sha).toBeNull();
  });
});
