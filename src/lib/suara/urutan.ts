import { Acak } from "@/lib/soal/acak";

/**
 * Urutan putar omelan (docs/10-SUARA.md §3, PRD C3). MURNI dan deterministik dari benih, supaya web
 * dan aplikasi PC (Rust) memutar urutan yang sama dan bisa diuji dengan contoh emas
 * (`tests/emas/urutan-suara.json`).
 *
 *  - Bahan: kalimat umum + agenda + pribadi. Diacak per putaran (Fisher-Yates dengan mulberry32),
 *    semua terpakai sebelum ada yang diulang, dan kalimat pertama putaran baru tidak boleh sama
 *    dengan kalimat terakhir putaran sebelumnya (bila ada lebih dari satu kalimat).
 *  - Kalimat waktu (menit 3, 5, 10, 15, 30) disisipkan TEPAT sesudah menit itu berlalu, sebelum
 *    kalimat acak berikutnya; masing-masing sekali.
 *  - Di antara omelan selalu ada jeda 3 detik bunyi alarm saja.
 */

export const JEDA_MS = 3_000;
export const REDAM_KE = 0.3;
export const REDAM_MS = 150;

export type Bahan = { id: string };
export type Waktu = { id: string; menit: number };

export type KeadaanUrutan = {
  /** Sisa urutan putaran sekarang (indeks bahan). */
  antrean: number[];
  terakhir: number | null;
  waktuTerputar: number[];
  putaran: number;
};

export function mulaiUrutan(): KeadaanUrutan {
  return { antrean: [], terakhir: null, waktuTerputar: [], putaran: 0 };
}

/** Satu putaran acak (Fisher-Yates, mulberry32). Dipakai juga urutan isi pesan kanal (`src/lib/pesan`). */
export function acakPutaran(n: number, benih: number, putaran: number, hindari: number | null): number[] {
  const r = new Acak((benih + Math.imul(putaran, 0x9e3779b1)) >>> 0);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = r.antara(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (n > 1 && hindari !== null && a[0] === hindari) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

/**
 * Kalimat berikutnya yang diputar pada saat `berlaluMs` sejak alarm mulai berbunyi.
 * Mengembalikan id kalimat (atau null bila tidak ada bahan sama sekali) dan keadaan baru.
 */
export function berikutnya(bahan: readonly Bahan[], waktu: readonly Waktu[], benih: number, k: KeadaanUrutan, berlaluMs: number): { id: string | null; keadaan: KeadaanUrutan } {
  const jatuh = waktu
    .filter((w) => !k.waktuTerputar.includes(w.menit) && berlaluMs >= w.menit * 60_000)
    .sort((a, b) => a.menit - b.menit)
    // Bila beberapa menit terlewat sekaligus (mis. layar baru dibuka), hanya yang terbaru diputar.
    .slice(-1);
  if (jatuh.length) {
    const sudah = waktu.filter((w) => w.menit <= jatuh[0].menit).map((w) => w.menit);
    return { id: jatuh[0].id, keadaan: { ...k, waktuTerputar: [...new Set([...k.waktuTerputar, ...sudah])] } };
  }
  if (!bahan.length) return { id: null, keadaan: k };
  let { antrean, putaran } = k;
  if (!antrean.length) {
    antrean = acakPutaran(bahan.length, benih, putaran, k.terakhir);
    putaran += 1;
  }
  const [i, ...sisa] = antrean;
  return { id: bahan[i].id, keadaan: { ...k, antrean: sisa, terakhir: i, putaran } };
}
