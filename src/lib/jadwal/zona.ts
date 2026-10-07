import { TZDate, tzOffset } from "@date-fns/tz";
import { keTanggal, uraiTanggal } from "./tanggal";

/**
 * Jembatan tanggal-jam lokal dan instan UTC per zona IANA. MURNI. Indonesia tidak memakai jam musim
 * panas, tetapi aturannya tetap pasti untuk zona yang memakai (pengguna di luar negeri):
 *
 *  - jam lokal yang **tidak ada** (maju 1 jam) bergeser maju sebesar celahnya
 *    (02.30 New York saat maju = 03.30);
 *  - jam lokal yang **muncul dua kali** (mundur 1 jam) memakai kemunculan **pertama**.
 *
 * `TZDate` sendiri tidak konsisten di kasus kedua (beda hasil antar zona), jadi aturan di atas
 * dihitung sendiri dari `tzOffset`.
 */

const SEHARI = 86_400_000;

export function zonaSah(zona: string): boolean {
  if (!zona || zona.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

export type BagianLokal = { tanggal: string; jam: number; menit: number };

/** Tanggal dan jam lokal dari sebuah instan di `zona`. */
export function bagianLokal(instan: Date, zona: string): BagianLokal {
  const d = new TZDate(instan.getTime(), zona);
  return { tanggal: keTanggal(d.getFullYear(), d.getMonth() + 1, d.getDate()), jam: d.getHours(), menit: d.getMinutes() };
}

/** Instan untuk tanggal lokal `tanggal` jam `jam:menit` di `zona` (aturan celah/ganda di atas). */
export function instanLokal(tanggal: string, jam: number, menit: number, zona: string): Date {
  const { tahun, bulan, tanggal: h } = uraiTanggal(tanggal);
  const dinding = Date.UTC(tahun, bulan - 1, h, jam, menit);
  const sebelum = tzOffset(zona, new Date(dinding - SEHARI));
  const sesudah = tzOffset(zona, new Date(dinding + SEHARI));
  const calon = [...new Set([dinding - sebelum * 60_000, dinding - sesudah * 60_000])]
    .filter((t) => {
      const b = bagianLokal(new Date(t), zona);
      return b.tanggal === tanggal && b.jam === jam && b.menit === menit;
    })
    .sort((a, b) => a - b);
  if (calon.length) return new Date(calon[0]);
  // Jam lokal jatuh di celah maju: pakai selisih sebelum celah, hasilnya bergeser maju sebesar celah.
  return new Date(dinding - sebelum * 60_000);
}
