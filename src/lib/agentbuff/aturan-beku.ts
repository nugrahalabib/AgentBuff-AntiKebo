/**
 * Aturan saat hak AgentBuff berakhir (K-07, rekomendasi yang dipakai sampai Chief memutuskan).
 * Satu modul MURNI supaya mudah diubah: data tetap, mengubah dikunci, alarm yang sudah terpasang
 * tetap berbunyi selama masa tenggang, pengguna diberi tahu saat beku terdeteksi dan malam sebelum
 * alarm pertama yang tidak lagi berbunyi.
 *
 * Hanya jawaban PASTI dari AgentBuff yang membekukan (baris `status_hak.aktif = false`). AgentBuff
 * yang tak terjangkau tidak pernah menahan alarm: baris lama tetap dipakai (K-12).
 */

export const TENGGANG_BEKU_MS = 72 * 3_600_000;

export type StatusBeku = { aktif: boolean; bekuSejak: Date | null };

/** Saat alarm berhenti dibunyikan karena beku; null = tidak ditahan (aktif, atau belum pernah diperiksa). */
export function akhirTenggang(s: StatusBeku | null | undefined): Date | null {
  if (!s || s.aktif) return null;
  if (!s.bekuSejak) return null;
  return new Date(s.bekuSejak.getTime() + TENGGANG_BEKU_MS);
}

/** Kejadian berjadwal `jadwal` tidak dibunyikan (server maupun perangkat siaga). */
export function alarmDitahan(s: StatusBeku | null | undefined, jadwal: Date): boolean {
  const akhir = akhirTenggang(s);
  return akhir !== null && jadwal.getTime() >= akhir.getTime();
}

/** Nilai `beku_sejak` baru sesudah AgentBuff menjawab: tetap dari awal masa beku, null bila aktif. */
export function bekuSejakBaru(lama: StatusBeku | null | undefined, aktifSekarang: boolean, sekarang: Date): Date | null {
  if (aktifSekarang) return null;
  if (lama && !lama.aktif && lama.bekuSejak) return lama.bekuSejak;
  return sekarang;
}
