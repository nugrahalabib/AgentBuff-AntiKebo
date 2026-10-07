// Tipe & fungsi bantu i18n, SENGAJA tanpa isi kamus: modul ini diimpor komponen klien, dan
// mengimpor kamus di sini mengirim kamus DUA bahasa ke setiap pengunjung. Kamus per bahasa:
// server lewat `./kamus-server`, klien lewat import() dinamis di `./klien`.
import type { Kamus } from "./kamus/id";

export type Bahasa = "id" | "en";
export type { Kamus };

export const BAHASA_DIDUKUNG: readonly Bahasa[] = ["id", "en"];
export const NAMA_COOKIE_BAHASA = "antikebo_bahasa";

export function bahasaSah(v: string | null | undefined): Bahasa {
  return v === "en" ? "en" : "id";
}

/** Isi placeholder `{nama}` dalam teks kamus. */
export function isi(teks: string, nilai: Record<string, string | number>): string {
  return teks.replace(/\{(\w+)\}/g, (_, k: string) => (k in nilai ? String(nilai[k]) : `{${k}}`));
}
