import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit + integrasi. Uji peramban (Playwright) ada di tests/e2e/*.spec.ts dan dijalankan `pnpm test:e2e`.
// `referensi/` tidak pernah ikut diuji.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "referensi/**", "tests/e2e/**"],
    environment: "node",
  },
});
