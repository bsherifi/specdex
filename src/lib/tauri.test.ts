import { describe, expect, it, vi } from "vitest";

// Mock the generated module before importing the wrapper. tauri-specta emits a
// `commands` namespace; the field is snake_case (`git_short_sha`) because
// specta-typescript 0.0.9 mirrors the serde wire format verbatim.
//
// `tauri.ts` resolves every command eagerly at import via `pick`, so the mock
// supplies a stub for any command name through a Proxy while keeping the real
// `getAppVersion` shape that the assertion below checks.
vi.mock("./bindings", async () => {
  const known: Record<string, (...args: unknown[]) => Promise<unknown>> = {
    getAppVersion: async () => ({ app: "0.1.0", git_short_sha: null }),
  };
  return {
    commands: new Proxy(known, {
      get: (target, prop) =>
        Reflect.get(target, prop) ??
        (typeof prop === "string" ? async () => undefined : undefined),
    }),
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
