/**
 * Galat bisnis yang aman ditampilkan ke pengguna / agen. `kode` stabil
 * (dipakai SKILL.md & UI), `pesan` kalimat manusia bahasa Indonesia.
 */
export type KodeGalat =
  | "belum_tersambung" // belum ada kunci Tuya
  | "kunci_bermasalah" // kunci ditolak / kedaluwarsa
  | "kunci_tidak_sah" // bentuk kunci salah saat menyimpan
  | "tidak_ditemukan"
  | "ambigu"
  | "offline"
  | "tidak_didukung"
  | "di_luar_rentang"
  | "nilai_tidak_sah"
  | "perlu_konfirmasi"
  | "ir_belum_dipasang" // AC remote IR belum dipasangkan kode remotenya
  | "batas_laju"
  | "tuya_gangguan"
  | "masukan";

export class GalatLayanan extends Error {
  readonly kode: KodeGalat;
  readonly tambahan: Record<string, unknown>;
  constructor(kode: KodeGalat, pesan: string, tambahan: Record<string, unknown> = {}) {
    super(pesan);
    this.name = "GalatLayanan";
    this.kode = kode;
    this.tambahan = tambahan;
  }
}

export type Sumber = "web" | "agen" | "jadwal" | "suasana" | "otomasi" | "sistem";

/** Normalisasi teks untuk pencocokan nama (huruf kecil, tanpa aksen/tanda baca, spasi tunggal). */
export function normal(teks: string): string {
  return teks
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
