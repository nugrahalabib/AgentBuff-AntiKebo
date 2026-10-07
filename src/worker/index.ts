import { lt } from "drizzle-orm";
import { db, klienSql, schema } from "@/lib/db";
import { periksaEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { lengkapiMaterialisasi, pasangSaluran } from "@/lib/penjadwal/mesin";
import { Penjadwal } from "@/lib/penjadwal/penjadwal";
import { saluranAsli } from "@/lib/penjadwal/saluran-asli";
import { sapuHak } from "@/lib/layanan/beku";
import { prosesPengingatMalam } from "@/lib/layanan/pengingat";
import { bersihkanSuara } from "@/lib/layanan/suara";
import { prosesAntreanSuara } from "@/lib/suara/antrean";

// Worker AntiKebo (proses terpisah, peran DB antikebo_worker): penjadwal kejadian (tepat detik,
// SKIP LOCKED, LISTEN/NOTIFY, pulih; P3), antrean suara (P5), saluran asli spam kanal, notifikasi
// web, penutup, kabar terlewat (P6), pengingat malam (P6), detak, bersih-bersih. Tuya (P7) masuk
// sebagai saluran langkah (docs/03-ARSITEKTUR.md §4 sampai §8).
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
  const s = await db().transaction((tx) => bersihkanSuara(tx, new Date()));
  // Idempotensi alat MCP disimpan 30 hari (docs/11-ALAT-MCP.md).
  const i = await db()
    .delete(schema.idempotensiMcp)
    .where(lt(schema.idempotensiMcp.dibuat, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
    .returning({ alat: schema.idempotensiMcp.alat });
  return `${d.length} audit lama, ${s} klip tak terpakai, ${i.length} idempotensi MCP dihapus`;
}

// Saluran asli: pesan kanal lewat pintu AgentBuff pengguna dan Web Push (tiruan hanya untuk uji mesin).
pasangSaluran(saluranAsli({ db }));

const penjadwal = new Penjadwal({
  db,
  dengar: async (cb) => {
    const l = await klienSql().listen("antikebo_peristiwa", cb);
    return () => l.unlisten();
  },
});

putaran("utama", DETAK_MS, async () => "hidup");
putaran("bersih", 6 * 60 * 60_000, bersihBersih);
// Pembuat suara omelan lewat AgentBuff pengguna (docs/10-SUARA.md §4).
putaran("suara", 3_000, async () => {
  const h = await prosesAntreanSuara(db);
  return h.diproses ? `${h.siap} siap, ${h.ulang} diulang, ${h.gagal} gagal` : undefined;
});
// Pengingat malam pada jam tidur tiap pengguna (PRD G4).
putaran("pengingat", 60_000, async () => {
  const h = await prosesPengingatMalam(db);
  return h.dikirim ? `${h.dikirim} pengingat terkirim` : undefined;
});
// Hak AgentBuff pemilik yang punya alarm dalam 48 jam + kabar sekali saat akses berakhir (K-07).
putaran("hak", 5 * 60_000, async () => {
  const h = await sapuHak(db);
  return h.diperiksa || h.dikabari ? `${h.diperiksa} diperiksa, ${h.dikabari} dikabari beku` : undefined;
});
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
