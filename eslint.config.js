import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig([
  globalIgnores(["engine/vendor/**", "dist/**", "playwright-report/**", "test-results/**"]),
  js.configs.recommended,
  {
    files: ["background.js", "settings.js", "content/**/*.js", "engine/**/*.js", "ui/**/*.js", "tests/e2e/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: "readonly",
        LGPEditor: "readonly",
        LGPMarks: "readonly",
        LGPSettings: "readonly"
      }
    }
  },
  {
    files: ["scripts/**/*.js", "tests/**/*.js", "playwright.config.js"],
    languageOptions: { globals: globals.nodeBuiltin }
  }
]);
