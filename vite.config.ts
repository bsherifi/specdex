import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Tauri 2 dev requires a fixed dev-server port so the Rust process can wait
// for it deterministically. We use 1420 (Tauri's documented default).
const TAURI_DEV_PORT = 1420;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tauri opens chrome via webview; HMR over WS to the host machine.
  clearScreen: false,
  server: {
    port: TAURI_DEV_PORT,
    strictPort: true,
    host: process.env["TAURI_DEV_HOST"] ?? false,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  optimizeDeps: {
    include: ["pdfjs-dist/legacy/build/pdf.mjs"],
  },
  worker: {
    format: "es",
  },
  build: {
    target: "es2022",
    minify: !process.env["TAURI_DEBUG"] ? "esbuild" : false,
    sourcemap: !!process.env["TAURI_DEBUG"],
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    // Vitest owns unit/component tests under src/. Playwright owns e2e/ and
    // drives the app via tauri-driver, so its specs must not be collected here.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    css: false,
  },
});
