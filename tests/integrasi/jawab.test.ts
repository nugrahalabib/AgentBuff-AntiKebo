import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { arahkanDbAplikasi, buatPengguna, siapkanBasisData, type Ujian } from "./harness";

// P4: soal, tunda, Masih bangun, Misi QR, luring, anti curang, terhadap migrasi asli (PGlite,
// peran antikebo_app). Jawaban benar dihitung uji dari TEKS soal, persis seperti manusia.

process.env.LOG_LEVEL ??= "silent";
process.env.SESSION_SECRET ??= randomBytes(32).toString("hex");
process.env.ENCRYPTION_KEK ??= randomBytes(32).toString("base64");

let u: Ujian;
const L = () => import("@/lib/layanan/alarm");
const M = () => import("@/lib/penjadwal/mesin");
const Jw = () => import("@/lib/layanan/jawab");
const Q = () => import("@/lib/layanan/kode-qr");

const wib = (s: string) => new Date(`${s}+07:00`);
const SIANG = wib("2026-10-07T12:00:00");
const T = wib("2026-10-08T05:00:00");

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

/** Hitung jawaban dari teks soal (×, −, ², kurung). */
function hitung(teks: string): string {
  const js = teks
    .replace(/×/g, "*")
    .replace(/−/g, "-")
    .replace(/(\d+)²/g, "($1*$1)");
  if (!/^[\d\s+\-*()]+$/.test(js)) throw new Error(`teks tak terduga: ${teks}`);
  return String(Function(`"use strict"; return (${js});`)());
}

/** Alarm berbunyi sekarang (diklaim worker), mengembalikan id kejadian. */
async function berbunyi(A: string, isi: Record<string, unknown> = {}): Promise<string> {
  const a = await (await L()).buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" }, ...isi }, "web", { sekarang: SIANG });
  const { klaimJatuhTempo } = await M();
  await dbPekerja().transaction((tx) => klaimJatuhTempo(tx, T));
  const [k] = await u.pekerja((tx) => tx.select().from(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.alarmId, a.id)).orderBy(schema.kejadianAlarm.jadwalUtc));
  expect(k.status).toBe("berbunyi");
  return k.id;
}

async function kejadian(id: string) {
  const [k] = await u.pekerja((tx) => tx.select().from(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.id, id)));
  return k;
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

const sesi = (penggunaId: string) => ({ penggunaId, perangkatId: null, oleh: "sesi" as const });

