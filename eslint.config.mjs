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
    // Archived debug scripts and utility scripts (not part of production build)
    "archive_debug_scripts/**",
    "scripts/**",
    "*.js",
    "*.ts",  // Root-level TS scripts
    "!src/**/*.ts",
    "!src/**/*.tsx",
  ]),
]);

export default eslintConfig;
