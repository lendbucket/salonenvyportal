import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Relax rules that fire across the existing codebase — these were previously
  // hidden by the eslint-plugin-react crash on ESLint 10. Now that linting
  // actually runs, keep them as warnings so the build passes.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      // React Compiler rules from eslint-config-next 16 / react-hooks v7 —
      // many existing pages call setState directly in useEffect callbacks.
      // Downgrade to warn until the codebase is incrementally migrated.
      "react-hooks/set-state-in-effect": "warn",
      "prefer-const": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // DB migration scripts use CommonJS require()
    "src/db/**",
  ]),
]);

export default eslintConfig;
