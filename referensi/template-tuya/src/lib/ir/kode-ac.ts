import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { bitaPanasonic, dekodePanasonic, keadaanPanasonic, pulsaPanasonic, templatVarian, VARIAN_PANASONIC } from "./protokol/panasonic";

/**
 * Kode remote AC untuk AC yang dikendalikan lewat pemancar inframerah (IR).
 *
 * Kenapa ada: API end-user Tuya (kunci sk-) menyimpan perintah ke AC remote
 * (switch_power/mode/temperature) tapi TIDAK mengubahnya jadi sinyal IR;
 * layanan remote resmi Tuya (/v2.0/infrareds) menolak kunci itu ("token
 * invalid"). Jadi kita yang membuat sinyalnya: kode dari pustaka SmartIR (MIT,
 * aset/kode-ac, dibangun scripts/bangun-kode-ac.py) diubah ke format pemancar
 * Tuya lalu dikirim lewat properti `ir_send` pemancar.
 *
 * Format pemancar (sama dengan tinytuya / tuya-local untuk perangkat DP 201):
 *   {"control":"send_ir","head":"","key1":"1"+base64(uint16 LE durasi µs),"type":0,"delay":300}
 */

export type PustakaAc = {
  id: string;
  merek: string;
  model: string[];
  min: number;
  maks: number;
  langkah: number;
  mode: string[];
  kipas: string[];
  ayun: string[] | null;
  perintah: Record<string, unknown>;
};

type Indeks = { sumber: string; jumlah: number; merek: Array<{ merek: string; kode: Array<{ id: string; model: string[] }> }> };

const folder = () => process.env.TUYA_FOLDER_KODE_AC || path.join(process.cwd(), "aset", "kode-ac");

let indeks: Indeks | null = null;
function bacaIndeks(): Indeks {
  if (!indeks) indeks = JSON.parse(readFileSync(path.join(folder(), "index.json"), "utf8")) as Indeks;
  return indeks;
}

export function daftarMerek(): Array<{ merek: string; jumlah: number }> {
  return bacaIndeks().merek.map((m) => ({ merek: m.merek, jumlah: m.kode.length }));
}

export function kodeMerek(merek: string): Array<{ id: string; model: string[] }> {
  const m = merek.trim().toLowerCase();
  return bacaIndeks().merek.find((x) => x.merek.toLowerCase() === m)?.kode ?? [];
}

export function merekDari(id: string): string | null {
  for (const m of bacaIndeks().merek) if (m.kode.some((k) => k.id === id)) return m.merek;
  return null;
}

const cache = new Map<string, PustakaAc>();

/** Kode satu model AC. Id divalidasi terhadap indeks (tidak pernah jadi jalur bebas). */
export function muatPustaka(id: string): PustakaAc | null {
  if (!/^\d{1,6}$/.test(id) || !merekDari(id)) return null;
  const ada = cache.get(id);
  if (ada) return ada;
  const p = JSON.parse(gunzipSync(readFileSync(path.join(folder(), `${id}.json.gz`))).toString("utf8")) as PustakaAc;
  if (cache.size > 64) cache.delete(cache.keys().next().value!);
  cache.set(id, p);
  return p;
}

// ------------------------------------------------------------ konversi kode

/** Broadlink (base64, 0x26 = IR) -> durasi pulsa µs, diakhiri tanda (jeda penutup dibuang). */
export function broadlinkKePulsa(b64: string): number[] {
  const b = Buffer.from(b64, "base64");
  if (b.length < 6 || b[0] !== 0x26) throw new Error("Bukan kode IR Broadlink");
  const n = b[2] | (b[3] << 8);
  const data = b.subarray(4, 4 + n);
  const hasil: number[] = [];
  for (let i = 0; i < data.length; ) {
    let v = data[i++];
    if (v === 0) {
      if (i + 1 >= data.length) break;
      v = (data[i] << 8) | data[i + 1];
      i += 2;
    }
    hasil.push(Math.round((v * 8192) / 269));
  }
  while (hasil.length && hasil.length % 2 === 0) hasil.pop();
  if (!hasil.length) throw new Error("Kode IR kosong");
  return hasil;
}

