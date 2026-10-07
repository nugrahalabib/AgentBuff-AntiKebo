import { lt } from "drizzle-orm";
import { db, klienSql, schema } from "@/lib/db";
import { periksaEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { lengkapiMaterialisasi } from "@/lib/penjadwal/mesin";
import { Penjadwal } from "@/lib/penjadwal/penjadwal";

// Worker AntiKebo (proses terpisah, peran DB antikebo_worker): penjadwal kejadian (tepat detik,
// SKIP LOCKED, LISTEN/NOTIFY, pulih; P3), detak, bersih-bersih. Antrean suara (P5), spam kanal
// (P6), Tuya (P7) masuk sebagai saluran langkah (docs/03-ARSITEKTUR.md §4 sampai §8).
// Setiap putaran berbatas waktu; satu putaran menggantung tidak boleh mengunci yang lain.

// Pengembangan: satu .env.local untuk web dan worker; worker memakai peran antikebo_worker.
// Produksi: compose mengisi DATABASE_URL worker langsung. db() baru tersambung saat dipakai.
if (process.env.DATABASE_URL_WORKER) process.env.DATABASE_URL = process.env.DATABASE_URL_WORKER;
periksaEnv("worker");

const DETAK_MS = 10_000; // arsitektur §4.9: detak tiap 10 dtk

async function detak(nama: string, catatan?: string) {
  await db()
    .insert(schema.detakWorker)
    .values({ nama, terakhir: new Date(), catatan: catatan ?? null })
    .onConflictDoUpdate({ target: schema.detakWorker.nama, set: { terakhir: new Date(), catatan: catatan ?? null } })
    .catch((e) => log.warn({ err: (e as Error)?.message }, "detak gagal ditulis"));
}

function denganBatas<T>(ms: number, p: Promise<T>): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, tolak) => (t = setTimeout(() => tolak(new Error(`batas waktu ${ms} ms`)), ms)))]).finally(() => clearTimeout(t));
}

const pengatur: Array<ReturnType<typeof setInterval>> = [];

function putaran(nama: string, setiapMs: number, fn: () => Promise<string | void>) {
  let jalan = false;
  const sekali = async () => {
    if (jalan) return;
    jalan = true;
    try {
      const c = await denganBatas(Math.max(setiapMs * 3, 60_000), fn());
      await detak(nama, c ?? undefined);
    } catch (e) {
      log.warn({ err: (e as Error)?.message, putaran: nama }, "putaran worker gagal");
    } finally {
      jalan = false;
    }
  };
  setTimeout(sekali, 1_000);
  pengatur.push(setInterval(sekali, setiapMs));
}

async function bersihBersih(): Promise<string> {
  const d = await db()
    .delete(schema.audit)
    .where(lt(schema.audit.dibuat, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)))
    .returning({ id: schema.audit.id });
  await db().delete(schema.jtiTerpakai).where(lt(schema.jtiTerpakai.kedaluwarsa, new Date()));
  await db()
    .delete(schema.sesi)
    .where(lt(schema.sesi.kedaluwarsaMutlak, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  return `${d.length} audit lama dihapus`;
}

const penjadwal = new Penjadwal({
  db,
  dengar: async (cb) => {
    const l = await klienSql().listen("antikebo_peristiwa", cb);
    return () => l.unlisten();
  },
});

putaran("utama", DETAK_MS, async () => "hidup");
putaran("bersih", 6 * 60 * 60_000, bersihBersih);
// Jaring pengaman invarian "alarm aktif = satu kejadian menunggu".
putaran("materialisasi", 10 * 60_000, async () => `${await db().transaction((tx) => lengkapiMaterialisasi(tx, new Date()))} dipulihkan`);
penjadwal
  .mulai()
  .then(() => log.info("penjadwal menyala"))
  .catch((e) => {
    log.error({ err: (e as Error)?.message }, "penjadwal gagal menyala");
    process.exit(1);
  });
log.info("worker AntiKebo menyala");

for (const sinyal of ["SIGTERM", "SIGINT"] as const) {
  process.on(sinyal, () => {
    for (const p of pengatur) clearInterval(p);
    void penjadwal.berhenti().finally(() => {
      log.info({ sinyal }, "worker AntiKebo berhenti");
      process.exit(0);
    });
  });
}
