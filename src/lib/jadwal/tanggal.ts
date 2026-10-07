/**
 * Tanggal kalender polos "YYYY-MM-DD" (tanpa jam, tanpa zona). MURNI. Semua hitungan lewat
 * Date.UTC supaya tidak pernah tergelincir oleh zona waktu mesin.
 */

const POLA = /^(\d{4})-(\d{2})-(\d{2})$/;

export type BagianTanggal = { tahun: number; bulan: number; tanggal: number };

export function uraiTanggal(s: string): BagianTanggal {
  const m = POLA.exec(s);
  if (!m) throw new Error(`tanggal tidak sah: ${s}`);
  return { tahun: +m[1], bulan: +m[2], tanggal: +m[3] };
}

/** Benar bila `s` berbentuk YYYY-MM-DD dan tanggalnya ada di kalender (2026-02-30 = salah). */
export function tanggalSah(s: string): boolean {
  const m = POLA.exec(s);
  if (!m) return false;
  const [t, b, h] = [+m[1], +m[2], +m[3]];
  return t >= 1970 && t <= 2200 && b >= 1 && b <= 12 && h >= 1 && h <= jumlahHariBulan(t, b);
}

export function keTanggal(tahun: number, bulan: number, tanggal: number): string {
  const d = new Date(Date.UTC(tahun, bulan - 1, tanggal));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function jumlahHariBulan(tahun: number, bulan: number): number {
  return new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
}

/** Nomor hari sejak 1970-01-01 (untuk selisih dan pekan). */
export function nomorHari(s: string): number {
  const { tahun, bulan, tanggal } = uraiTanggal(s);
  return Math.round(Date.UTC(tahun, bulan - 1, tanggal) / 86_400_000);
}

export function tambahHari(s: string, n: number): string {
  const { tahun, bulan, tanggal } = uraiTanggal(s);
  return keTanggal(tahun, bulan, tanggal + n);
}

/** 0 = Minggu ... 6 = Sabtu. */
export function hariPekan(s: string): number {
  const { tahun, bulan, tanggal } = uraiTanggal(s);
  return new Date(Date.UTC(tahun, bulan - 1, tanggal)).getUTCDay();
}

/** Senin pada pekan yang memuat `s` (pekan Senin sampai Minggu). */
export function seninPekan(s: string): string {
  return tambahHari(s, -((hariPekan(s) + 6) % 7));
}
