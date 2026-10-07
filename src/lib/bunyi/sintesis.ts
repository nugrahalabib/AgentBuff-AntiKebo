/**
 * Bunyi alarm buatan sendiri (docs/10-SUARA.md §1, PRD F1): disintesis dari gelombang dasar, jadi
 * bebas lisensi. MURNI dan deterministik (tanpa acak): skrip `scripts/bangun-bunyi.ts` menulis hasil
 * ke `public/bunyi/*.wav`, tes memeriksa berkas itu sama persis dengan hasil sintesis ulang.
 *
 * Format WAV PCM 16 bit mono 22.050 Hz: diputar semua peramban dan rodio (PC), dan bisa diulang
 * TANPA celah (MP3/Opus menambah bantalan senyap di awal/akhir, K-54).
 */

import { NAIK_DTK } from "./berkas";

export { NAIK_DTK };
export const LAJU = 22_050;
export const TARGET_LUFS = -14;
export const PUNCAK_MAKS_DB = -1.5; // puncak sampel; sisa 0,5 dB untuk puncak antar-sampel (≤ −1 dBTP)

export const ID_BUNYI = ["klasik", "digital", "sirene", "lonceng", "kebakaran", "ayam", "nuklir", "naik"] as const;
export type IdBunyi = (typeof ID_BUNYI)[number];

const TAU = Math.PI * 2;

function kosong(detik: number): Float64Array {
  return new Float64Array(Math.round(detik * LAJU));
}

/** Selubung serang/lepas linear supaya tidak ada klik di tepi nada. */
function selubung(i: number, n: number, serang = 0.005, lepas = 0.01): number {
  const a = Math.round(serang * LAJU);
  const r = Math.round(lepas * LAJU);
  if (i < a) return i / a;
  if (i > n - r) return Math.max(0, (n - i) / r);
  return 1;
}

/** Tambahkan nada pada `mulai` (dtk) selama `durasi` (dtk) dari fungsi gelombang (fase, t). */
function nada(buf: Float64Array, mulai: number, durasi: number, gel: (t: number, i: number) => number, serang?: number, lepas?: number) {
  const a = Math.round(mulai * LAJU);
  const n = Math.round(durasi * LAJU);
  for (let i = 0; i < n && a + i < buf.length; i++) buf[a + i] += gel(i / LAJU, i) * selubung(i, n, serang, lepas);
}

/** Kotak lunak (penjumlahan harmonik ganjil terbatas, tanpa aliasing berat). */
const kotak =
  (f: number, harmonik = 9) =>
  (t: number) => {
    let s = 0;
    for (let k = 1; k <= harmonik; k += 2) if (f * k < LAJU / 2) s += Math.sin(TAU * f * k * t) / k;
    return (s * 4) / Math.PI;
  };
/** Gigi gergaji terbatas pita. */
const gergaji = (fase: number, f: number, harmonik = 12) => {
  let s = 0;
  for (let k = 1; k <= harmonik; k++) if (f * k < LAJU / 2) s += Math.sin(fase * k) / k;
  return (s * 2) / Math.PI;
};

/** Nada dengan frekuensi berubah (fase diintegrasikan, tanpa lompatan). */
function nadaSapu(buf: Float64Array, mulai: number, durasi: number, frek: (u: number) => number, bentuk: (fase: number, f: number) => number, serang?: number, lepas?: number) {
  const a = Math.round(mulai * LAJU);
  const n = Math.round(durasi * LAJU);
  let fase = 0;
  for (let i = 0; i < n && a + i < buf.length; i++) {
    const f = frek(i / n);
    fase += (TAU * f) / LAJU;
    buf[a + i] += bentuk(fase, f) * selubung(i, n, serang, lepas);
  }
}

/** Lonceng aditif: parsial logam dengan peluruhan; dipukul berulang (palu). */
function pukulanLonceng(buf: Float64Array, mulai: number, dasar: number, rasio: number[], luruh: number, durasi: number) {
  nada(buf, mulai, durasi, (t) => rasio.reduce((s, r, k) => s + (Math.sin(TAU * dasar * r * t) * Math.exp(-t * luruh * (1 + k * 0.6))) / (k + 1), 0), 0.001, 0.02);
}

