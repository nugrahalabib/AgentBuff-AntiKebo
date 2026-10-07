import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { arahkanDbAplikasi, buatPengguna, siapkanBasisData, type Ujian } from "./harness";

// P11: Hapus semua data (PRD A5) terhadap migrasi asli, sebagai antikebo_app (RLS aktif).

process.env.LOG_LEVEL ??= "silent";
process.env.SESSION_SECRET ??= randomBytes(32).toString("hex");
process.env.ENCRYPTION_KEK ??= randomBytes(32).toString("base64");

let u: Ujian;
const H = () => import("@/lib/layanan/hapus-data");
const L = () => import("@/lib/layanan/alarm");
const T = () => import("@/lib/layanan/template");
const Q = () => import("@/lib/layanan/kode-qr");

const wib = (s: string) => new Date(`${s}+07:00`);
const SIANG = wib("2026-10-07T12:00:00");
const MALAM = wib("2026-10-07T23:00:00");

/** Tabel milik pengguna yang wajib kosong sesudah hapus data. */
const TABEL = [
  "alarm",
  "lewati_alarm",
  "template_alarm",
  "kejadian_alarm",
  "langkah_kejadian",
  "soal_kejadian",
  "kode_qr",
  "naskah_suara",
  "klip_suara",
  "kiriman_kanal",
  "langganan_push",
  "perangkat_siaga",
  "kode_sambung",
  "sambungan_tuya",
  "perangkat_tuya",
  "potret_tuya",
  "token_mcp",
  "idempotensi_mcp",
] as const;

beforeAll(async () => {
  u = await siapkanBasisData();
  arahkanDbAplikasi(u);
}, 60_000);

async function galat(p: Promise<unknown>): Promise<GalatLayanan> {
  try {
    await p;
  } catch (e) {
    if (e instanceof GalatLayanan) return e;
    throw e;
  }
  throw new Error("seharusnya gagal");
}

async function hitung(tabel: string, penggunaId: string): Promise<number> {
  const r = await u.pg.query<{ n: number }>(`select count(*)::int as n from ${tabel} where pengguna_id = $1`, [penggunaId]);
  return r.rows[0].n;
}

/** Isi semua jenis data milik pengguna. */
async function isiSemua(A: string): Promise<{ perangkatId: string }> {
  const a = await (await L()).buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" } }, "web", { sekarang: SIANG });
  await (await L()).lewatiTanggal(A, a.id, "2026-10-10", "web", { sekarang: SIANG });
  await (await T()).buatTemplate(A, { nama: "Gym", isi: { jam: "05:15" } }, "web");
  await (await Q()).buatKodeQr(A, "Kamar mandi", "web");
  const [p] = await u.superuser
    .insert(schema.perangkatSiaga)
    .values({ penggunaId: A, jenis: "pc", nama: "PC Kamar", tokenHash: randomBytes(32).toString("hex"), terakhirTerlihat: SIANG })
    .returning();
  await u.superuser.insert(schema.kodeSambung).values({
    kodeHash: randomBytes(32).toString("hex"),
    rahasiaHash: randomBytes(32).toString("hex"),
    namaPerangkat: "PC Kamar",
    kedaluwarsa: SIANG,
    status: "diambil",
    penggunaId: A,
    perangkatId: p.id,
  });
  await u.superuser.insert(schema.langgananPush).values({ penggunaId: A, perangkatId: p.id, endpointHash: randomBytes(32).toString("hex"), data: "tersandi" });
  const [k] = await u.superuser
    .insert(schema.kejadianAlarm)
    .values({ penggunaId: A, jadwalUtc: SIANG, tanggalLokal: "2026-10-06", jamLokal: "05:00", judul: "Bangun", status: "bangun", berbunyiPada: SIANG, bangunPada: SIANG })
    .returning();
  await u.superuser
    .insert(schema.soalKejadian)
    .values({ penggunaId: A, kejadianId: k.id, tujuan: "bangun", jenis: "hitungan", tingkat: "sedang", target: 1, tampil: { teks: "1 + 1" } as never, garam: "g" });
  await u.superuser.insert(schema.langkahKejadian).values({ penggunaId: A, kejadianId: k.id, jenis: "spam", jatuhTempoUtc: SIANG, status: "selesai" });
  await u.superuser.insert(schema.kirimanKanal).values({ penggunaId: A, kejadianId: k.id, kanalId: "k1", jenis: "spam", status: "terkirim", kunci: `uji:${k.id}` });
  await u.superuser.insert(schema.naskahSuara).values({ penggunaId: A, hash: randomBytes(32).toString("hex"), teks: "Bangun!", bahasa: "id", gaya: "galak" });
  await u.superuser
    .insert(schema.klipSuara)
    .values({ penggunaId: A, hash: randomBytes(32).toString("hex"), audio: Buffer.from([1, 2, 3]), mime: "audio/mpeg", durasiMs: 900, penyedia: "uji", suara: "uji" });
  await u.superuser.insert(schema.sambunganTuya).values({ penggunaId: A, kunciSandi: "tersandi", kunciSamar: "ab…cd", wilayah: "sg" });
  await u.superuser.insert(schema.perangkatTuya).values({ penggunaId: A, deviceId: "lampu1", nama: "Lampu", kategori: "dj" });
  await u.superuser.insert(schema.potretTuya).values({ penggunaId: A, kejadianId: k.id, deviceId: "lampu1", properti: {} });
  await u.superuser.insert(schema.tokenMcp).values({ penggunaId: A, label: "Agen", hash: randomBytes(32).toString("hex"), awalan: "antikebo_abcd", sumber: "manual" });
  await u.superuser.insert(schema.idempotensiMcp).values({ penggunaId: A, alat: "create_alarm", rujukan: "ref-1", hasil: { data: {}, teks: "ok" } });
  await u.superuser.insert(schema.sesi).values({ idHash: randomBytes(32).toString("hex"), penggunaId: A, kedaluwarsaDiam: MALAM, kedaluwarsaMutlak: MALAM });
  await u.superuser.update(schema.pengguna).set({ namaPanggilan: "Nugi", orientasiSelesai: SIANG, email: "a@contoh.id", nama: "Nugi A" }).where(eq(schema.pengguna.id, A));
  return { perangkatId: p.id };
}

