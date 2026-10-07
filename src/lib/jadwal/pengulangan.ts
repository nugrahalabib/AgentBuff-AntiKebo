import { z } from "zod";
import { adalahLiburNasional } from "./libur";
import { hariPekan, jumlahHariBulan, nomorHari, seninPekan, tambahHari, tanggalSah, uraiTanggal } from "./tanggal";
import { bagianLokal, instanLokal } from "./zona";

/**
 * Mesin pengulangan alarm (PRD B3 sampai B6, arsitektur §3). MURNI: tanpa DB, tanpa jam mesin.
 * Hari: 0 = Minggu ... 6 = Sabtu. Jam lokal "HH:MM" di zona IANA, hasil instan UTC.
 * Contoh emas: `tests/emas/pengulangan.json`; tes properti: `tests/unit/pengulangan.test.ts`.
 */

export const SkemaJam = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "jam_tidak_sah");
export const SkemaTanggal = z.string().refine(tanggalSah, "tanggal_tidak_sah");
const Hari = z.int().min(0).max(6);
const DaftarHari = z
  .array(Hari)
  .min(1)
  .max(7)
  .transform((h) => [...new Set(h)].sort((a, b) => a - b));

export const SkemaPengulangan = z.discriminatedUnion("jenis", [
  /** Sekali pada tanggal lokal tertentu. */
  z.strictObject({ jenis: z.literal("sekali"), tanggal: SkemaTanggal }),
  z.strictObject({ jenis: z.literal("harian") }),
  /** Senin sampai Jumat. */
  z.strictObject({ jenis: z.literal("hari_kerja") }),
  /** Sabtu dan Minggu. */
  z.strictObject({ jenis: z.literal("akhir_pekan") }),
  z.strictObject({ jenis: z.literal("hari"), hari: DaftarHari }),
  /** Tiap N minggu pada hari terpilih, dihitung dari pekan (Senin) yang memuat `mulai`. */
  z.strictObject({ jenis: z.literal("tiap_minggu"), setiap: z.int().min(2).max(12), hari: DaftarHari, mulai: SkemaTanggal }),
  /** Bulanan tanggal X; bila bulan lebih pendek, jatuh ke hari terakhir bulan itu. */
  z.strictObject({ jenis: z.literal("bulanan_tanggal"), tanggal: z.int().min(1).max(31) }),
  /** Bulanan hari ke-N (1 sampai 4) atau terakhir (-1), mis. Senin pertama. */
  z.strictObject({ jenis: z.literal("bulanan_hari_ke"), ke: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]), hari: Hari }),
]);

export type Pengulangan = z.infer<typeof SkemaPengulangan>;
export type JenisPengulangan = Pengulangan["jenis"];

export type OpsiKejadian = {
  /** Tanggal lokal yang dilewati (PRD B4). */
  lewati?: Iterable<string>;
  /** Jangan berbunyi pada libur nasional (PRD B5). */
  liburNasional?: boolean;
  /** Pengganti data libur (tes). */
  adalahLibur?: (tanggal: string) => boolean;
};

export type Kejadian = { utc: Date; tanggal: string };

/** Batas cari ke depan. Aturan apa pun yang sah berulang paling jarang sebulan sekali (12 minggu untuk tiap N minggu). */
const BATAS_HARI = 4 * 366;

