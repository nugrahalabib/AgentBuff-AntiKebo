import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

// Satu kolam koneksi per proses. Web tersambung sebagai `antikebo_app`, worker
// sebagai `antikebo_worker`; keduanya BUKAN pemilik tabel dan tanpa BYPASSRLS.
// Isolasi antar-pemilik ditegakkan dua lapis: helper di bawah (SET LOCAL
// konteks) + kebijakan RLS di basis data (migrasi 0001).

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

declare global {
  var __antikeboSql: ReturnType<typeof postgres> | undefined;
}

function buatKoneksi() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi");
  return postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: true,
    onnotice: () => {},
  });
}

export function klienSql() {
  if (!globalThis.__antikeboSql) globalThis.__antikeboSql = buatKoneksi();
  return globalThis.__antikeboSql;
}

let _db: Db | undefined;
/** Akses TANPA konteks pemilik: hanya untuk tabel global (pengguna, sesi, status_hak, jti_terpakai, detak_worker). */
export function db(): Db {
  if (!_db) _db = drizzle(klienSql(), { schema });
  return _db;
}

/** Ganti basis data (uji integrasi memakai PGlite). */
export function pasangDbUji(pengganti: Db | undefined) {
  _db = pengganti;
}

/** Jalankan `fn` dalam transaksi dengan konteks satu pemilik. */
export async function denganPengguna<T>(penggunaId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!penggunaId) throw new Error("denganPengguna: penggunaId kosong");
  return db().transaction(async (tx) => {
    // set_config(..., true) = SET LOCAL: hilang saat transaksi selesai, jadi
    // koneksi yang dipakai ulang kolam tidak membawa konteks orang lain.
    await tx.execute(sql`select set_config('app.pengguna_id', ${penggunaId}, true)`);
    return fn(tx);
  });
}

/** Konteks "hash token" saja: satu baris token_mcp terlihat untuk otentikasi MCP. */
export async function denganHashToken<T>(hash: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.token_hash', ${hash}, true)`);
    return fn(tx);
  });
}

/**
 * Baris hasil `tx.execute(sql...)`. postgres-js mengembalikan larik, PGlite
 * mengembalikan `{ rows }`: satu pembantu supaya layanan tidak bergantung pada driver.
 */
export function barisDari<T>(hasil: unknown): T[] {
  if (Array.isArray(hasil)) return hasil as T[];
  const r = (hasil as { rows?: unknown[] } | null)?.rows;
  return (Array.isArray(r) ? r : []) as T[];
}

export { schema };
