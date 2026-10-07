import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";
import { pasangDbUji, type Db, type Tx } from "@/lib/db";

// Basis data uji di dalam proses (PGlite = PostgreSQL sungguhan di WASM).
// Migrasi ASLI dijalankan apa adanya sebagai `antikebo_migrasi`, lalu transaksi uji
// memakai peran `antikebo_app` / `antikebo_worker` (tanpa BYPASSRLS): RLS benar-benar diuji.

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
    create role antikebo_app nosuperuser nobypassrls;
    create role antikebo_worker nosuperuser nobypassrls;
    create role antikebo_migrasi nosuperuser nobypassrls;
    grant usage on schema public to antikebo_app, antikebo_worker;
    alter schema public owner to antikebo_migrasi;
    alter default privileges for role antikebo_migrasi in schema public grant select, insert, update, delete on tables to antikebo_app, antikebo_worker;
    alter default privileges for role antikebo_migrasi in schema public grant usage, select on sequences to antikebo_app, antikebo_worker;
    alter default privileges for role antikebo_migrasi in schema public grant execute on functions to antikebo_app, antikebo_worker;
    do $$ begin execute format('grant create on database %I to antikebo_migrasi', current_database()); end $$;
  `);
  const berkas = readdirSync(FOLDER)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  await pg.exec("create extension if not exists citext");
  await pg.exec("set role antikebo_migrasi");
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
    (peran: "antikebo_app" | "antikebo_worker") =>
    async <T>(penggunaId: string | null, fn: (tx: Tx) => Promise<T>) =>
      db.transaction(async (tx) => {
        await tx.execute(sql.raw(`set local role ${peran}`));
        await tx.execute(sql`select set_config('app.pengguna_id', ${penggunaId ?? ""}, true)`);
        return fn(tx as unknown as Tx);
      });
  return { jalan: sebagai("antikebo_app"), pekerja: (fn) => sebagai("antikebo_worker")(null, fn), superuser: db, pg };
}

/** Arahkan `db()` aplikasi ke PGlite; setiap transaksi turun ke `antikebo_app` (atau worker), sama seperti produksi. */
export function arahkanDbAplikasi(u: Ujian, peran: "antikebo_app" | "antikebo_worker" = "antikebo_app") {
  // Setiap transaksi aplikasi turun peran (web = antikebo_app, worker = antikebo_worker), sama seperti produksi.
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
  await u.superuser.insert(schema.pengguna).values({ id, agentbuffSub: `uji_${id}`, email: `${id}@uji.internal`, nama });
  return id;
}
