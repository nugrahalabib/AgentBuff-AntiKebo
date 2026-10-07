import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { buatPengguna, siapkanBasisData } from "./harness";

// Gerbang deploy (deploy/uji-rls.sql) dijalankan di sini juga: berkas yang rusak
// ketahuan sebelum deploy, bukan saat deploy di produksi. CI juga menjalankannya
// terhadap Postgres 16 sungguhan.

describe("isolasi data (RLS) dengan peran tanpa BYPASSRLS", () => {
  it("deploy/uji-rls.sql lulus terhadap migrasi asli", async () => {
    const u = await siapkanBasisData();
    const sqlUji = readFileSync(path.resolve(import.meta.dirname, "../../deploy/uji-rls.sql"), "utf8");
    await expect(u.pg.exec(sqlUji)).resolves.toBeTruthy();
  }, 60_000);

  it("transaksi uji benar-benar berjalan sebagai antikebo_app tanpa BYPASSRLS", async () => {
    const u = await siapkanBasisData();
    const [r] = await u.jalan(null, async (tx) => {
      const h = await tx.execute(
        sql`select current_user as peran, (select rolbypassrls from pg_roles where rolname = current_user) as bypass, (select rolsuper from pg_roles where rolname = current_user) as super`,
      );
      return (h as unknown as { rows: Array<{ peran: string; bypass: boolean; super: boolean }> }).rows;
    });
    expect(r).toEqual({ peran: "antikebo_app", bypass: false, super: false });
  }, 60_000);

  it("pemilik lain tidak melihat token dan audit milik A, worker melihat semua", async () => {
    const u = await siapkanBasisData();
    const A = await buatPengguna(u, "A");
    const B = await buatPengguna(u, "B");
    await u.jalan(A, (tx) => tx.insert(schema.tokenMcp).values({ penggunaId: A, label: "uji", hash: "a".repeat(64), awalan: "antikebo_aaaa", sumber: "manual" }));
    await u.jalan(A, (tx) => tx.insert(schema.audit).values({ penggunaId: A, sumber: "web", jenis: "lainnya", ringkasan: "punya A" }));
    expect(await u.jalan(B, async (tx) => (await tx.select().from(schema.tokenMcp)).length)).toBe(0);
    expect(await u.jalan(B, async (tx) => (await tx.select().from(schema.audit)).length)).toBe(0);
    expect(await u.jalan(null, async (tx) => (await tx.select().from(schema.audit)).length)).toBe(0);
    expect(await u.jalan(A, async (tx) => (await tx.select().from(schema.audit)).length)).toBe(1);
    expect(await u.pekerja(async (tx) => (await tx.select().from(schema.tokenMcp)).length)).toBe(1);
    // B tidak bisa menulis atas nama A.
    await expect(u.jalan(B, (tx) => tx.insert(schema.audit).values({ penggunaId: A, sumber: "web", jenis: "lainnya", ringkasan: "palsu" }))).rejects.toThrow();
  }, 60_000);
});
