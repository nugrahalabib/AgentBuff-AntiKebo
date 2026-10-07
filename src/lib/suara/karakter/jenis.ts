/**
 * Bentuk naskah satu karakter omelan (docs/10-SUARA.md §2). Data murni, ditulis tangan (TANPA AI
 * saat aplikasi berjalan). Placeholder: `{nama}` (nama panggilan), `{agenda}` (judul agenda).
 * Maks 150 huruf per kalimat, semua lolos `saring.ts` (dijaga tes).
 */
export type MenitWaktu = 3 | 5 | 10 | 15 | 30;
export const MENIT_WAKTU: readonly MenitWaktu[] = [3, 5, 10, 15, 30];

export type Naskah = {
  /** ≥ 12 kalimat umum, galak sejak awal, memakai {nama}. */
  umum: string[];
  /** Kalimat waktu, disisipkan tepat sesudah menit itu berlalu. */
  waktu: Record<MenitWaktu, string>;
  /** 3 kalimat agenda memakai {agenda}. */
  agenda: string[];
  /** Kalimat "Masih bangun?". */
  cek: string;
  /** Kalimat penutup sesudah bangun (juga dipakai pesan kanal). */
  penutup: string;
};

export type NaskahKarakter = { id: Naskah; en: Naskah };