const PEMBUAT: Record<IdBunyi, () => Float64Array> = {
  // Jam weker klasik: palu memukul lonceng ~16 kali per detik selama 2 dtk, lalu jeda.
  klasik: () => {
    const b = kosong(2.6);
    for (let i = 0; i < 32; i++) pukulanLonceng(b, i / 16, 1250, [1, 2.76, 5.4], 9, 0.12);
    return b;
  },
  // Jam digital: empat bip 4 kHz, dua kali.
  digital: () => {
    const b = kosong(2.4);
    for (const g of [0, 1.2]) for (let i = 0; i < 4; i++) nada(b, g + i * 0.15, 0.08, kotak(2000, 3), 0.002, 0.004);
    return b;
  },
  // Sirene: segitiga naik turun 650 sampai 1500 Hz.
  sirene: () => {
    const b = kosong(3.2);
    nadaSapu(
      b,
      0,
      3.2,
      (u) => 650 + 850 * (u < 0.5 ? u * 2 : 2 - u * 2),
      (fase) => (2 / Math.PI) * Math.asin(Math.sin(fase)),
      0.02,
      0.02,
    );
    return b;
  },
  // Bel sekolah listrik: palu 25 kali per detik selama 3 dtk.
  lonceng: () => {
    const b = kosong(3.6);
    for (let i = 0; i < 75; i++) pukulanLonceng(b, i / 25, 980, [1, 2.4, 3.9, 5.6], 14, 0.09);
    return b;
  },
  // Alarm kebakaran pola temporal-3, nada kotak 520 Hz (nada rendah paling membangunkan orang tidur).
  kebakaran: () => {
    const b = kosong(4);
    for (const m of [0, 1, 2]) nada(b, m, 0.5, kotak(520, 15));
    return b;
  },
  // Ayam berkokok (sintesis, bukan rekaman): empat suku kata dengan kontur nada.
  ayam: () => {
    const b = kosong(2.8);
    const suku: Array<[number, number, number, number]> = [
      [0.0, 0.14, 640, 700],
      [0.2, 0.14, 700, 760],
      [0.4, 0.26, 760, 900],
      [0.72, 0.75, 950, 620],
    ];
    for (const [m, d, f0, f1] of suku)
      nadaSapu(
        b,
        m,
        d,
        (u) => f0 + (f1 - f0) * u + 18 * Math.sin(TAU * 7 * u * d),
        (fase, f) => gergaji(fase, f, 8) * 0.8,
        0.015,
        0.05,
      );
    return b;
  },
  // Nuklir: klakson gergaji naik 300 sampai 900 Hz dengan getar, dua kali.
  nuklir: () => {
    const b = kosong(3.4);
    for (const m of [0, 1.7])
      nadaSapu(
        b,
        m,
        1.55,
        (u) => 300 + 600 * Math.sqrt(u),
        (fase, f) => gergaji(fase, f, 14) * (0.75 + 0.25 * Math.sin(fase / 40)),
        0.01,
        0.06,
      );
    return b;
  },
  // Naik perlahan: arpeggio lembut; volumenya dinaikkan pemutar selama 60 dtk pertama.
  naik: () => {
    const b = kosong(2.4);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      nada(b, i * 0.3, 1.1, (t) => Math.sin(TAU * f * t) * Math.exp(-t * 3.2) + 0.25 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 6), 0.003, 0.05),
    );
    return b;
  },
};

// ------------------------------------------------------------------ kekerasan (ITU-R BS.1770)

type Biquad = [number, number, number, number, number];

