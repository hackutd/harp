import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import eslintConfigPrettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      eslintConfigPrettier,
    ],
    plugins: {
      boundaries,
      "simple-import-sort": simpleImportSort,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    settings: {
      "boundaries/elements": [
        { type: "shared", pattern: "src/shared/*" },
        { type: "components", pattern: "src/components/*" },
        { type: "layouts", pattern: "src/layouts/*" },
        { type: "pages", pattern: "src/pages/*" },
        { type: "app", pattern: "src/*.{ts,tsx}" },
        // Fork-owned brand surface. Every layer may read it; it imports
        // nothing, which is what keeps it safe for a fork to edit freely.
        { type: "branding", pattern: "branding/*" },
        // vite.config.ts — last, so the more specific patterns above win.
        { type: "config", pattern: "*.{ts,tsx}" },
      ],
    },
    rules: {
      // Short imports
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // Architecture boundaries
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            // shared/ can only import from shared/
            { from: "shared", allow: ["shared", "branding"] },

            // components/ can import from shared/, components/
            { from: "components", allow: ["shared", "components", "branding"] },

            // layouts/ can import from shared/, components/, pages/ (for shared admin components)
            {
              from: "layouts",
              allow: ["shared", "components", "pages", "branding"],
            },

            // pages/ can import from anything
            {
              from: "pages",
              allow: ["shared", "components", "layouts", "pages", "branding"],
            },

            // Root app files can import from anything
            {
              from: "app",
              allow: ["shared", "components", "layouts", "pages", "branding"],
            },

            // vite.config.ts reads branding to build the PWA manifest and to
            // substitute the index.html placeholders.
            { from: "config", allow: ["branding"] },

            // branding/ imports nothing. It is consumed by three TypeScript
            // projects with different libs (app/DOM, service worker/WebWorker,
            // vite config/node), so a dependency here would break one of them.
            { from: "branding", allow: [] },
          ],
        },
      ],

      // Prevent bad import patterns
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            // Prevent importing from old paths that no longer exist
            {
              group: ["@/lib/*", "@/hooks/*", "@/stores/*", "@/features/*"],
              message: "Use @/shared/* imports instead.",
            },
            // use barrel export
            {
              group: ["@/shared/auth/*/*"],
              message: "Import from @/shared/auth barrel export instead.",
            },
          ],
        },
      ],

      // Code quality
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
]);
