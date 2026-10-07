import { defineConfig } from "drizzle-kit";

// Hanya untuk `drizzle-kit generate` (menghasilkan SQL yang DITINJAU manusia).
// Tidak pernah `drizzle-kit push` ke produksi: migrasi aditif lewat scripts/migrasi.ts.
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrasi",
  dialect: "postgresql",
  casing: "snake_case",
});