describe("soal hitungan", () => {
  it("salah = soal baru tingkat sama; dua benar berturut = lolos ke Masih bangun", async () => {
    const A = await buatPengguna(u);
    const id = await berbunyi(A);
    const { ambilSoal, jawab } = await Jw();
    const s1 = await ambilSoal(sesi(A), id, "bangun");
    expect(s1).toMatchObject({ jenis: "hitungan", tingkat: "sedang", target: 2, benarBeruntun: 0, tahap: 0, jumlahTahap: 1 });
    expect(JSON.stringify(s1)).not.toContain(`"jawaban"`);
    // Memanggil lagi = soal yang sama (tidak bisa diacak ulang untuk cari yang gampang).
    expect((await ambilSoal(sesi(A), id, "bangun")).id).toBe(s1.id);
    const salah = await jawab(sesi(A), id, s1.id, String(Number(hitung(s1.tampil.teks)) + 1), new Date(T.getTime() + 5_000));
    expect(salah.hasil).toBe("salah");
    if (salah.hasil !== "salah") return;
    expect(salah.soal.id).not.toBe(s1.id);
    expect(salah.soal.benarBeruntun).toBe(0);
    const b1 = await jawab(sesi(A), id, salah.soal.id, hitung(salah.soal.tampil.teks), new Date(T.getTime() + 10_000));
    expect(b1.hasil).toBe("benar");
    if (b1.hasil !== "benar") return;
    expect(b1.soal.benarBeruntun).toBe(1);
    const akhir = await jawab(sesi(A), id, b1.soal.id, ` ${hitung(b1.soal.tampil.teks)} `, new Date(T.getTime() + 15_000));
    expect(akhir).toMatchObject({ hasil: "selesai", status: "cek_bangun" });
    const k = await kejadian(id);
    expect(k).toMatchObject({ status: "cek_bangun", selesaiOleh: "sesi" });
    expect(k.bangunPada?.getTime()).toBe(T.getTime() + 15_000);
    expect(k.cekPada?.getTime()).toBe(T.getTime() + 15_000 + 5 * 60_000);
    expect(k.cekBatas?.getTime()).toBe(T.getTime() + 15_000 + 5 * 60_000 + 60_000);
    // Soal lama tidak bisa dipakai lagi.
    expect((await galat(jawab(sesi(A), id, b1.soal.id, "1"))).message).toBe("Soalnya sudah berganti. Coba soal yang baru.");
  });

  it("salah tiga kali berturut-turut turun satu tingkat (PRD D6)", async () => {
    const A = await buatPengguna(u);
    const id = await berbunyi(A, { soal: { tingkat: "berat", benar: 1 } });
    const { ambilSoal, jawab } = await Jw();
    let s = await ambilSoal(sesi(A), id, "bangun");
    expect(s.tingkat).toBe("berat");
    for (let i = 0; i < 3; i++) {
      const h = await jawab(sesi(A), id, s.id, "0");
      if (h.hasil !== "salah") throw new Error("harusnya salah");
      s = h.soal;
    }
    expect(s.tingkat).toBe("sedang");
  });

  it("jawaban hanya tersimpan sebagai HMAC bergaram, tidak di audit, tidak di jawaban API", async () => {
    const A = await buatPengguna(u);
    const id = await berbunyi(A, { soal: { benar: 1 }, masihBangun: { aktif: false } });
    const { ambilSoal, jawab } = await Jw();
    const s = await ambilSoal(sesi(A), id, "bangun");
    const benar = hitung(s.tampil.teks);
    const [baris] = await u.jalan(A, (tx) => tx.select().from(schema.soalKejadian).where(eq(schema.soalKejadian.id, s.id)));
    expect(baris.hashJawaban).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify({ ...baris, hashJawaban: null, garam: null })).not.toMatch(new RegExp(`"${benar}"`));
    const h = await jawab(sesi(A), id, s.id, benar);
    expect(h).toMatchObject({ hasil: "selesai", status: "bangun" });
    const audit = await u.jalan(A, (tx) => tx.select().from(schema.audit).where(eq(schema.audit.penggunaId, A)));
    // Id (UUID, nomor baris) dan waktu bisa kebetulan memuat angka jawaban: buang dulu, lalu cari
    // jawaban sebagai bilangan utuh.
    const teksAudit = JSON.stringify(audit)
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "<waktu>")
      .replace(/"id":\d+/g, '"id":0');
    expect(teksAudit).not.toMatch(new RegExp(`(^|\\D)${benar}(\\D|$)`));
  });

  it("kode sumber jawab tidak pernah mencatat jawaban ke log", () => {
    const akar = path.resolve(import.meta.dirname, "../..");
    for (const f of ["src/lib/layanan/jawab.ts", "src/lib/penjawab.ts", "src/app/api/kejadian/[id]/jawab/route.ts", "src/app/api/perangkat/kejadian/[id]/luring/route.ts"]) {
      const isi = readFileSync(path.join(akar, f), "utf8");
      for (const m of isi.matchAll(/log\.\w+\(([^;]*)\)/g)) expect(m[1], f).not.toMatch(/jawaban|masukan/);
    }
  });
});

