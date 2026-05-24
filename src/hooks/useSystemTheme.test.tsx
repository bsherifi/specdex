import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSystemTheme } from "./useSystemTheme";

type ChangeListener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<ChangeListener>();
  const mql = {
    matches: dark,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (_e: string, l: ChangeListener) => listeners.add(l),
    removeEventListener: (_e: string, l: ChangeListener) => listeners.delete(l),
    addListener: (l: ChangeListener) => listeners.add(l),
    removeListener: (l: ChangeListener) => listeners.delete(l),
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });
  return {
    set: (next: boolean) => {
      dark = next;
      (mql as { matches: boolean }).matches = next;
      listeners.forEach((l) => l({ matches: next } as MediaQueryListEvent));
    },
  };
}

describe("useSystemTheme", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 'dark' when system prefers dark and toggles the root class", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useSystemTheme());
    expect(result.current).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("flips when the media query changes", () => {
    const mq = mockMatchMedia(false);
    const { result } = renderHook(() => useSystemTheme());
    expect(result.current).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => mq.set(true));
    expect(result.current).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
