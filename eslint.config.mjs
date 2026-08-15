import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build-time Node tools, not application code. They are CommonJS and run
    // by hand with `node`, so the app's ES-module and React rules do not apply
    // — `no-require-imports` in particular would be asking a `.cjs` file not to
    // be one.
    "scripts/**",
  ]),
]);

export default eslintConfig;