describe("tunda (PRD E1)", () => {
  it("soal tunda selalu Ringan 1 kali; jatah habis = tidak bisa tunda lagi; selama tunda tetap bisa menjawab", async () => {
    const A = await buatPengguna(u);
    const id = await berbunyi(A, { tunda: { jatah: 1, menit: 10 }, soal: { benar: 1 }, masihBangun: { aktif: false } });
    const { ambilSoal, jawab } = await Jw();
    const st = await ambilSoal(sesi(A), id, "tunda");
    expect(st).toMatchObject({ tujuan: "tunda", jenis: "hitungan", tingkat: "ringan", target: 1 });
    const kini = new Date(T.getTime() + 20_000);
    const h = await jawab(sesi(A), id, st.id, hitung(st.tampil.teks), kini);
    expect(h).toEqual({ hasil: "ditunda", sampai: new Date(kini.getTime() + 10 * 60_000) });
    expect(await kejadian(id)).toMatchObject({ status: "ditunda", jumlahTunda: 1 });
    expect((await galat(ambilSoal(sesi(A), id, "tunda"))).message).toBe("Alarm ini sedang tidak berbunyi.");
    // Bangun tunda habis: berbunyi lagi, jatah sudah habis.
    const { bangunkanTundaHabis } = await M();
    await dbPekerja().transaction((tx) => bangunkanTundaHabis(tx, new Date(kini.getTime() + 10 * 60_000)));
    expect((await galat(ambilSoal(sesi(A), id, "tunda"))).message).toBe("Jatah tunda sudah habis. Jawab soalnya untuk mematikan alarm.");
    const sb = await ambilSoal(sesi(A), id, "bangun");
    expect((await jawab(sesi(A), id, sb.id, hitung(sb.tampil.teks))).hasil).toBe("selesai");
  });

  it("jatah 0 = tidak ada tunda sama sekali", async () => {
    const A = await buatPengguna(u);
    const id = await berbunyi(A, { tunda: { jatah: 0 } });
    expect((await galat((await Jw()).ambilSoal(sesi(A), id, "tunda"))).message).toContain("Jatah tunda sudah habis");
  });
});

describe("Masih bangun? (PRD E2)", () => {
  async function lolos(A: string, id: string, pada: Date) {
    const { ambilSoal, jawab } = await Jw();
    let s = await ambilSoal(sesi(A), id, "bangun");
    for (;;) {
      const h = await jawab(sesi(A), id, s.id, hitung(s.tampil.teks), pada);
      if (h.hasil === "selesai") return h;
      if (h.hasil !== "benar") throw new Error(h.hasil);
      s = h.soal;
    }
  }

  it("diketuk dalam jendelanya = bangun; terlalu cepat ditolak", async () => {
    const A = await buatPengguna(u);
    const id = await berbunyi(A, { masihBangun: { aktif: true, menit: 3, batasDtk: 90 } });
    const pada = new Date(T.getTime() + 30_000);
    await lolos(A, id, pada);
    const { konfirmasiMasihBangun } = await Jw();
    expect((await galat(konfirmasiMasihBangun(sesi(A), id, new Date(pada.getTime() + 60_000)))).message).toContain("Belum waktunya");
    expect(await konfirmasiMasihBangun(sesi(A), id, new Date(pada.getTime() + 3 * 60_000 + 10_000))).toEqual({ status: "bangun" });
    expect((await kejadian(id)).status).toBe("bangun");
  });

  it("tidak diketuk sampai batas = berbunyi lagi penuh, TANPA tunda, soal baru", async () => {
    const A = await buatPengguna(u);
    const id = await berbunyi(A, { masihBangun: { aktif: true, menit: 5, batasDtk: 60 }, tunda: { jatah: 3 } });
    const pada = new Date(T.getTime() + 30_000);
    await lolos(A, id, pada);
    const { Penjadwal } = await import("@/lib/penjadwal/penjadwal");
    let jam = new Date(pada.getTime() + 5 * 60_000);
    const p = new Penjadwal({ db: dbPekerja, jam: () => jam });
    await p.putar();
    await p.tenang();
    expect((await kejadian(id)).status).toBe("cek_bangun");
    jam = new Date(pada.getTime() + 6 * 60_000);
    await p.putar();
    await p.tenang();
    expect(await kejadian(id)).toMatchObject({ status: "berbunyi", tanpaTunda: true, cekPada: null, bangunPada: null });
    const { ambilSoal, konfirmasiMasihBangun } = await Jw();
    expect((await galat(ambilSoal(sesi(A), id, "tunda"))).message).toContain("Jatah tunda sudah habis");
    expect((await galat(konfirmasiMasihBangun(sesi(A), id))).message).toBe("Alarm ini sedang tidak berbunyi.");
    expect((await ambilSoal(sesi(A), id, "bangun")).benarBeruntun).toBe(0);
  });
});

