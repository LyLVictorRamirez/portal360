import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/.test-dist/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/*.d.ts",
      "**/*.tsbuildinfo",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
);
