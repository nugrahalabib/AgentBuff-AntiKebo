import type { AlasanPintu, PlatformKanal } from "@/lib/agentbuff/pintu";

/**
 * Aturan spam kanal (PRD G2, arsitektur §7). Jeda bawaan per platform; pengguna boleh
 * memperlambat, tidak boleh lebih cepat dari batas minimal yang juga ditegakkan AgentBuff.
 */

export const JEDA_BAWAAN_DTK: Record<PlatformKanal, number> = { telegram: 15, discord: 20, slack: 20, google_chat: 20, whatsapp: 45 };
export const JEDA_MINIMAL_DTK: Record<PlatformKanal, number> = { telegram: 5, discord: 15, slack: 15, google_chat: 15, whatsapp: 30 };
/** Platform belum diketahui (daftar kanal gagal diambil): pakai yang paling lambat supaya aman. */
const JEDA_TAK_DIKENAL_DTK = 45;

export function jedaKanalMs(platform: PlatformKanal | null, pilihanDtk: number | null): number {
  if (!platform) return Math.max(JEDA_TAK_DIKENAL_DTK, pilihanDtk ?? 0) * 1000;
  return Math.max(JEDA_MINIMAL_DTK[platform], pilihanDtk ?? JEDA_BAWAAN_DTK[platform]) * 1000;
}

/**
 * Galat yang menghentikan kanal itu untuk kejadian ini (dicatat dan ditampilkan). Selain ini
 * (agen mati, AgentBuff tidak terjangkau, kuota) dicoba lagi pada jeda berikutnya.
 */
export const ALASAN_BERHENTI: ReadonlySet<AlasanPintu> = new Set([
  "kanal_tidak_siap",
  "belum_diizinkan",
  "tidak_berhak",
  "tidak_dikenal",
  "klien",
  "teks_tidak_sah",
  "permintaan_tidak_sah",
]);

/** Jeda saat AgentBuff menjawab `terlalu_cepat`: hormati `ulangiSetelahMs`, paling cepat 1 dtk. */
export function jedaTerlaluCepatMs(ulangiSetelahMs: number | undefined): number {
  return Math.min(10 * 60_000, Math.max(1_000, ulangiSetelahMs ?? 5_000));
}