describe("ingat angka dan ketik kalimat", () => {
  it("ingat: deret 6 angka, disembunyikan sesudah 3 dtk", async () => {
    const A = await buatPengguna(u);
    const id = await berbunyi(A, { soal: { jenis: "ingat", benar: 1 }, masihBangun: { aktif: false } });
    const { ambilSoal, jawab } = await Jw();
    const s = await ambilSoal(sesi(A), id, "bangun");
    expect(s.tampil.teks).toMatch(/^[1-9]\d{5}$/);
    expect(s.tampil.sembunyiSetelahMs).toBe(3_000);
    expect((await jawab(sesi(A), id, s.id, s.tampil.teks)).hasil).toBe("selesai");
  });

  it("ketik: judul agenda, huruf besar/kecil dan spasi ganda diabaikan", async () => {
    const A = await buatPengguna(u);
    const id = await berbunyi(A, { soal: { jenis: "ketik", benar: 1 }, agendaJudul: "Presentasi klien", masihBangun: { aktif: false } });
    const { ambilSoal, jawab } = await Jw();
    const s = await ambilSoal(sesi(A), id, "bangun");
    expect(s.tampil.teks).toBe("Presentasi klien");
    expect((await jawab(sesi(A), id, s.id, "presentasi  KLIEN")).hasil).toBe("selesai");
  });
});

