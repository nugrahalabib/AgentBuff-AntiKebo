import data2026 from "./libur/2026.json";
import data2027 from "./libur/2027.json";

/**
 * Libur nasional Indonesia (PRD B5). Sumber resmi tiap tahun tercatat di berkasnya
 * (`libur/<tahun>.json`: SKB Menteri Agama, Menteri Ketenagakerjaan, dan Menteri PANRB).
 * Opsi alarm "jangan bunyi saat libur nasional" hanya melompati **libur nasional**; cuti bersama
 * tetap berbunyi (banyak pekerja swasta tetap masuk, K-33). Tahun tanpa data = tidak ada yang
 * dilompati; `adaDataLibur` dipakai layar untuk memberi tahu. Data tahun baru wajib ditambah
 * begitu SKB-nya terbit (biasanya September/Oktober tahun sebelumnya); isinya diperiksa
 * `tests/unit/libur.test.ts`.
 */

type BerkasLibur = { tahun: number; sumber: string; diperiksa: string; libur: Array<{ tanggal: string; nama: string }>; cutiBersama: Array<{ tanggal: string; nama: string }> };

const SEMUA: BerkasLibur[] = [data2026, data2027];

const LIBUR = new Map<string, string>();
const CUTI = new Map<string, string>();
for (const b of SEMUA) {
  for (const l of b.libur) LIBUR.set(l.tanggal, l.nama);
  for (const c of b.cutiBersama) CUTI.set(c.tanggal, c.nama);
}

export const TAHUN_DATA_LIBUR: readonly number[] = SEMUA.map((b) => b.tahun);

export function adaDataLibur(tahun: number): boolean {
  return TAHUN_DATA_LIBUR.includes(tahun);
}

export function adalahLiburNasional(tanggal: string): boolean {
  return LIBUR.has(tanggal);
}

/** Keterangan hari untuk ditampilkan ("Besok libur Idulfitri"). */
export function jenisHari(tanggal: string): { jenis: "libur" | "cuti_bersama"; nama: string } | null {
  const l = LIBUR.get(tanggal);
  if (l) return { jenis: "libur", nama: l };
  const c = CUTI.get(tanggal);
  return c ? { jenis: "cuti_bersama", nama: c } : null;
}

export function berkasLibur(): readonly BerkasLibur[] {
  return SEMUA;
}
