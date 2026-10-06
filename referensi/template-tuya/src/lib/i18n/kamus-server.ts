import { en } from "./kamus/en";
import { id } from "./kamus/id";
import type { Bahasa, Kamus } from "./index";

// Kamus dua bahasa untuk kode SERVER saja (metadata, layout, halaman server, manifest).
// ⛔ Jangan diimpor komponen klien — klien memuat kamus bahasa aktif lewat import() dinamis (`./klien`).
export function kamusUntuk(b: Bahasa): Kamus {
  return b === "en" ? en : id;
}
