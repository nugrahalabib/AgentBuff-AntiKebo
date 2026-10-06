import { uraiJarakPulsa } from "../pulsa";

/**
 * Protokol remote AC Panasonic (27 byte: bingkai 8 byte + bingkai 19 byte).
 * Tata letak diukur dari 4.492 rekaman asli di pustaka SmartIR (checksum cocok
 * 100%), bukan ditebak:
 *   byte 13: mode (nibble atas: auto 0, kering 2, dingin 3, panas 4, kipas 6) | bit0 nyala | bit3 bawaan model
 *   byte 14: suhu x2 (bit0 = setengah derajat), 16-30
 *   byte 16: kipas (nibble atas: auto 0xA, pelan 3, sedang 5, kencang 7) | ayunan (nibble bawah: auto 0xF, posisi 1-5)
 *   byte 26: checksum = jumlah byte 8..25 (mod 256)
 * Byte lain (17, 19, 20, 23, 25, bit3 byte 13) berbeda per model: disalin dari
 * templat (rekaman remote pengguna sendiri, atau varian dari pustaka).
 */

export type KeadaanPanasonic = { nyala: boolean; mode: string; suhu: number; kipas: string; ayun: boolean };

const BINGKAI_1 = [0x02, 0x20, 0xe0, 0x04, 0x00, 0x00, 0x00, 0x06];
const MODE: Record<string, number> = { auto: 0x0, wet: 0x2, cold: 0x3, hot: 0x4, wind: 0x6 };
const MODE_BALIK: Record<number, string> = { 0x0: "auto", 0x2: "wet", 0x3: "cold", 0x4: "hot", 0x6: "wind" };
const KIPAS: Record<string, number> = { auto: 0xa, low: 0x3, mid: 0x5, high: 0x7 };
const KIPAS_BALIK = (n: number) => (n === 0xa ? "auto" : n <= 3 ? "low" : n <= 5 ? "mid" : "high");

/** Varian model dari pustaka: [bit3 byte13, byte17, byte19, byte20, byte23, byte25]. */
export const VARIAN_PANASONIC: Array<{ id: string; contoh: string; bita: [number, number, number, number, number, number] }> = [
  { id: "1", contoh: "CS-CE/PC/MRE, CS-E (umum)", bita: [0x08, 0x00, 0x0e, 0xe0, 0x81, 0x00] },
  { id: "2", contoh: "CS-HE/U (JKE, RKR)", bita: [0x08, 0x0a, 0x0e, 0xe0, 0x81, 0x00] },
  { id: "3", contoh: "CS-Z (TK)", bita: [0x08, 0x0d, 0x0e, 0xe0, 0x89, 0x00] },
  { id: "4", contoh: "CS-E FKR", bita: [0x08, 0x06, 0x0e, 0xe0, 0x81, 0x06] },
  { id: "5", contoh: "CS-RE (GKE, PKR)", bita: [0x00, 0x00, 0x06, 0x60, 0x80, 0x06] },
  { id: "6", contoh: "CS-LJ (BA2)", bita: [0x00, 0x06, 0x0e, 0xe0, 0x01, 0x06] },
  { id: "7", contoh: "CS/CU-HU (YKYF)", bita: [0x00, 0x06, 0x0e, 0xe0, 0x8c, 0x00] },
];

export function templatVarian(id: string): number[] | null {
  const v = VARIAN_PANASONIC.find((x) => x.id === id);
  if (!v) return null;
  const b = [...BINGKAI_1, 0x02, 0x20, 0xe0, 0x04, 0x00, 0x30 | v.bita[0], 0x30, 0x80, 0xaf, v.bita[1], 0x00, v.bita[2], v.bita[3], 0x00, 0x00, v.bita[4], 0x00, v.bita[5], 0x00];
  b[26] = checksum(b);
  return b;
}

export function checksum(b: number[]): number {
  let s = 0;
  for (let i = 8; i < 26; i++) s += b[i];
  return s & 0xff;
}

/** Pulsa -> 27 byte Panasonic, atau null bila bukan protokol ini / checksum salah. */
export function dekodePanasonic(pulsa: number[]): number[] | null {
  const f = uraiJarakPulsa(pulsa);
  const i = f.findIndex((x) => x.length === 8 && x[0] === 0x02 && x[1] === 0x20 && x[2] === 0xe0 && x[3] === 0x04);
  if (i < 0 || !f[i + 1] || f[i + 1].length < 19) return null;
  const b = [...f[i], ...f[i + 1].slice(0, 19)];
  return checksum(b) === b[26] ? b : null;
}

export function keadaanPanasonic(b: number[]): KeadaanPanasonic {
  return {
    nyala: (b[13] & 1) === 1,
    mode: MODE_BALIK[b[13] >> 4] ?? "cold",
    suhu: b[14] / 2,
    kipas: KIPAS_BALIK(b[16] >> 4),
    ayun: (b[16] & 0x0f) === 0x0f,
  };
}

/** Bangun 27 byte dari templat + keadaan. */
export function bitaPanasonic(templat: number[], s: Partial<KeadaanPanasonic>): number[] {
  const b = [...templat];
  const lama = keadaanPanasonic(templat);
  const nyala = s.nyala ?? lama.nyala;
  const mode = MODE[s.mode ?? lama.mode] ?? MODE.cold;
  b[13] = (mode << 4) | (templat[13] & 0x0e) | (nyala ? 1 : 0);
  const suhu = Math.min(30, Math.max(16, Math.round((s.suhu ?? lama.suhu) * 2) / 2));
  b[14] = Math.round(suhu * 2);
  const kipas = KIPAS[s.kipas ?? lama.kipas] ?? KIPAS.auto;
  const posisiLama = templat[16] & 0x0f;
  const ayun = s.ayun ?? lama.ayun;
  const posisi = ayun ? 0x0f : posisiLama >= 1 && posisiLama <= 5 ? posisiLama : 0x03;
  b[16] = (kipas << 4) | posisi;
  b[26] = checksum(b);
  return b;
}

const HDR_TANDA = 3456;
const HDR_SELA = 1728;
const TANDA = 432;
const SATU = 1296;
const NOL = 432;
const JEDA = 10000;

/** 27 byte -> pulsa µs (dua bingkai, LSB dulu). */
export function pulsaPanasonic(b: number[]): number[] {
  const out: number[] = [];
  const bingkai = (bita: number[], akhir: boolean) => {
    out.push(HDR_TANDA, HDR_SELA);
    for (const x of bita) for (let k = 0; k < 8; k++) out.push(TANDA, (x >> k) & 1 ? SATU : NOL);
    out.push(TANDA);
    if (!akhir) out.push(JEDA);
  };
  bingkai(b.slice(0, 8), false);
  bingkai(b.slice(8, 27), true);
  return out;
}
