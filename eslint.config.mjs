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
    // Anchor TS tests use deliberately loose typing because the IDL-generated
    // types (added by `anchor build`) don't fully line up with our PDA layout
    // (e.g. `oracle` UncheckedAccount alongside `oracleSigner`). Lint after
    // anchor build emits `target/types/indie_pool.ts`.
    "tests/**",
    "target/**",
    "programs/**",
  ]),
]);

export default eslintConfig;