/** Durasi µs -> base64 uint16 little-endian (format pemancar Tuya). */
export function pulsaKeTuya(pulsa: number[]): string {
  const buf = Buffer.alloc(pulsa.length * 2);
  pulsa.forEach((p, i) => buf.writeUInt16LE(Math.max(1, Math.min(65535, Math.round(p))), i * 2));
  return buf.toString("base64");
}

/** Nilai properti `ir_send` pemancar untuk satu kode Broadlink. */
export function jsonKirimIr(kodeBroadlink: string): string {
  return JSON.stringify({ control: "send_ir", head: "", key1: "1" + pulsaKeTuya(broadlinkKePulsa(kodeBroadlink)), type: 0, delay: 300 });
}

export const JSON_KELUAR_BELAJAR = JSON.stringify({ control: "study_exit" });

// ------------------------------------------------------------ pemetaan keadaan

/** Mode bermakna kita (lihat ARTI_MODE_IR di kemampuan.ts) -> nama mode di pustaka. */
const MODE_PUSTAKA: Record<string, string[]> = {
  cold: ["cool", "cold"],
  hot: ["heat"],
  auto: ["auto", "heat_cool"],
  wind: ["fan_only", "fan"],
  wet: ["dry"],
};

const KIPAS_NAMA: Record<string, string[]> = {
  auto: ["auto"],
  low: ["low", "quiet", "silent", "lowest", "min", "ultralow", "silence", "level1", "1"],
  mid: ["mid", "medium", "med", "middle", "normal", "2"],
  high: ["high", "highest", "turbo", "max", "maximum", "powerful", "top", "superhigh", "super high", "3"],
};

const AYUN_NYALA = ["on", "swing", "auto", "both", "vertical", "swing on"];
const AYUN_MATI = ["off", "stop", "fixed", "none", "swing off"];

/** Mode kita yang punya kode di pustaka ini. */
export function modeDidukung(p: PustakaAc): string[] {
  return Object.keys(MODE_PUSTAKA).filter((m) => MODE_PUSTAKA[m].some((x) => p.mode.includes(x) && p.perintah[x] != null));
}

const numerik = (k: string) => /^-?\d+(\.\d+)?$/.test(k);

function pilihKipas(kunci: string[], mau: string | null | undefined): string {
  const kecil = kunci.map((k) => k.toLowerCase());
  const level = (mau ?? "auto").toLowerCase();
  const cocok = (nama: string[]) => {
    const i = kecil.findIndex((k) => nama.includes(k));
    return i >= 0 ? kunci[i] : null;
  };
  const tepat = cocok(KIPAS_NAMA[level] ?? [level]);
  if (tepat) return tepat;
  const bukanAuto = kunci.filter((k) => !KIPAS_NAMA.auto.includes(k.toLowerCase()));
  if (!bukanAuto.length) return kunci[0];
  if (level === "low") return bukanAuto[0];
  if (level === "high") return bukanAuto[bukanAuto.length - 1];
  return bukanAuto[Math.floor((bukanAuto.length - 1) / 2)];
}

function pilihAyun(kunci: string[], ayun: boolean | null | undefined): string {
  const daftar = ayun ? AYUN_NYALA : AYUN_MATI;
  const i = kunci.findIndex((k) => daftar.includes(k.toLowerCase()));
  if (i >= 0) return kunci[i];
  const lain = kunci.filter((k) => !(ayun ? AYUN_MATI : AYUN_NYALA).includes(k.toLowerCase()));
  return (lain[0] ?? kunci[0])!;
}

function pilihSuhu(kunci: string[], suhu: number): string {
  let terbaik = kunci[0];
  let jarak = Infinity;
  for (const k of kunci) {
    const d = Math.abs(Number(k) - suhu);
    if (d < jarak || (d === jarak && Number(k) < Number(terbaik))) {
      terbaik = k;
      jarak = d;
    }
  }
  return terbaik;
}

export type KeadaanAc = { nyala: boolean; mode?: string | null; kipas?: string | number | null; suhu?: number | null; ayun?: boolean | null };

