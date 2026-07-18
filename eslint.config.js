import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "src/wasm", "vtracer-wasm/target", "vtracer-wasm/pkg"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
    },
  },
  {
    files: ["tests/**", "**/*.test.ts", "**/*.test.tsx", "vite.config.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  prettier,
);
