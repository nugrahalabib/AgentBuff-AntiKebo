/**
 * Nama ramah untuk pengaturan & bacaan perangkat Tuya. Nama dari model Tuya
 * sering berupa kode atau bahasa Mandarin, jadi urutannya:
 *   1. label kurasi di berkas ini (ada keterangan untuk pengguna awam),
 *   2. kamus kode standar resmi Tuya (kamus-dp.ts, 483 kode, 35 kategori),
 *   3. varian bernomor (relay_status_1 -> "Saat listrik kembali 1"),
 *   4. nama dari Tuya bila bukan aksara Mandarin, terakhir kode itu sendiri.
 * Tidak ada yang pernah disembunyikan hanya karena tidak dikenal.
 */

import { KAMUS_DP, type EntriDp } from "./kamus-dp";

type Bahasa = "id" | "en";
type Label = { id: string; en: string; ketId?: string; ketEn?: string; pilihan?: Record<string, { id: string; en: string }> };

const LABEL: Record<string, Label> = {
  swing: { id: "Ayunan (swing)", en: "Swing", ketId: "Bilah AC bergerak naik-turun.", ketEn: "AC louvers move up and down." },
  do_not_disturb: { id: "Jangan ganggu", en: "Do not disturb", ketId: "Lampu tidak menyala sendiri saat listrik kembali.", ketEn: "Light stays off when power returns." },
  lightpixel_number_set: { id: "Jumlah titik lampu strip", en: "Strip pixel count", ketId: "Sesuaikan dengan panjang strip yang terpasang.", ketEn: "Match the installed strip length." },
  light_mode: { id: "Lampu indikator", en: "Indicator light" },
  relay_status_1: { id: "Saat listrik kembali", en: "After power returns" },
  child_lock: { id: "Kunci anak", en: "Child lock", ketId: "Tombol fisik di perangkat dikunci.", ketEn: "Physical buttons are locked." },
  sleep: { id: "Mode tidur", en: "Sleep mode" },
  eco: { id: "Mode hemat", en: "Eco mode" },
  light: { id: "Lampu layar", en: "Display light" },
  anion: { id: "Ion negatif", en: "Anion" },
  heat: { id: "Pemanas", en: "Heat" },
  switch_inching: { id: "Mode sentuh (inching)", en: "Inching" },
  overcharge_switch: { id: "Lindungi dari isi berlebih", en: "Overcharge protection" },
  switch_backlight: { id: "Lampu latar", en: "Backlight" },
  battery_percentage: { id: "Baterai", en: "Battery" },
  light_length: { id: "Panjang strip", en: "Strip length" },
  light_pixel: { id: "Titik lampu", en: "Pixels" },
};

const MANDARIN = /[㐀-鿿豈-﫿]/;

function cari(kode: string): { entri: Label; nomor?: string } | null {
  const m = /^(.+?)_(\d{1,2})$/.exec(kode);
  const langsung = !!(LABEL[kode] || KAMUS_DP[kode]);
  const kurasi: Label | undefined = LABEL[kode] ?? (m ? LABEL[m[1]] : undefined);
  const resmi: EntriDp | undefined = KAMUS_DP[kode] ?? (m ? KAMUS_DP[m[1]] : undefined);
  if (!kurasi && !resmi) return null;
  const entri = { ...resmi, ...kurasi, pilihan: { ...resmi?.pilihan, ...kurasi?.pilihan } } as Label;
  return { entri, nomor: !langsung && m ? m[2] : undefined };
}

/** Nama + keterangan dalam bahasa yang diminta; `cadangan` = nama dari Tuya. */
export function labelProperti(kode: string, cadangan: string, bahasa: Bahasa = "id"): { nama: string; keterangan?: string } {
  const c = cari(kode);
  if (!c) return { nama: cadangan && cadangan !== kode && !MANDARIN.test(cadangan) ? cadangan : kode.replace(/_/g, " ") };
  const l = c.entri;
  const nama = bahasa === "id" ? l.id : l.en;
  return { nama: c.nomor ? `${nama} ${c.nomor}` : nama, keterangan: (bahasa === "id" ? l.ketId : l.ketEn) || undefined };
}

/** Nama ramah untuk satu pilihan (mis. relay_status "memory" -> "Seperti sebelumnya", sd_status 5 -> "Tidak ada kartu"). */
export function labelPilihan(kode: string, nilai: string | number, bahasa: Bahasa = "id"): string {
  const p = cari(kode)?.entri.pilihan?.[String(nilai)];
  return p ? p[bahasa] : String(nilai);
}

/** Apakah kamus resmi punya arti untuk nilai angka ini (mis. status kartu SD 1..5). */
export function punyaArtiAngka(kode: string, nilai: number): boolean {
  return !!cari(kode)?.entri.pilihan?.[String(nilai)];
}
