import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
    settings: {
      react: { version: "19.0" },
    },
  },
  {
    // Vendored shadcn/ui primitives mirror upstream output verbatim. They lean on
    // DOM lib types in type positions (which the base `no-undef` rule misreports —
    // typescript-eslint recommends disabling it for TS) and skip prop-types (TS
    // handles prop validation). Relax both for this directory only.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-undef": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      // cmdk drives styling via custom DOM attributes (e.g. cmdk-input-wrapper).
      "react/no-unknown-property": "off",
    },
  },
  {
    ignores: ["dist", "node_modules", "src-tauri/target", "src/lib/bindings.ts"],
  },
];
