import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";

/**
 * Penjadwal terhadap Postgres 16 SUNGGUHAN (bukan PGlite): bukti P3 yang butuh banyak koneksi.
 *  - dua worker berebut kejadian yang sama (FOR UPDATE SKIP LOCKED) tanpa dobel;
 *  - pewaktu + LISTEN membunyikan kejadian tepat waktu (selisih tercatat);
 *  - `berhenti` sampai ke aliran SSE perangkat dan web < 2 dtk.
 * Memakai DB pengembangan dari .env.local (scripts/siapkan-lokal.sh) dengan peran asli
 * antikebo_worker / antikebo_app; semua baris uji dihapus lagi. Dilewati bila DB tidak ada,
 * KECUALI `WAJIB_PG_ASLI=1` (CI): di sana ketiadaan DB = gagal.
 */

function bacaEnvLokal(): Record<string, string> {
  const f = path.resolve(import.meta.dirname, "../../.env.local");
  if (!existsSync(f)) return {};
  return Object.fromEntries(
    readFileSync(f, "utf8")
      .split("\n")
      .filter((b) => /^[A-Z_]+=/.test(b))
      .map((b) => [b.slice(0, b.indexOf("=")), b.slice(b.indexOf("=") + 1)]),
  );
}

const envLokal = bacaEnvLokal();
const URL_WORKER = process.env.DATABASE_URL_WORKER ?? envLokal.DATABASE_URL_WORKER;
const URL_APP = envLokal.DATABASE_URL ?? process.env.DATABASE_URL;
const wajib = process.env.WAJIB_PG_ASLI === "1";

