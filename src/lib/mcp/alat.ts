import { ALAT_AKUN } from "./alat/akun";
import { ALAT_ALARM } from "./alat/alarm";
import { ALAT_RIWAYAT } from "./alat/riwayat";
import { ALAT_RUMAH } from "./alat/rumah";
import { ALAT_TEMPLATE_SUARA } from "./alat/template-suara";
import type { DefinisiAlat } from "./dasar";

// Alat MCP AntiKebo (docs/11-ALAT-MCP.md). Nama alat bahasa Inggris, isian masukan bahasa Inggris
// snake_case (src/lib/mcp/peta.ts), teks jawaban bahasa pengguna (kamus `mcp`), masukan
// z.strictObject. Setiap aksi web punya alat di sini atau pengecualian di ./paritas.ts (dijaga `jaga`).
// TIDAK ADA alat yang mematikan, menunda, atau menjawab alarm berbunyi (CLAUDE.md §5.2).

export const SEMUA_ALAT: DefinisiAlat[] = [...ALAT_AKUN, ...ALAT_ALARM, ...ALAT_TEMPLATE_SUARA, ...ALAT_RUMAH, ...ALAT_RIWAYAT] as DefinisiAlat[];

/** Alat yang tetap jalan saat akses dibekukan (supaya agen bisa menjelaskan keadaannya). */
export const ALAT_BEBAS = new Set(["get_setup_status"]);

export function cariAlat(nama: string): DefinisiAlat | undefined {
  return SEMUA_ALAT.find((a) => a.nama === nama);
}