export type HasilKode =
  | { ok: true; kode: string[]; dipakai: { mode?: string; kipas?: string; suhu?: number; ayun?: string } }
  | { ok: false; pesan: string };

/**
 * Kode Broadlink yang harus dikirim (berurutan) agar AC mencapai keadaan `s`.
 * `sebelumnyaNyala` = keadaan terakhir yang kita ketahui; sebagian AC butuh kode
 * "on" lebih dulu saat dinyalakan dari mati.
 */
export function kodeUntuk(p: PustakaAc, s: KeadaanAc, sebelumnyaNyala: boolean): HasilKode {
  if (!s.nyala) return typeof p.perintah.off === "string" ? { ok: true, kode: [p.perintah.off], dipakai: {} } : { ok: false, pesan: "Kode untuk mematikan AC ini tidak ada di pustaka." };

  const modeKita = (s.mode ?? "cold").toLowerCase();
  const kandidat = MODE_PUSTAKA[modeKita] ?? [modeKita];
  const modeKunci = kandidat.find((m) => p.perintah[m] != null);
  if (!modeKunci) {
    return { ok: false, pesan: `Mode ini tidak ada di kode remote AC yang dipilih. Mode yang tersedia: ${modeDidukung(p).join(", ")}.` };
  }

  const dipakai: { mode?: string; kipas?: string; suhu?: number; ayun?: string } = { mode: modeKunci };
  let simpul: unknown = p.perintah[modeKunci];
  for (let langkah = 0; langkah < 5 && simpul && typeof simpul === "object"; langkah++) {
    const obj = simpul as Record<string, unknown>;
    const kunci = Object.keys(obj).filter((k) => obj[k] != null);
    if (!kunci.length) break;
    let pilih: string;
    const semuaKipas = kunci.every((k) => p.kipas.includes(k));
    if (kunci.every(numerik) && !semuaKipas) {
      const target = Math.min(p.maks, Math.max(p.min, s.suhu ?? 24));
      pilih = pilihSuhu(kunci, target);
      dipakai.suhu = Number(pilih);
    } else if (p.ayun && kunci.some((k) => p.ayun!.includes(k)) && !kunci.some((k) => p.kipas.includes(k))) {
      pilih = pilihAyun(kunci, s.ayun);
      dipakai.ayun = pilih;
    } else {
      pilih = pilihKipas(kunci, typeof s.kipas === "number" ? String(s.kipas) : s.kipas);
      dipakai.kipas = pilih;
    }
    simpul = obj[pilih];
  }
  if (typeof simpul !== "string") return { ok: false, pesan: "Kode untuk pengaturan ini tidak ada di pustaka. Coba suhu atau kecepatan kipas lain." };

  const kode = [simpul];
  if (!sebelumnyaNyala && typeof p.perintah.on === "string") kode.unshift(p.perintah.on);
  return { ok: true, kode, dipakai };
}

/** Keadaan uji saat mencocokkan kode: dingin, kipas otomatis, 24 derajat. */
export const KEADAAN_UJI_NYALA: KeadaanAc = { nyala: true, mode: "cold", kipas: "auto", suhu: 24, ayun: false };

// ------------------------------------------------------------ sumber kode


/**
 * Sumber sinyal untuk satu AC:
 *  - "pustaka": rekaman per keadaan dari SmartIR (id angka);
 *  - "panasonic": DIBANGUN dari protokol (semua suhu/mode/kipas/ayunan), templat
 *    model dari varian ("pana:1".."pana:7") atau rekaman remote pengguna ("pana:rekam").
 */
export type SumberKode = { jenis: "pustaka"; id: string; p: PustakaAc } | { jenis: "panasonic"; id: string; templat: number[] };

export const POLA_ID_KODE = /^(\d{1,6}|pana:[1-7]|pana:rekam)$/;

