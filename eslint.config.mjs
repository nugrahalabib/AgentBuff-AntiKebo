import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// `referensi/` hanya dibaca (template, standar, aplikasi lama): tidak pernah di-lint.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "dist/**", "next-env.d.ts", "public/vendor/**", "referensi/**", "pc/**", "playwright-report/**", "test-results/**"]),
]);