function saring(x: Float64Array, [b0, b1, b2, a1, a2]: Biquad): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** Koefisien K-weighting untuk laju sampel apa pun (bentuk RBJ, parameter pyloudnorm). */
function kWeighting(fs: number): [Biquad, Biquad] {
  const rak = (f: number, q: number, g: number): Biquad => {
    const A = 10 ** (g / 40);
    const w = (TAU * f) / fs;
    const c = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    const sa = 2 * Math.sqrt(A) * al;
    const a0 = A + 1 - (A - 1) * c + sa;
    return [
      (A * (A + 1 + (A - 1) * c + sa)) / a0,
      (-2 * A * (A - 1 + (A + 1) * c)) / a0,
      (A * (A + 1 + (A - 1) * c - sa)) / a0,
      (2 * (A - 1 - (A + 1) * c)) / a0,
      (A + 1 - (A - 1) * c - sa) / a0,
    ];
  };
  const lolos = (f: number, q: number): Biquad => {
    const w = (TAU * f) / fs;
    const c = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    const a0 = 1 + al;
    return [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, (-2 * c) / a0, (1 - al) / a0];
  };
  return [rak(1681.974450955533, 0.7071752369554196, 3.999843853973347), lolos(38.13547087602444, 0.5003270373238773)];
}

/** Kekerasan terintegrasi (LUFS) dengan gerbang mutlak −70 dan relatif −10. Bunyi diulang sampai ≥ 3 dtk. */
export function kekerasan(x: Float64Array, fs = LAJU): number {
  let s = x;
  while (s.length < fs * 3) {
    const g = new Float64Array(s.length + x.length);
    g.set(s);
    g.set(x, s.length);
    s = g;
  }
  const [k1, k2] = kWeighting(fs);
  const y = saring(saring(s, k1), k2);
  const blok = Math.round(0.4 * fs);
  const langkah = Math.round(0.1 * fs);
  const ms: number[] = [];
  for (let a = 0; a + blok <= y.length; a += langkah) {
    let j = 0;
    for (let i = a; i < a + blok; i++) j += y[i] * y[i];
    ms.push(j / blok);
  }
  const lufs = (z: number) => -0.691 + 10 * Math.log10(z);
  const lolosMutlak = ms.filter((z) => lufs(z) > -70);
  if (!lolosMutlak.length) return -Infinity;
  const relatif = lufs(lolosMutlak.reduce((p, q) => p + q, 0) / lolosMutlak.length) - 10;
  const akhir = lolosMutlak.filter((z) => lufs(z) > relatif);
  return lufs(akhir.reduce((p, q) => p + q, 0) / akhir.length);
}

export function puncakDb(x: Float64Array): number {
  let p = 0;
  for (const v of x) p = Math.max(p, Math.abs(v));
  return 20 * Math.log10(p);
}

/** Normalkan ke −14 LUFS; bila puncak melewati batas, dibatasi puncak (sedikit lebih pelan). */
export function normalkan(x: Float64Array): { sampel: Float64Array; lufs: number; puncak: number } {
  const l0 = kekerasan(x);
  let gain = 10 ** ((TARGET_LUFS - l0) / 20);
  const p0 = puncakDb(x);
  if (p0 + 20 * Math.log10(gain) > PUNCAK_MAKS_DB) gain = 10 ** ((PUNCAK_MAKS_DB - p0) / 20);
  const y = x.map((v) => v * gain);
  return { sampel: y, lufs: kekerasan(y), puncak: puncakDb(y) };
}

// ------------------------------------------------------------------ WAV

export function keWav(sampel: Float64Array, fs = LAJU): Uint8Array {
  const n = sampel.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const tulis = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  tulis(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  tulis(8, "WAVE");
  tulis(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, fs, true);
  v.setUint32(28, fs * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tulis(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(sampel[i] * 32767))), true);
  return new Uint8Array(buf);
}

export type HasilBunyi = { id: IdBunyi; wav: Uint8Array; durasiMs: number; lufs: number; puncakDb: number; naikDtk: number | null };

export function bangunBunyi(id: IdBunyi): HasilBunyi {
  const mentah = PEMBUAT[id]();
  const { sampel, lufs, puncak } = normalkan(mentah);
  return {
    id,
    wav: keWav(sampel),
    durasiMs: Math.round((sampel.length / LAJU) * 1000),
    lufs: Math.round(lufs * 10) / 10,
    puncakDb: Math.round(puncak * 10) / 10,
    naikDtk: NAIK_DTK[id] ?? null,
  };
}

export function sampelMentah(id: IdBunyi): Float64Array {
  return PEMBUAT[id]();
}
