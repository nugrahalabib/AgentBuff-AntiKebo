import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { arahkanDbAplikasi, buatPengguna, siapkanBasisData, type Ujian } from "./harness";

// P11: Riwayat (PRD K1 sampai K3) terhadap migrasi asli, sebagai antikebo_app (RLS aktif):
// ringkasan 30 hari, rincian kejadian (soal, kiriman, perangkat, rumah pintar), ekspor CSV.

process.env.LOG_LEVEL ??= "silent";
process.env.SESSION_SECRET ??= randomBytes(32).toString("hex");
process.env.ENCRYPTION_KEK ??= randomBytes(32).toString("base64");

let u: Ujian;
const R = () => import("@/lib/layanan/riwayat");
const L = () => import("@/lib/layanan/alarm");
const M = () => import("@/lib/penjadwal/mesin");

const wib = (s: string) => new Date(`${s}+07:00`);
const SEKARANG = wib("2026-10-07T09:00:00");

beforeAll(async () => {
  u = await siapkanBasisData();
  arahkanDbAplikasi(u);
}, 60_000);

function dbPekerja(): Db {
  const asli = u.superuser.transaction.bind(u.superuser);
  const d = Object.create(u.superuser) as Db;
  (d as unknown as { transaction: unknown }).transaction = (fn: (tx: unknown) => Promise<unknown>) =>
    asli(async (tx) => {
      await tx.execute(sql.raw("set local role antikebo_worker"));
      return fn(tx);
    });
  return d;
}

async function galat(p: Promise<unknown>): Promise<GalatLayanan> {
  try {
    await p;
  } catch (e) {
    if (e instanceof GalatLayanan) return e;
    throw e;
  }
  throw new Error("seharusnya gagal");
}

type Kej = { tanggal: string; jam?: string; status?: string; tunda?: number; menit?: number; uji?: boolean; judul?: string; tanpaTunda?: boolean };

/** Kejadian selesai buatan (seperti hasil worker), langsung lewat superuser. */
async function kejadian(A: string, k: Kej): Promise<string> {
  const jam = k.jam ?? "05:00";
  const mulai = wib(`${k.tanggal}T${jam}:00`);
  const status = k.status ?? "bangun";
  const [r] = await u.superuser
    .insert(schema.kejadianAlarm)
    .values({
      penggunaId: A,
      jadwalUtc: mulai,
      tanggalLokal: k.tanggal,
      jamLokal: jam,
      judul: k.judul ?? "Bangun",
      status,
      uji: k.uji ?? false,
      jumlahTunda: k.tunda ?? 0,
      berbunyiPada: status === "terlewat" ? null : mulai,
      bangunPada: status === "bangun" ? new Date(mulai.getTime() + (k.menit ?? 2) * 60_000) : null,
      tanpaTunda: k.tanpaTunda ?? false,
    })
    .returning({ id: schema.kejadianAlarm.id });
  return r.id;
}