export function sumberDari(id: string, templatHex?: string | null): SumberKode | null {
  if (id === "pana:rekam") {
    const t = templatHex && /^[0-9a-f]{54}$/.test(templatHex) ? templatHex.match(/../g)!.map((x) => parseInt(x, 16)) : null;
    return t ? { jenis: "panasonic", id, templat: t } : null;
  }
  if (id.startsWith("pana:")) {
    const t = templatVarian(id.slice(5));
    return t ? { jenis: "panasonic", id, templat: t } : null;
  }
  const p = muatPustaka(id);
  if (!p) return null;
  // Rekaman Panasonic berprotokol 27 byte: bangun dari protokol dengan byte model berkas itu
  // (rekaman pustaka sering tanpa ayunan / sebagian keadaan). Pasangan lama ikut membaik.
  const templat = templatDariPustaka(p);
  return templat ? { jenis: "panasonic", id, templat } : { jenis: "pustaka", id, p };
}

/** Templat Panasonic dari rekaman AC MENYALA di berkas pustaka (null bila bukan protokol ini). */
function templatDariPustaka(p: PustakaAc): number[] | null {
  if (p.merek !== "Panasonic") return null;
  const cari = (n: unknown): string | null => {
    if (typeof n === "string") return n;
    if (n && typeof n === "object") for (const v of Object.values(n)) { const x = cari(v); if (x) return x; }
    return null;
  };
  const nyala = cari(p.perintah.cool) ?? cari(p.perintah.heat);
  if (!nyala) return null;
  try {
    return dekodePanasonic(broadlinkKePulsa(nyala));
  } catch {
    return null;
  }
}

export function modeSumber(s: SumberKode): string[] {
  return s.jenis === "panasonic" ? ["cold", "hot", "auto", "wind", "wet"] : modeDidukung(s.p);
}

export type HasilPulsa = { ok: true; pulsa: number[][]; dipakai: { suhu?: number } } | { ok: false; pesan: string };

/** Pulsa yang harus dipancarkan (berurutan) agar AC mencapai keadaan `k`. */
export function pulsaUntuk(s: SumberKode, k: KeadaanAc, sebelumnyaNyala: boolean): HasilPulsa {
  if (s.jenis === "pustaka") {
    const h = kodeUntuk(s.p, k, sebelumnyaNyala);
    return h.ok ? { ok: true, pulsa: h.kode.map(broadlinkKePulsa), dipakai: { suhu: h.dipakai.suhu } } : h;
  }
  const kipas = typeof k.kipas === "number" ? ["low", "mid", "high"][Math.min(2, Math.max(0, k.kipas - 1))] : (k.kipas ?? undefined);
  const b = bitaPanasonic(s.templat, { nyala: k.nyala, mode: k.mode ?? undefined, suhu: k.suhu ?? undefined, kipas: kipas ?? undefined, ayun: k.ayun ?? undefined });
  return { ok: true, pulsa: [pulsaPanasonic(b)], dipakai: { suhu: keadaanPanasonic(b).suhu } };
}

/** Nilai `ir_send` pemancar untuk pulsa µs. */
export function jsonKirimPulsa(pulsa: number[]): string {
  return JSON.stringify({ control: "send_ir", head: "", key1: "1" + pulsaKeTuya(pulsa), type: 0, delay: 300 });
}

/** Tes lengkap: suhu, kipas, dan ayunan sekaligus (untuk memastikan semua pengaturan sampai). */
export const KEADAAN_UJI_LENGKAP: KeadaanAc = { nyala: true, mode: "cold", kipas: "high", suhu: 27, ayun: true };

let pustakaPanasonic: Set<string> | null = null;
/** Id pustaka Panasonic yang sebenarnya protokol 27 byte (diganti varian buatan kita). */
export function pustakaBerprotokolPanasonic(): Set<string> {
  if (pustakaPanasonic) return pustakaPanasonic;
  pustakaPanasonic = new Set(
    kodeMerek("Panasonic")
      .filter((k) => {
        const off = muatPustaka(k.id)?.perintah.off;
        return typeof off === "string" && dekodePanasonic(broadlinkKePulsa(off)) !== null;
      })
      .map((k) => k.id),
  );
  return pustakaPanasonic;
}

export const VARIAN_PANASONIC_RAMAH = VARIAN_PANASONIC.map((v) => ({ id: `pana:${v.id}`, model: [v.contoh] }));
