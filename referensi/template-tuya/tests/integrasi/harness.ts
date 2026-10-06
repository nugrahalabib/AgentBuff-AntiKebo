import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";
import { pasangDbUji, type Db, type Tx } from "@/lib/db";

// Basis data uji di dalam proses (PGlite = PostgreSQL sungguhan di WASM).
// Migrasi ASLI dijalankan apa adanya sebagai `tuya_migrasi`, lalu transaksi uji
// memakai peran `tuya_app` (tanpa BYPASSRLS) - RLS benar-benar diuji.

const FOLDER = path.resolve(import.meta.dirname, "../../src/lib/db/migrasi");

export type Ujian = {
  jalan<T>(penggunaId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T>;
  pekerja<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  superuser: ReturnType<typeof drizzle<typeof schema>>;
  pg: PGlite;
};

export async function siapkanBasisData(): Promise<Ujian> {
  const pg = await PGlite.create({ extensions: { citext } });
  await pg.exec(`
    create role tuya_app nosuperuser nobypassrls;
    create role tuya_worker nosuperuser nobypassrls;
    create role tuya_migrasi nosuperuser nobypassrls;
    grant usage on schema public to tuya_app, tuya_worker;
    alter schema public owner to tuya_migrasi;
    alter default privileges for role tuya_migrasi in schema public grant select, insert, update, delete on tables to tuya_app, tuya_worker;
    alter default privileges for role tuya_migrasi in schema public grant usage, select on sequences to tuya_app, tuya_worker;
    alter default privileges for role tuya_migrasi in schema public grant execute on functions to tuya_app, tuya_worker;
    do $$ begin execute format('grant create on database %I to tuya_migrasi', current_database()); end $$;
  `);
  const berkas = readdirSync(FOLDER)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  await pg.exec("create extension if not exists citext");
  await pg.exec("set role tuya_migrasi");
  for (const f of berkas) {
    const isi = readFileSync(path.join(FOLDER, f), "utf8");
    for (const perintah of isi.split("--> statement-breakpoint")) {
      if (!perintah.trim() || /^\s*CREATE EXTENSION/i.test(perintah.trim())) continue;
      await pg.exec(perintah);
    }
  }
  await pg.exec("reset role");
  const db = drizzle(pg, { schema });
  const sebagai =
    (peran: "tuya_app" | "tuya_worker") =>
    async <T>(penggunaId: string | null, fn: (tx: Tx) => Promise<T>) =>
      db.transaction(async (tx) => {
        await tx.execute(sql.raw(`set local role ${peran}`));
        await tx.execute(sql`select set_config('app.pengguna_id', ${penggunaId ?? ""}, true)`);
        return fn(tx as unknown as Tx);
      });
  return { jalan: sebagai("tuya_app"), pekerja: (fn) => sebagai("tuya_worker")(null, fn), superuser: db, pg };
}

/** Arahkan `db()` aplikasi ke PGlite sebagai `tuya_app` (untuk menguji layanan apa adanya). */
export function arahkanDbAplikasi(u: Ujian, peran: "tuya_app" | "tuya_worker" = "tuya_app") {
  // Setiap transaksi aplikasi turun peran (web = tuya_app, worker = tuya_worker), sama seperti produksi.
  const asli = u.superuser.transaction.bind(u.superuser);
  const pembungkus = Object.create(u.superuser) as Db;
  (pembungkus as unknown as { transaction: typeof asli }).transaction = ((fn: (tx: Tx) => Promise<unknown>) =>
    asli(async (tx) => {
      await tx.execute(sql.raw(`set local role ${peran}`));
      return fn(tx as unknown as Tx);
    })) as unknown as typeof asli;
  pasangDbUji(pembungkus);
}

export async function buatPengguna(u: Ujian, nama = "Uji"): Promise<string> {
  const id = crypto.randomUUID();
  await u.superuser.insert(schema.pengguna).values({ id, agentbuffSub: `tuya_${id}`, email: `${id}@uji.internal`, nama });
  return id;
}