describe("Misi QR (PRD D4, D6)", () => {
  async function kodeDanIsi(A: string, nama: string) {
    const { buatKodeQr } = await Q();
    const kq = await buatKodeQr(A, nama, "web");
    const [r] = await u.jalan(A, (tx) => tx.select().from(schema.kodeQr).where(eq(schema.kodeQr.id, kq.id)));
    const { bukaRahasia } = await import("@/lib/kripto");
    return { id: kq.id, isi: bukaRahasia(r.isiTersandi, `kode_qr:${A}`) };
  }

  it("pindaian kode yang benar mematikan; kode salah 3 kali = diganti hitungan Berat 3 soal", async () => {
    const A = await buatPengguna(u);
    const q = await kodeDanIsi(A, "kamar mandi");
    const lain = await kodeDanIsi(A, "dapur");
    const id = await berbunyi(A, { soal: { jenis: "qr", kodeQr: [q.id] }, masihBangun: { aktif: false } });
    const { ambilSoal, jawab } = await Jw();
    let s = await ambilSoal(sesi(A), id, "bangun");
    expect(s).toMatchObject({ jenis: "qr", target: 1, tampil: { teks: "", tempat: ["kamar mandi"] } });
    // Kode lain milik sendiri (bukan yang dipilih) dan teks acak = salah.
    for (const coba of [lain.isi, "https://contoh.id", "antikebo-qr:palsu"]) {
      const h = await jawab(sesi(A), id, s.id, coba);
      if (h.hasil === "selesai" || h.hasil === "ditunda") throw new Error("tidak boleh lolos");
      s = h.soal;
    }
    expect(s).toMatchObject({ jenis: "hitungan", tingkat: "berat", target: 3 });
  });

  it("kode benar langsung lolos", async () => {
    const A = await buatPengguna(u);
    const q = await kodeDanIsi(A, "kamar mandi");
    const id = await berbunyi(A, { soal: { jenis: "qr", kodeQr: [q.id] }, masihBangun: { aktif: false } });
    const { ambilSoal, jawab } = await Jw();
    const s = await ambilSoal(sesi(A), id, "bangun");
    expect(await jawab(sesi(A), id, s.id, ` ${q.isi} `)).toMatchObject({ hasil: "selesai", status: "bangun" });
  });

  it("kamera ditolak = langsung hitungan Berat 3 soal", async () => {
    const A = await buatPengguna(u);
    const q = await kodeDanIsi(A, "teras");
    const id = await berbunyi(A, { soal: { jenis: "qr", kodeQr: [q.id] } });
    const { ambilSoal, gantiSoalKamera } = await Jw();
    await ambilSoal(sesi(A), id, "bangun");
    expect(await gantiSoalKamera(sesi(A), id)).toMatchObject({ jenis: "hitungan", tingkat: "berat", target: 3 });
  });

  it("gabungan: hitungan dulu, lalu Misi QR", async () => {
    const A = await buatPengguna(u);
    const q = await kodeDanIsi(A, "garasi");
    const id = await berbunyi(A, { soal: { jenis: "gabungan", benar: 1, kodeQr: [q.id] }, masihBangun: { aktif: false } });
    const { ambilSoal, jawab } = await Jw();
    const s = await ambilSoal(sesi(A), id, "bangun");
    expect(s).toMatchObject({ jenis: "hitungan", tahap: 0, jumlahTahap: 2 });
    const t = await jawab(sesi(A), id, s.id, hitung(s.tampil.teks));
    expect(t.hasil).toBe("tahap");
    if (t.hasil !== "tahap") return;
    expect(t.soal).toMatchObject({ jenis: "qr", tahap: 1, tampil: { tempat: ["garasi"] } });
    expect(await jawab(sesi(A), id, t.soal.id, q.isi)).toMatchObject({ hasil: "selesai" });
  });

  it("kode QR: maks 10, tidak bisa dihapus selama dipakai alarm, kode orang lain ditolak, gambar cetak SVG", async () => {
    const A = await buatPengguna(u);
    const B = await buatPengguna(u);
    const { buatKodeQr, hapusKodeQr, daftarKodeQr, gambarKodeQr, ubahNamaKodeQr } = await Q();
    const q = await buatKodeQr(A, "kamar mandi", "web");
    const a = await (await L()).buatAlarm(A, { jam: "05:00", soal: { jenis: "qr", kodeQr: [q.id] } }, "web", { sekarang: SIANG });
    expect((await daftarKodeQr(A))[0]).toMatchObject({ id: q.id, dipakai: 1 });
    expect((await galat(hapusKodeQr(A, q.id, "web"))).message).toContain("masih dipakai alarm Bangun");
    expect((await galat((await L()).buatAlarm(B, { jam: "05:00", soal: { jenis: "qr", kodeQr: [q.id] } }, "web", { sekarang: SIANG }))).message).toContain(
      "kode QR yang dipilih tidak ditemukan",
    );
    expect((await ubahNamaKodeQr(A, q.id, "wastafel", "web")).nama).toBe("wastafel");
    const g = await gambarKodeQr(A, q.id);
    expect(g.svg).toContain("<svg");
    await expect(gambarKodeQr(B, q.id)).rejects.toThrow("Kode QR tidak ditemukan.");
    await (await L()).ubahAlarm(A, a.id, { soal: { jenis: "hitungan", kodeQr: [] } }, "web", { sekarang: SIANG });
    await hapusKodeQr(A, q.id, "web");
    for (let i = 0; i < 10; i++) await buatKodeQr(A, `tempat ${i}`, "web");
    expect((await galat(buatKodeQr(A, "kelebihan", "web"))).message).toBe("Paling banyak 10 kode QR. Hapus yang tidak dipakai dulu.");
  });
});

