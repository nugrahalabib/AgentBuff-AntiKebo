import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { siapkanBasisData } from "./harness";

// Gerbang deploy (deploy/uji-rls.sql) dijalankan di sini juga: berkas yang rusak
// ketahuan sebelum deploy, bukan saat deploy di produksi.
it("deploy/uji-rls.sql lulus terhadap migrasi asli", async () => {
  const u = await siapkanBasisData();
  const sqlUji = readFileSync(path.resolve(import.meta.dirname, "../../deploy/uji-rls.sql"), "utf8");
  await expect(u.pg.exec(sqlUji)).resolves.toBeTruthy();
}, 60_000);
