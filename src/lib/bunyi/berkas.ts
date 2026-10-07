import type { IdBunyi } from "@/lib/alarm/isi";

/**
 * Berkas bunyi alarm di `public/bunyi/` (dibuat `scripts/bangun-bunyi.ts`). Modul kecil tanpa
 * sintesis supaya bisa dipakai peramban. `naikDtk` = bunyi "Naik perlahan" dikeraskan pemutar dari
 * 10% ke 100% selama sekian detik.
 */
export const NAIK_DTK: Partial<Record<IdBunyi, number>> = { naik: 60 };

export function berkasBunyi(id: IdBunyi): { url: string; naikDtk: number | null } {
  return { url: `/bunyi/${id}.wav`, naikDtk: NAIK_DTK[id] ?? null };
}
