// Logika MURNI gerbang hak, tanpa DB/jaringan supaya bisa diuji persis.
// Pemakainya: src/lib/agentbuff/status.ts.

export const ALASAN_HAK = ["ok", "akses_berakhir", "belum_aktif", "belum_beli", "diblokir", "dicabut", "tidak_dikenal"] as const;
export type AlasanHak = (typeof ALASAN_HAK)[number];
export type AlasanBeku = Exclude<AlasanHak, "ok"> | "tidak_terjangkau";

export const TOLERANSI_TAK_TERJANGKAU_MS = 72 * 60 * 60 * 1000;
export const SINGGAHAN_MS = 10 * 60 * 1000;

export type Tafsiran = { jenis: "jawaban"; aktif: boolean; alasan: AlasanHak; pesan: string; sub: string | null } | { jenis: "tidak_terjangkau"; kredensialDitolak: boolean };

/**
 * HANYA HTTP 200 dengan badan valid yang dianggap jawaban hak. Apa pun selain
 * itu = tidak terjangkau (pakai jawaban baik terakhir). 401/400 = kredensial
 * klien kita yang salah: operator wajib diberi tahu, BUKAN pengguna beku.
 */
export function tafsirJawabanStatus(httpStatus: number, badan: unknown): Tafsiran {
  if (httpStatus !== 200) {
    return { jenis: "tidak_terjangkau", kredensialDitolak: httpStatus === 401 || httpStatus === 400 };
  }
  if (!badan || typeof badan !== "object") return { jenis: "tidak_terjangkau", kredensialDitolak: false };
  const b = badan as Record<string, unknown>;
  if (typeof b.aktif !== "boolean" || typeof b.alasan !== "string") return { jenis: "tidak_terjangkau", kredensialDitolak: false };
  if (!(ALASAN_HAK as readonly string[]).includes(b.alasan)) return { jenis: "tidak_terjangkau", kredensialDitolak: false };
  const alasan = b.alasan as AlasanHak;
  // Konsistensi: aktif harus sejalan dengan alasan; jawaban janggal tidak dipercaya.
  if ((alasan === "ok") !== b.aktif) return { jenis: "tidak_terjangkau", kredensialDitolak: false };
  return {
    jenis: "jawaban",
    aktif: b.aktif,
    alasan,
    pesan: typeof b.pesan === "string" ? b.pesan.slice(0, 500) : "",
    sub: typeof b.sub === "string" ? b.sub : null,
  };
}

/** Kapan singgahan dianggap basi. Jitter tetap per pengguna (0 sampai 60 dtk) supaya pemeriksaan tersebar. */
export function jitterMs(penggunaId: string): number {
  let h = 0;
  for (let i = 0; i < penggunaId.length; i++) h = (h * 31 + penggunaId.charCodeAt(i)) >>> 0;
  return h % 60_000;
}

export function singgahanBasi(diperiksaPada: Date | null, penggunaId: string, sekarang: number): boolean {
  if (!diperiksaPada) return true;
  return sekarang - diperiksaPada.getTime() > SINGGAHAN_MS + jitterMs(penggunaId);
}

/** Jeda coba ulang setelah gagal menghubungi AgentBuff: 1, 2, 4, 8 ... maks 10 menit. */
export function jedaCobaLagiMs(gagalBeruntun: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, gagalBeruntun - 1), 10 * 60_000);
}

/** Tak terjangkau terlalu lama: beku netral `tidak_terjangkau`. */
export function melewatiToleransi(terakhirBaikPada: Date | null, sekarang: number): boolean {
  if (!terakhirBaikPada) return false;
  return sekarang - terakhirBaikPada.getTime() > TOLERANSI_TAK_TERJANGKAU_MS;
}
