import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    ignores: ["dist/**", "node_modules/**", "legacy/**"],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,mjs}"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        Buffer: "readonly",
        document: "readonly",
      },
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: { "no-restricted-globals": ["error", "chrome", "browser"] },
  },
);