describe("hapus semua data", () => {
  it("menghapus semua data pemilik, mencabut sesi, dan tidak menyentuh pengguna lain", async () => {
    const A = await buatPengguna(u);
    const B = await buatPengguna(u);
    await isiSemua(A);
    await isiSemua(B);
    for (const t of TABEL) expect(await hitung(t, A), t).toBeGreaterThan(0);

    const { hapusSemuaData } = await H();
    expect((await galat(hapusSemuaData(A, { konfirmasi: "hapus aja" }, "web", SIANG))).kode).toBe("masukan");
    expect((await galat(hapusSemuaData(A, {}, "web", SIANG))).message).toBe("Ketik HAPUS dulu untuk memastikan.");
    await hapusSemuaData(A, { konfirmasi: " hapus " }, "web", SIANG);

    for (const t of TABEL) expect(await hitung(t, A), t).toBe(0);
    for (const t of TABEL) expect(await hitung(t, B), t).toBeGreaterThan(0);
    const [p] = await u.superuser.select().from(schema.pengguna).where(eq(schema.pengguna.id, A));
    expect(p).toMatchObject({ namaPanggilan: null, orientasiSelesai: null, email: null, nama: null, bawaan: {}, jamTidur: "22:00" });
    expect(p.dihapusPada?.getTime()).toBe(SIANG.getTime());
    const sesi = await u.superuser.select().from(schema.sesi).where(eq(schema.sesi.penggunaId, A));
    expect(sesi.every((s) => s.dicabutPada)).toBe(true);
    const audit = await u.superuser.select().from(schema.audit).where(eq(schema.audit.penggunaId, A));
    expect(audit.map((x) => x.ringkasan)).toEqual(["Semua data dihapus"]);
    const sesiB = await u.superuser.select().from(schema.sesi).where(eq(schema.sesi.penggunaId, B));
    expect(sesiB.every((s) => !s.dicabutPada)).toBe(true);
  });

  it("bahasa Inggris memakai kata DELETE", async () => {
    const A = await buatPengguna(u);
    await u.superuser.update(schema.pengguna).set({ bahasa: "en" }).where(eq(schema.pengguna.id, A));
    const { hapusSemuaData } = await H();
    expect((await galat(hapusSemuaData(A, { konfirmasi: "HAPUS" }, "web", SIANG))).message).toBe("Type DELETE first to confirm.");
    await hapusSemuaData(A, { konfirmasi: "delete" }, "web", SIANG);
  });

  it("ditolak selama alarm berbunyi", async () => {
    const A = await buatPengguna(u);
    await isiSemua(A);
    await u.superuser.execute(sql`update kejadian_alarm set status = 'berbunyi' where pengguna_id = ${A} and status = 'menunggu'`);
    const g = await galat((await H()).hapusSemuaData(A, { konfirmasi: "HAPUS" }, "web", SIANG));
    expect(g.kode).toBe("sedang_berbunyi");
    expect(await hitung("alarm", A)).toBe(1);
  });

  it("ditolak selama jendela Mode Komitmen (tidak bisa dipakai mematikan alarm terkunci)", async () => {
    const A = await buatPengguna(u);
    await (await L()).buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" }, komitmen: true }, "web", { sekarang: SIANG });
    const { hapusSemuaData } = await H();
    const g = await galat(hapusSemuaData(A, { konfirmasi: "HAPUS" }, "web", MALAM));
    expect(g.kode).toBe("komitmen_terkunci");
    expect(g.message).toBe("Mode Komitmen aktif sampai 05.00. Data bisa dihapus sesudah alarm itu berbunyi.");
    expect(await hitung("alarm", A)).toBe(1);
    // Siang (di luar jendela kunci) boleh.
    await hapusSemuaData(A, { konfirmasi: "HAPUS" }, "web", SIANG);
    expect(await hitung("alarm", A)).toBe(0);
  });
});
