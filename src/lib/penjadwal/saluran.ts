import type { IsiAlarm } from "@/lib/alarm/isi";
import type { schema } from "@/lib/db";

/**
 * Saluran = satu jenis langkah yang dijalankan worker selama kejadian berbunyi (arsitektur §4.4):
 * notifikasi web (P6), spam kanal (P6), rumah pintar (P7), batas berhenti sendiri (PRD C4).
 * Implementasi TIRUAN di bawah (hanya mencatat hasil) dipakai uji mesin langkah; worker memasang
 * saluran asli (`saluran-asli.ts`, P6) lewat `pasangSaluran`. Tuya asli menyusul di P7.
 */

export type BarisKejadian = typeof schema.kejadianAlarm.$inferSelect;
export type BarisLangkah = typeof schema.langkahKejadian.$inferSelect;

/** Isi yang disalin ke kejadian saat mulai berbunyi (`kejadian_alarm.isi`). */
export type IsiKejadian = IsiAlarm & { zona: string };

export type RencanaLangkah = { jatuhTempo: Date; urutan?: number; parameter?: Record<string, unknown> };

export type KonteksLangkah = {
  kejadian: BarisKejadian;
  isi: IsiKejadian | null;
  langkah: BarisLangkah;
  sekarang: Date;
};

export type HasilLangkah = {
  hasil: Record<string, unknown>;
  /** Jadwalkan ulangan berikutnya (selama kejadian masih berbunyi). */
  ulangiPada?: Date;
  gagal?: boolean;
  /** Akhiri kejadian (batas waktu PRD C4). */
  akhiri?: "tidak_bangun";
  /** "Masih bangun?" tidak diketuk sampai batasnya: alarm kembali penuh (PRD E2). */
  bunyikanLagi?: true;
  /** Parameter untuk ulangan berikutnya (mis. platform kanal yang baru diketahui). Bawaan: sama. */
  parameterBaru?: Record<string, unknown>;
};

/** Status akhir kejadian yang memicu `rencanaSelesai`. */
export type StatusSelesai = "bangun" | "tidak_bangun" | "dibatalkan";

/**
 * Kapan langkah saluran pantas dijalankan: `berbunyi` (bawaan; juga saat ditunda bila
 * `saatTunda` = lanjut), `pra` (sebelum berbunyi sampai selesai berbunyi), `tunda` (status
 * ditunda), `cek` (status cek_bangun), `terlewat`, `selesai` (sesudah berhenti).
 */
export type FaseSaluran = "berbunyi" | "pra" | "tunda" | "cek" | "terlewat" | "selesai";

export interface Saluran {
  jenis: string;
  fase?: FaseSaluran;
  /** Saat ditunda: `lanjut` tetap berjalan (Tuya), `berhenti` dibatalkan dan direncanakan ulang sesudah tunda. */
  saatTunda: "lanjut" | "berhenti";
  /** Langkah awal ketika kejadian mulai (atau kembali) berbunyi. */
  rencana(isi: IsiKejadian, mulai: Date, kejadian: BarisKejadian): RencanaLangkah[];
  /** Langkah untuk kejadian yang terlewat (server sempat mati > 30 menit). Opsional. */
  rencanaTerlewat?(isi: IsiKejadian | null, sekarang: Date, kejadian: BarisKejadian): RencanaLangkah[];
  /** Langkah sebelum berbunyi (rumah pintar naik bertahap), direncanakan saat jadwal tinggal ≤ 61 menit. Opsional. */
  rencanaPra?(isi: IsiKejadian, kejadian: BarisKejadian, sekarang: Date): RencanaLangkah[];
  /** Langkah saat kejadian ditunda (aturan rumah pintar "saat tunda"). Opsional. */
  rencanaTunda?(isi: IsiKejadian | null, sekarang: Date, kejadian: BarisKejadian): RencanaLangkah[];
  /** Langkah saat soal terjawab dan "Masih bangun?" menunggu (status `cek_bangun`). Opsional. */
  rencanaCek?(isi: IsiKejadian | null, sekarang: Date, kejadian: BarisKejadian): RencanaLangkah[];
  /** Langkah sesudah kejadian berhenti (pesan penutup, notifikasi diganti "sudah mati"). Opsional. */
  rencanaSelesai?(isi: IsiKejadian | null, sekarang: Date, kejadian: BarisKejadian, status: StatusSelesai): RencanaLangkah[];
  jalankan(k: KonteksLangkah): Promise<HasilLangkah>;
}

// ------------------------------------------------------------------ tiruan (diganti P6, P7)

const NOTIFIKASI_ULANG_MS = 30_000; // PRD G5

export const saluranNotifikasiTiruan: Saluran = {
  jenis: "notifikasi",
  saatTunda: "berhenti",
  rencana: (_isi, mulai) => [{ jatuhTempo: mulai }],
  async jalankan({ sekarang }) {
    return { hasil: { tiruan: true }, ulangiPada: new Date(sekarang.getTime() + NOTIFIKASI_ULANG_MS) };
  },
};

export const saluranSpamTiruan: Saluran = {
  jenis: "spam",
  saatTunda: "berhenti",
  // Satu deret langkah per kanal; urutan = indeks kanal * 100000 + ulangan (unik per kejadian).
  rencana: (isi, mulai) => isi.spam.kanal.map((kanal, i) => ({ jatuhTempo: mulai, urutan: i * 100_000, parameter: { kanal } })),
  async jalankan({ sekarang, isi }) {
    const jeda = Math.max(isi?.spam.jedaDtk ?? 15, 5) * 1000;
    return { hasil: { tiruan: true }, ulangiPada: new Date(sekarang.getTime() + jeda) };
  },
};

export const saluranTuyaTiruan: Saluran = {
  jenis: "tuya",
  saatTunda: "lanjut",
  rencana: (isi, mulai) => (isi.tuya.length ? [{ jatuhTempo: mulai, parameter: { aturan: isi.tuya.length } }] : []),
  async jalankan() {
    return { hasil: { tiruan: true } };
  },
};

export const saluranKabarTerlewatTiruan: Saluran = {
  jenis: "kabar_terlewat",
  fase: "terlewat",
  saatTunda: "lanjut",
  rencana: () => [],
  rencanaTerlewat: (_isi, sekarang) => [{ jatuhTempo: sekarang }],
  async jalankan() {
    return { hasil: { tiruan: true } };
  },
};

/** Saat "Masih bangun?" tampil: notifikasi + satu pesan kanal (P6). */
export const saluranCekTampilTiruan: Saluran = {
  jenis: "cek_tampil",
  fase: "cek",
  saatTunda: "lanjut",
  rencana: () => [],
  async jalankan() {
    return { hasil: { tiruan: true } };
  },
};
