import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Migrasi AntiKebo: dijalankan sebagai `antikebo_migrasi` (pemilik tabel, BUKAN
// superuser, tanpa BYPASSRLS). HANYA aditif; tidak pernah `drizzle push`.
//
//   DATABASE_URL_MIGRASI=postgres://antikebo_migrasi:...@host/antikebo  node dist/migrasi.mjs
const FOLDER = process.env.ANTIKEBO_FOLDER_MIGRASI ?? path.resolve(process.cwd(), "src/lib/db/migrasi");

async function utama() {
  const url = process.env.DATABASE_URL_MIGRASI;
  if (!url) throw new Error("DATABASE_URL_MIGRASI wajib diisi");
  const klien = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(klien);
  try {
    await migrate(db, { migrationsFolder: FOLDER });
    const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    console.log(`migrasi selesai (${n} berkas tercatat)`);
  } finally {
    await klien.end({ timeout: 5 });
  }
}

utama().catch((e) => {
  console.error("MIGRASI GAGAL:", (e as Error)?.message ?? e);
  process.exit(1);
});
