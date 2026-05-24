import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia, but useSystemTheme reads it on mount.
// Provide a default light-mode stub so components that resolve the system theme
// render in tests. Tests that exercise theme switching install their own mock.
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