async function dbTersedia(): Promise<boolean> {
  if (!URL_WORKER || !URL_APP) return false;
  const c = postgres(URL_WORKER, { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    await c`select 1 from kejadian_alarm limit 1`;
    return true;
  } catch {
    return false;
  } finally {
    await c.end({ timeout: 1 });
  }
}

const ada = await dbTersedia();
if (wajib && !ada) throw new Error("WAJIB_PG_ASLI=1 tetapi Postgres pengembangan tidak bisa dipakai (jalankan scripts/siapkan-lokal.sh)");

describe.skipIf(!ada)("penjadwal di Postgres 16 sungguhan", () => {
  const klien: Array<ReturnType<typeof postgres>> = [];
  const pengguna: string[] = [];
  let w1: Db;
  let w2: Db;

  beforeAll(async () => {
    process.env.LOG_LEVEL ??= "silent";
    // Modul aplikasi (perangkat, peristiwa) memakai db() global: arahkan ke peran antikebo_app.
    process.env.DATABASE_URL = URL_APP;
    const buat = () => {
      const c = postgres(URL_WORKER!, { max: 4, onnotice: () => {} });
      klien.push(c);
      return drizzle(c, { schema }) as unknown as Db;
    };
    w1 = buat();
    w2 = buat();
  });

  afterAll(async () => {
    if (pengguna.length) {
      await w1.transaction(async (tx) => {
        await tx.execute(sql`delete from langkah_kejadian where pengguna_id in ${pengguna}`);
        await tx.execute(sql`delete from kejadian_alarm where pengguna_id in ${pengguna}`);
        await tx.execute(sql`delete from lewati_alarm where pengguna_id in ${pengguna}`);
        await tx.execute(sql`delete from alarm where pengguna_id in ${pengguna}`);
        await tx.execute(sql`delete from kode_sambung where pengguna_id in ${pengguna}`);
        await tx.execute(sql`delete from perangkat_siaga where pengguna_id in ${pengguna}`);
        await tx.execute(sql`delete from audit where pengguna_id in ${pengguna}`);
        await tx.execute(sql`delete from pengguna where id in ${pengguna}`);
      });
    }
    const { klienSql } = await import("@/lib/db");
    await klienSql()
      .end({ timeout: 2 })
      .catch(() => {});
    await Promise.all(klien.map((c) => c.end({ timeout: 2 })));
  });

  async function penggunaBaru(): Promise<string> {
    const id = crypto.randomUUID();
    await w1.insert(schema.pengguna).values({ id, agentbuffSub: `uji_pg_${id}`, nama: "Uji PG" });
    pengguna.push(id);
    return id;
  }

  async function alarmDenganKejadian(penggunaId: string, jadwal: Date) {
    const [a] = await w1
      .insert(schema.alarm)
      .values({
        penggunaId,
        jam: "05:00",
        zona: "Asia/Jakarta",
        pengulangan: { jenis: "harian" },
        agendaJudul: "Uji",
        karakter: "ibu_galak",
        bunyi: "klasik",
        soal: { jenis: "hitungan", tingkat: "sedang", benar: 2, kodeQr: [] },
        tunda: { jatah: 2, menit: 5 },
        spam: { kanal: ["tg-1"], jedaDtk: null, batasMenit: null },
        masihBangun: { aktif: true, menit: 5, batasDtk: 60 },
      })
      .returning();
    const [k] = await w1
      .insert(schema.kejadianAlarm)
      .values({ penggunaId, alarmId: a.id, jadwalUtc: jadwal, tanggalLokal: "2026-10-08", jamLokal: "05:00", judul: "Uji" })
      .returning();
    return { a, k };
  }

  it("dua worker berebut 40 kejadian: masing-masing dibunyikan tepat sekali", async () => {
    const { klaimJatuhTempo } = await import("@/lib/penjadwal/mesin");
    const A = await penggunaBaru();
    const lalu = new Date(Date.now() - 5_000);
    const daftar = await Promise.all(Array.from({ length: 40 }, () => alarmDenganKejadian(A, lalu)));
    const ids = new Set(daftar.map((d) => d.k.id));
    const sekarang = new Date();
    const putaran = async (w: Db) => {
      const diambil: string[] = [];
      for (;;) {
        const h = await w.transaction((tx) => klaimJatuhTempo(tx, sekarang, 7));
        const milik = h.filter((x) => ids.has(x.kejadian.id));
        if (!h.length) break;
        diambil.push(...milik.map((x) => x.kejadian.id));
      }
      return diambil;
    };
    const [x, y] = await Promise.all([putaran(w1), putaran(w2)]);
    console.info(`[bukti P3] worker 1 mengklaim ${x.length}, worker 2 mengklaim ${y.length}, irisan ${x.filter((id) => y.includes(id)).length}`);
    expect(x.length).toBeGreaterThan(0);
    expect(y.length).toBeGreaterThan(0);
    expect(x.filter((id) => y.includes(id))).toEqual([]);
    expect(new Set([...x, ...y])).toEqual(ids);
    const status = await w1
      .select({ status: schema.kejadianAlarm.status })
      .from(schema.kejadianAlarm)
      .where(inArray(schema.kejadianAlarm.id, [...ids]));
    expect(status.every((s) => s.status === "berbunyi")).toBe(true);
    // Langkah tidak dobel: tepat satu notifikasi + satu spam per kejadian.
    const [{ n }] = (await w1.execute(
      sql`select count(*)::int as n from langkah_kejadian where kejadian_id in ${[...ids]} and urutan = 0 and jenis in ('notifikasi', 'spam')`,
    )) as unknown as Array<{ n: number }>;
    expect(n).toBe(80);
    // Kejadian berikutnya: tepat satu menunggu per alarm.
    const [{ m }] = (await w1.execute(
      sql`select count(*)::int as m from kejadian_alarm where alarm_id in ${daftar.map((d) => d.a.id)} and status = 'menunggu'`,
    )) as unknown as Array<{ m: number }>;
    expect(m).toBe(40);
  }, 60_000);

  it("pewaktu + LISTEN: lima kejadian dibunyikan tepat waktu (selisih tercatat < 1,5 dtk)", async () => {
    const { Penjadwal } = await import("@/lib/penjadwal/penjadwal");
    const A = await penggunaBaru();
    const dengar = async (cb: (m: string) => void) => {
      const l = await klien[0].listen("antikebo_peristiwa", cb);
      return () => l.unlisten();
    };
    const p = new Penjadwal({ db: () => w1, dengar, ketukanMs: 60_000 });
    await p.mulai();
    // Kejadian dibuat SESUDAH penjadwal menyala: pewaktu harus dipasang ulang lewat NOTIFY.
    const awal = Date.now();
    const daftar = await Promise.all([1_500, 1_900, 2_300, 2_700, 3_100].map((ms) => alarmDenganKejadian(A, new Date(awal + ms))));
    await new Promise((r) => setTimeout(r, 4_200));
    await p.berhenti();
    const hasil = await w1
      .select()
      .from(schema.kejadianAlarm)
      .where(
        inArray(
          schema.kejadianAlarm.id,
          daftar.map((d) => d.k.id),
        ),
      );
    const selisih = hasil.map((k) => (k.berbunyiPada ? k.berbunyiPada.getTime() - k.jadwalUtc.getTime() : Infinity));
    console.info(`[bukti P3] selisih bunyi vs jadwal (ms): ${selisih.join(", ")}`);
    expect(hasil.every((k) => k.status === "berbunyi")).toBe(true);
    expect(Math.max(...selisih)).toBeLessThan(1_500);
    expect(Math.min(...selisih)).toBeGreaterThanOrEqual(0);
    for (const k of hasil) expect(k.terlambatDtk).toBeLessThanOrEqual(1);
  }, 30_000);

  it("berhenti sampai ke aliran perangkat (token) dan web < 2 dtk", async () => {
    const { mintaKodeSambung, setujuiKodeSambung, ambilTokenSambung } = await import("@/lib/layanan/perangkat");
    const { aliranPeristiwa } = await import("@/lib/peristiwa");
    const { GET } = await import("@/app/api/peristiwa/route");
    const { hentikanKejadian } = await import("@/lib/penjadwal/mesin");
    const A = await penggunaBaru();
    const kode = await mintaKodeSambung({ nama: "PC Uji" });
    await setujuiKodeSambung(A, kode.kode, "web");
    const h = await ambilTokenSambung({ kode: kode.kode, rahasia: kode.rahasia });
    if (h.status !== "tersambung") throw new Error("gagal sambung");
    const { k } = await alarmDenganKejadian(A, new Date(Date.now() - 1_000));
    await w1.update(schema.kejadianAlarm).set({ status: "berbunyi", berbunyiPada: new Date() }).where(eq(schema.kejadianAlarm.id, k.id));

    const baca = async (res: Response) => {
      const r = res.body!.getReader();
      const dec = new TextDecoder();
      let teks = "";
      while (!teks.includes("event: berhenti\n")) {
        const { value, done } = await r.read();
        if (done) break;
        teks += dec.decode(value);
      }
      const t = Date.now();
      await r.cancel();
      return { teks, t };
    };
    const pc = await GET(new Request("http://localhost:3100/api/peristiwa", { headers: { Authorization: `Bearer ${h.token}` } }));
    const web = aliranPeristiwa(new Request("http://localhost:3100/api/peristiwa"), A);
    const tunggu = Promise.all([baca(pc), baca(web)]);
    await new Promise((r) => setTimeout(r, 300));
    const mulai = Date.now();
    await w2.transaction((tx) => hentikanKejadian(tx, k.id, "bangun", new Date()));
    const [hp, hw] = await tunggu;
    console.info(`[bukti P3] berhenti diterima PC ${hp.t - mulai} ms, web ${hw.t - mulai} ms`);
    expect(hp.teks).toContain(`"k":"${k.id}"`);
    expect(hp.t - mulai).toBeLessThan(2_000);
    expect(hw.t - mulai).toBeLessThan(2_000);
  }, 30_000);
});