describe("anti curang (PRD D7)", () => {
  it("pengguna lain, kejadian lain, dan kejadian yang sudah berhenti tidak bisa dijawab", async () => {
    const A = await buatPengguna(u);
    const B = await buatPengguna(u);
    const idA = await berbunyi(A, { masihBangun: { aktif: false }, soal: { benar: 1 } });
    const idA2 = await berbunyi(A, { jam: "05:00", agendaJudul: "Kedua" });
    const { ambilSoal, jawab } = await Jw();
    expect((await galat(ambilSoal(sesi(B), idA, "bangun"))).kode).toBe("tidak_ditemukan");
    const s = await ambilSoal(sesi(A), idA, "bangun");
    expect((await galat(jawab(sesi(B), idA, s.id, hitung(s.tampil.teks)))).kode).toBe("tidak_ditemukan");
    // Soal kejadian A tidak bisa dipakai menjawab kejadian A2.
    expect((await galat(jawab(sesi(A), idA2, s.id, hitung(s.tampil.teks)))).message).toContain("Soalnya sudah berganti");
    await jawab(sesi(A), idA, s.id, hitung(s.tampil.teks));
    expect((await galat(ambilSoal(sesi(A), idA, "bangun"))).message).toBe("Alarm ini sedang tidak berbunyi.");
  });

  it("rute jawab: tanpa sesi/token 401, token perangkat pemilik bisa, batas laju 30 per menit", async () => {
    const A = await buatPengguna(u);
    const id = await berbunyi(A, { soal: { benar: 1 }, masihBangun: { aktif: false } });
    const P = await import("@/lib/layanan/perangkat");
    const kode = await P.mintaKodeSambung({ nama: "PC" });
    await P.setujuiKodeSambung(A, kode.kode, "web");
    const h = await P.ambilTokenSambung({ kode: kode.kode, rahasia: kode.rahasia });
    if (h.status !== "tersambung") throw new Error("sambung gagal");
    const { GET } = await import("@/app/api/kejadian/[id]/soal/route");
    const { POST } = await import("@/app/api/kejadian/[id]/jawab/route");
    const ctx = { params: Promise.resolve({ id }) };
    const tanpa = await POST(new Request(`http://localhost:3100/api/kejadian/${id}/jawab`, { method: "POST", body: "{}" }), ctx);
    expect([401, 403]).toContain(tanpa.status);
    const auth = { Authorization: `Bearer ${h.token}` };
    const rs = await GET(new Request(`http://localhost:3100/api/kejadian/${id}/soal`, { headers: auth }), ctx);
    const { soal } = (await rs.json()) as { soal: { id: string; tampil: { teks: string } } };
    const benar = hitung(soal.tampil.teks);
    expect(JSON.stringify(soal)).not.toContain(`"${benar}"`);
    for (let i = 0; i < 29; i++) {
      const r = await POST(
        new Request(`http://localhost:3100/api/kejadian/${id}/jawab`, {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ soalId: "00000000-0000-4000-8000-000000000000", jawaban: "1" }),
        }),
        ctx,
      );
      expect(r.status).toBe(400);
    }
    const ok = await POST(
      new Request(`http://localhost:3100/api/kejadian/${id}/jawab`, { method: "POST", headers: auth, body: JSON.stringify({ soalId: soal.id, jawaban: benar }) }),
      ctx,
    );
    expect(await ok.json()).toMatchObject({ hasil: "selesai" });
    expect((await kejadian(id)).selesaiOleh).toBe("perangkat");
    const lewat = await POST(
      new Request(`http://localhost:3100/api/kejadian/${id}/jawab`, { method: "POST", headers: auth, body: JSON.stringify({ soalId: soal.id, jawaban: benar }) }),
      ctx,
    );
    expect(lewat.status).toBe(429);
  });
});