/** Apakah tanggal lokal `tanggal` termasuk aturan (tanpa memperhitungkan lewati/libur). */
export function cocok(p: Pengulangan, tanggal: string): boolean {
  switch (p.jenis) {
    case "sekali":
      return tanggal === p.tanggal;
    case "harian":
      return true;
    case "hari_kerja": {
      const h = hariPekan(tanggal);
      return h >= 1 && h <= 5;
    }
    case "akhir_pekan": {
      const h = hariPekan(tanggal);
      return h === 0 || h === 6;
    }
    case "hari":
      return p.hari.includes(hariPekan(tanggal));
    case "tiap_minggu": {
      if (nomorHari(tanggal) < nomorHari(p.mulai) || !p.hari.includes(hariPekan(tanggal))) return false;
      const pekan = (nomorHari(seninPekan(tanggal)) - nomorHari(seninPekan(p.mulai))) / 7;
      return pekan % p.setiap === 0;
    }
    case "bulanan_tanggal": {
      const { tahun, bulan, tanggal: h } = uraiTanggal(tanggal);
      return h === Math.min(p.tanggal, jumlahHariBulan(tahun, bulan));
    }
    case "bulanan_hari_ke": {
      if (hariPekan(tanggal) !== p.hari) return false;
      const { tahun, bulan, tanggal: h } = uraiTanggal(tanggal);
      return p.ke === -1 ? h + 7 > jumlahHariBulan(tahun, bulan) : Math.ceil(h / 7) === p.ke;
    }
  }
}

function dilompati(tanggal: string, lewati: Set<string>, opsi: OpsiKejadian): boolean {
  if (lewati.has(tanggal)) return true;
  return !!opsi.liburNasional && (opsi.adalahLibur ?? adalahLiburNasional)(tanggal);
}

/**
 * Kejadian berikutnya SESUDAH `setelah` (tidak sama dengan), atau null bila tidak ada lagi
 * (sekali yang sudah lewat, dilewati, atau jatuh di libur).
 */
export function kejadianBerikutnya(p: Pengulangan, jam: string, zona: string, setelah: Date, opsi: OpsiKejadian = {}): Kejadian | null {
  const [hh, mm] = jam.split(":").map(Number);
  const lewati = new Set(opsi.lewati ?? []);
  const coba = (tanggal: string): Kejadian | null => {
    if (!cocok(p, tanggal) || dilompati(tanggal, lewati, opsi)) return null;
    const utc = instanLokal(tanggal, hh, mm, zona);
    return utc.getTime() > setelah.getTime() ? { utc, tanggal } : null;
  };
  if (p.jenis === "sekali") return coba(p.tanggal);
  // Mulai sehari sebelum tanggal lokal `setelah`: jam yang jatuh di celah tengah malam bisa
  // bergeser ke tanggal berikutnya.
  const awal = tambahHari(bagianLokal(setelah, zona).tanggal, -1);
  for (let i = 0; i <= BATAS_HARI; i++) {
    const k = coba(tambahHari(awal, i));
    if (k) return k;
  }
  return null;
}

/** Semua kejadian dalam (dari, sampai], paling banyak `maks` (jadwal 24 jam untuk perangkat siaga). */
export function kejadianDalamRentang(p: Pengulangan, jam: string, zona: string, dari: Date, sampai: Date, opsi: OpsiKejadian = {}, maks = 50): Kejadian[] {
  const hasil: Kejadian[] = [];
  let titik = dari;
  while (hasil.length < maks) {
    const k = kejadianBerikutnya(p, jam, zona, titik, opsi);
    if (!k || k.utc.getTime() > sampai.getTime()) break;
    hasil.push(k);
    titik = k.utc;
  }
  return hasil;
}

/** Bentuk baku: daftar hari yang sama dengan jenis khusus diganti jenisnya (Sen-Jum = hari kerja). */
export function bakukan(p: Pengulangan): Pengulangan {
  if (p.jenis !== "hari") return p;
  const kunci = p.hari.join(",");
  if (kunci === "0,1,2,3,4,5,6") return { jenis: "harian" };
  if (kunci === "1,2,3,4,5") return { jenis: "hari_kerja" };
  if (kunci === "0,6") return { jenis: "akhir_pekan" };
  return p;
}

/** Tanggal lokal kemunculan `jam` berikutnya sesudah `sekarang` (hari ini bila belum lewat, selain itu besok). */
export function tanggalSekaliBerikutnya(jam: string, zona: string, sekarang: Date): string {
  const [hh, mm] = jam.split(":").map(Number);
  const hariIni = bagianLokal(sekarang, zona).tanggal;
  return instanLokal(hariIni, hh, mm, zona) > sekarang ? hariIni : tambahHari(hariIni, 1);
}
