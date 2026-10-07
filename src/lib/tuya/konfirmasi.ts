// Disalin dari template AgentBuff-Tuya (`937aa8a`) tanpa perubahan perilaku.
import { bacaWarna, type Kemampuan } from "./kemampuan";
import type { ModelPerangkat } from "./tipe";

/**
 * Apakah perangkat SUDAH melaporkan keadaan yang diminta?
 *
 * `shadow/properties/issue` menjawab "sukses" begitu server Tuya MENERIMA
 * perintah, bukan saat perangkat menjalankannya. Tanpa pemeriksaan ini agen
 * bilang "sudah" padahal lampu tidak berubah. MURNI: diuji di tests/unit.
 */
export type StatusLaporan = "cocok" | "beda" | "tak_terukur";

const KODE_HITUNG_MUNDUR = /^countdown(_\d+|_left)?$/;

function properti(model: ModelPerangkat | null | undefined) {
  const peta = new Map<string, { accessMode?: string; type?: string }>();
  for (const sv of model?.services ?? []) for (const p of sv.properties ?? []) peta.set(p.code, { accessMode: p.accessMode, type: p.typeSpec?.type });
  return peta;
}

const selisihSudut = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

function nilaiCocok(kode: string, harap: unknown, nyata: unknown, k: Kemampuan): boolean {
  if (KODE_HITUNG_MUNDUR.test(kode)) return (Number(harap) === 0) === (Number(nyata) === 0);
  if (k.warna && kode === k.warna.kode) {
    const a = bacaWarna(harap, k.warna.skalaSV);
    const b = bacaWarna(nyata, k.warna.skalaSV);
    if (!a || !b) return JSON.stringify(harap) === JSON.stringify(nyata);
    return selisihSudut(a.h, b.h) <= 4 && Math.abs(a.s - b.s) <= 4 && Math.abs(a.v - b.v) <= 4;
  }
  if (typeof harap === "number" && typeof nyata === "number") return Math.abs(harap - nyata) <= Math.max(1, Math.abs(harap) * 0.02);
  if (typeof harap === "string" && typeof nyata === "string") return harap.toLowerCase() === nyata.toLowerCase();
  return harap === nyata;
}

/** `harap` = properti yang baru dikirim; `nyata` = properti yang dilaporkan Tuya (detail). */
export function bandingkanLaporan(
  k: Kemampuan,
  model: ModelPerangkat | null | undefined,
  harap: Record<string, unknown>,
  nyata: Record<string, unknown> | null | undefined,
): { status: StatusLaporan; beda: string[] } {
  if (!nyata) return { status: "tak_terukur", beda: [] };
  const spek = properti(model);
  const beda: string[] = [];
  let terukur = 0;
  for (const [kode, nilai] of Object.entries(harap)) {
    // Properti tulis-saja (data adegan, musik) tidak pernah dilaporkan balik.
    if (spek.get(kode)?.accessMode === "wr" || !(kode in nyata)) continue;
    terukur++;
    if (!nilaiCocok(kode, nilai, nyata[kode], k)) beda.push(kode);
  }
  if (!terukur) return { status: "tak_terukur", beda };
  return { status: beda.length ? "beda" : "cocok", beda };
}