describe("luring (PRD D8)", () => {
  it("jawaban luring PC diperiksa ulang dari benih kunci kejadian", async () => {
    const A = await buatPengguna(u);
    const id = await berbunyi(A, { soal: { tingkat: "sedang", benar: 2 }, masihBangun: { aktif: false } });
    const k = await kejadian(id);
    const kunci = `${k.alarmId}:${k.tanggalLokal}`;
    const { benihLuring, buatHitungan } = await import("@/lib/soal/soal");
    const benar = [buatHitungan("sedang", await benihLuring(kunci, 0)).jawaban, buatHitungan("sedang", await benihLuring(kunci, 1)).jawaban];
    const { selesaiLuring } = await Jw();
    const pc = { penggunaId: A, id: crypto.randomUUID() };
    expect(await selesaiLuring(pc, id, ["1", "2"], new Date(T.getTime() + 60_000))).toEqual({ lolos: false });
    expect(await selesaiLuring(pc, id, benar, new Date(T.getTime() - 60_000))).toEqual({ lolos: false });
    expect(await selesaiLuring(pc, id, benar, new Date(T.getTime() + 60_000))).toEqual({ lolos: true });
    expect(await kejadian(id)).toMatchObject({ status: "bangun", selesaiOleh: "luring", perangkatSelesai: pc.id });
  });
});

describe("data layar alarm (P8)", () => {
  it("berbunyi: judul, jam, tunda, suara; tanpa jawaban. Lolos: ringkasan Selamat pagi dengan skor", async () => {
    const A = await buatPengguna(u, "Nugi Pratama");
    const id = await berbunyi(A, { agendaJudul: "Presentasi klien", agendaDetail: "Bawa laptop", soal: { benar: 1 } });
    const { layarKejadian } = await import("@/lib/layanan/kejadian");
    const l = await layarKejadian(A, id);
    expect(l).toMatchObject({
      status: "berbunyi",
      judul: "Presentasi klien",
      detail: "Bawa laptop",
      jam: "05.00",
      tunda: { terpakai: 0, jatah: 2, menit: 5, boleh: true },
      masihBangun: { aktif: true, menit: 5, batasDtk: 60 },
      nama: "Nugi",
      pagi: null,
    });
    expect(l.suara.bunyi).toBe("klasik");
    expect(l.suara.omelan.length).toBeGreaterThan(10);
    expect(l.suara.omelan.every((o) => o.klip === null && o.teks.length > 0)).toBe(true);
    expect(JSON.stringify(l)).not.toMatch(/hash_jawaban|hashJawaban|garam/);

    // Soal terjawab 7 menit sesudah berbunyi: Selamat pagi dengan skor sementara 95.
    const { ambilSoal, jawab, konfirmasiMasihBangun } = await Jw();
    const s = await ambilSoal(sesi(A), id, "bangun");
    const lolos = new Date(T.getTime() + 7 * 60_000);
    expect(await jawab(sesi(A), id, s.id, hitung(s.tampil.teks), lolos)).toMatchObject({ hasil: "selesai", status: "cek_bangun" });
    expect((await layarKejadian(A, id)).pagi).toEqual({ jamBangun: "05.07", menit: 7, tunda: 0, skor: 95 });
    await konfirmasiMasihBangun(sesi(A), id, new Date(lolos.getTime() + 5 * 60_000));
    expect(await layarKejadian(A, id)).toMatchObject({ status: "bangun", pagi: { jamBangun: "05.07", skor: 95 } });
  });

  it("kejadian milik pengguna lain tidak terlihat", async () => {
    const A = await buatPengguna(u);
    const B = await buatPengguna(u);
    const id = await berbunyi(A);
    const { layarKejadian } = await import("@/lib/layanan/kejadian");
    expect((await galat(layarKejadian(B, id))).kode).toBe("tidak_ditemukan");
    expect((await galat(layarKejadian(A, "bukan-uuid"))).kode).toBe("tidak_ditemukan");
  });
});