describe("ringkasan riwayat", () => {
  it("skor, beruntun, rata-rata, tunda; uji, kejadian berjalan, dan milik orang lain tidak masuk", async () => {
    const A = await buatPengguna(u);
    const B = await buatPengguna(u);
    const kemarin = await kejadian(A, { tanggal: "2026-10-06", tunda: 1, menit: 6 });
    await kejadian(A, { tanggal: "2026-10-07", menit: 2 });
    await kejadian(A, { tanggal: "2026-10-05", status: "tidak_bangun" });
    await kejadian(A, { tanggal: "2026-10-04", status: "terlewat" });
    await kejadian(A, { tanggal: "2026-10-07", jam: "06:00", uji: true });
    await kejadian(A, { tanggal: "2026-10-07", jam: "07:00", status: "berbunyi" });
    await kejadian(A, { tanggal: "2026-10-07", jam: "08:00", status: "dibatalkan" });
    await kejadian(B, { tanggal: "2026-10-07", menit: 50 });
    // Dua pesan spam terkirim + satu gagal untuk kejadian kemarin.
    for (const [i, status] of (["terkirim", "terkirim", "gagal"] as const).entries()) {
      await u.superuser
        .insert(schema.kirimanKanal)
        .values({ penggunaId: A, kejadianId: kemarin, kanalId: "k1", platform: "telegram", jenis: "spam", ke: i + 1, status, kunci: `uji:${kemarin}:${i}` });
    }

    const r = await (await R()).riwayatPengguna(A, SEKARANG);
    expect(r.kejadian.map((k) => [k.tanggal, k.status])).toEqual([
      ["2026-10-07", "bangun"],
      ["2026-10-06", "bangun"],
      ["2026-10-05", "tidak_bangun"],
      ["2026-10-04", "terlewat"],
    ]);
    expect(r.skorHariIni).toBe(100);
    expect(r.beruntun).toBe(2);
    expect(r.rataMenit).toBe(4);
    expect(r.totalTunda).toBe(1);
    expect(r.kejadian.find((k) => k.id === kemarin)).toMatchObject({ tunda: 1, menitSampaiBangun: 6, pesanKanal: 2 });
    expect(r.hari30).toHaveLength(30);
    expect(r.hari30.at(-1)).toBe("2026-10-07");
    expect(r.skor30.at(-3)).toBe(0);
    // Terlewat (server tidak sempat membunyikan) tidak dihitung (K-75).
    expect(r.skor30.at(-4)).toBeNull();
    expect(r.skor30[0]).toBeNull();
  });

  it("pengguna baru: kosong tanpa galat", async () => {
    const A = await buatPengguna(u);
    const r = await (await R()).riwayatPengguna(A, SEKARANG);
    expect(r).toMatchObject({ skorHariIni: null, beruntun: 0, rataMenit: null, totalTunda: 0, kejadian: [] });
  });
});

