// Daftar layar galeri prototipe (P1). Modul biasa (bukan "use client") supaya halaman server bisa memakainya.
export const DAFTAR_LAYAR = [
  "beranda",
  "berandaKosong",
  "ubah",
  "bunyiHitungan",
  "bunyiQr",
  "pagi",
  "cek",
  "jamMejaSebelum",
  "jamMejaSiaga",
  "siaga",
  "unduh",
  "riwayat",
  "pengaturan",
  "orientasi",
  "pc",
] as const;
export type IdLayar = (typeof DAFTAR_LAYAR)[number];
