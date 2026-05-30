import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia, but next-themes reads it on mount to
// resolve the system theme. Provide a default light-mode stub so themed
// components render in tests. Tests that exercise theme switching mock their own.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}