describe("rincian kejadian", () => {
  it("perangkat yang siaga dicatat saat mulai berbunyi; soal, kiriman, rumah, dan penghenti tampil", async () => {
    const A = await buatPengguna(u);
    const T = wib("2026-10-08T05:00:00");
    const lama = new Date(T.getTime() - 10 * 60_000);
    const baru = new Date(T.getTime() - 30_000);
    const [pc] = await u.superuser
      .insert(schema.perangkatSiaga)
      .values({ penggunaId: A, jenis: "pc", nama: "PC Kamar", terakhirTerlihat: baru })
      .returning({ id: schema.perangkatSiaga.id });
    await u.superuser.insert(schema.perangkatSiaga).values({ penggunaId: A, jenis: "web", nama: "HP lama", terakhirTerlihat: lama });
    await u.superuser.insert(schema.perangkatSiaga).values({ penggunaId: A, jenis: "web", nama: "Tablet diputus", terakhirTerlihat: baru, dicabutPada: lama });
    const a = await (await L()).buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" } }, "web", { sekarang: wib("2026-10-07T12:00:00") });
    const { klaimJatuhTempo } = await M();
    await dbPekerja().transaction((tx) => klaimJatuhTempo(tx, T));
    const [k] = await u.pekerja((tx) => tx.select().from(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.alarmId, a.id)).orderBy(schema.kejadianAlarm.jadwalUtc));
    expect(k.status).toBe("berbunyi");
    expect(k.perangkatBerbunyi).toEqual([{ id: pc.id, nama: "PC Kamar", jenis: "pc" }]);

    // Selesai lewat aplikasi PC, dengan satu soal salah lalu benar, satu pesan spam, satu lampu.
    await u.superuser
      .update(schema.kejadianAlarm)
      .set({ status: "bangun", bangunPada: new Date(T.getTime() + 90_000), selesaiOleh: "perangkat", perangkatSelesai: pc.id })
      .where(eq(schema.kejadianAlarm.id, k.id));
    for (const status of ["salah", "benar"]) {
      await u.superuser.insert(schema.soalKejadian).values({
        penggunaId: A,
        kejadianId: k.id,
        tujuan: "bangun",
        jenis: "hitungan",
        tingkat: "sedang",
        target: 1,
        tampil: { teks: "1 + 1" } as never,
        garam: "g",
        status,
      });
    }
    await u.superuser
      .insert(schema.kirimanKanal)
      .values({ penggunaId: A, kejadianId: k.id, kanalId: "k1", platform: "telegram", jenis: "spam", ke: 1, status: "terkirim", kunci: `uji:${k.id}` });
    await u.superuser.insert(schema.perangkatTuya).values({ penggunaId: A, deviceId: "lampu1", nama: "Lampu kamar", kategori: "dj", online: true });
    await u.superuser.insert(schema.langkahKejadian).values([
      { penggunaId: A, kejadianId: k.id, jenis: "tuya", urutan: 0, jatuhTempoUtc: T, status: "selesai", hasil: { perangkat: "lampu1", status: "terkonfirmasi" } },
      { penggunaId: A, kejadianId: k.id, jenis: "tuya", urutan: 1, jatuhTempoUtc: T, status: "selesai", hasil: { perangkat: "kipas9", lewat: "offline" } },
      { penggunaId: A, kejadianId: k.id, jenis: "tuya_kedip", urutan: 0, jatuhTempoUtc: T, status: "selesai", hasil: { perangkat: "lampu1", status: "terkirim" } },
    ]);

    const { rincianKejadian } = await R();
    const r = await rincianKejadian(A, k.id);
    expect(r).toMatchObject({
      status: "bangun",
      berbunyi: "05.00",
      bangun: "05.01",
      selesaiOleh: "perangkat",
      perangkat: "PC Kamar",
      perangkatBerbunyi: [{ nama: "PC Kamar", jenis: "pc" }],
      rumah: [
        { nama: "Lampu kamar", hasil: "jalan" },
        { nama: null, hasil: "offline" },
      ],
    });
    expect(r.soal.map((s) => s.status)).toEqual(["salah", "benar"]);
    expect(r.kiriman).toHaveLength(1);
    expect(JSON.stringify(r)).not.toContain("1 + 1");

    // Pengguna lain dan id ngawur = tidak ditemukan.
    const B = await buatPengguna(u);
    expect((await galat(rincianKejadian(B, k.id))).kode).toBe("tidak_ditemukan");
    expect((await galat(rincianKejadian(A, "bukan-uuid"))).kode).toBe("tidak_ditemukan");
  });
});

describe("ekspor CSV", () => {
  it("BOM, kepala dalam bahasa pengguna, sel rumus dinetralkan, uji tidak ikut", async () => {
    const A = await buatPengguna(u);
    await kejadian(A, { tanggal: "2026-10-06", judul: '=HYPERLINK("http://x")', tunda: 2, menit: 3 });
    await kejadian(A, { tanggal: "2026-10-07", judul: "Kuliah, pagi", status: "tidak_bangun" });
    await kejadian(A, { tanggal: "2026-10-07", jam: "06:00", uji: true, judul: "Uji" });
    const csv = await (await R()).csvRiwayat(A);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const baris = csv.slice(1).trimEnd().split("\r\n");
    expect(baris[0]).toBe("Tanggal,Jam alarm,Agenda,Status,Berbunyi,Soal terjawab,Menit sampai bangun,Tunda,Skor,Pesan kanal");
    expect(baris).toHaveLength(3);
    expect(baris[1]).toBe('2026-10-07,05.00,"Kuliah, pagi",Tidak bangun,05.00,,,0,0,0');
    expect(baris[2]).toMatch(/^2026-10-06,05\.00,"'=HYPERLINK\(""http:\/\/x""\)",Bangun,05\.00,05\.03,3,2,\d+,0$/);
    expect(csv).not.toContain("Uji");

    await u.superuser.update(schema.pengguna).set({ bahasa: "en" }).where(eq(schema.pengguna.id, A));
    const en = await (await R()).csvRiwayat(A);
    expect(en.slice(1).split("\r\n")[0]).toBe("Date,Alarm time,Agenda,Status,Rang,Solved,Minutes to wake,Snoozes,Score,Channel messages");
  });
});
