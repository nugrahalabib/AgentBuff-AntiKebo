// Disalin dari template AgentBuff-Tuya (`937aa8a`) tanpa perubahan perilaku.
/**
 * Penerjemah model perangkat Tuya (Thing Model) <-> bahasa manusia.
 *
 * Tuya memberi kode properti mentah (switch_led, bright_value 10-1000,
 * colour_data_v2 {"h":..,"s":..,"v":..}, temp_set dengan `scale`, ...). Agen
 * dan layar tidak boleh memikirkan itu. Modul ini:
 *  1. `rakitKemampuan(model)`  -> peta kemampuan yang dikenali (+ sisa properti generik)
 *  2. `bacaKeadaan(k, prop)`   -> keadaan ramah (nyala, terang %, warna hex, suhu derajat, ...)
 *  3. `terjemahkan(k, perintah)` -> properti mentah yang siap dikirim, atau galat yang menjelaskan
 *
 * MURNI: tanpa jaringan/DB, diuji di tests/unit/kemampuan.test.ts.
 */
import type { ModelPerangkat, PropertiModel, TypeSpec } from "./tipe";

type SpekAngka = { kode: string; min: number; max: number; step: number; scale: number; unit: string };
/** `arti`: nilai mentah -> makna baku (mis. AC lewat remote IR "0" -> "cold"). Di luar modul ini hanya makna yang dipakai. */
type SpekEnum = { kode: string; pilihan: string[]; arti?: Record<string, string> };

export interface Kemampuan {
  /** Saklar utama. Multi-saluran (switch_1..n) -> `saluran`. */
  daya?: { kode: string };
  saluran?: Array<{ kode: string; nomor: number }>;
  terang?: SpekAngka;
  suhuPutih?: SpekAngka;
  warna?: { kode: string; skalaSV: 255 | 1000 };
  /** Mode lampu: white / colour / scene / music (+ scene_1.. di lampu lama). */
  modeKerja?: SpekEnum;
  suhuTarget?: SpekAngka;
  suhuRuang?: SpekAngka; // hanya baca
  kelembapan?: SpekAngka; // hanya baca
  modeAc?: SpekEnum;
  kipas?: SpekEnum | SpekAngka;
  tirai?: SpekEnum; // open/stop/close
  posisi?: SpekAngka; // persen tirai
  hitungMundur?: SpekAngka; // detik, timer bawaan perangkat
  listrik?: { watt?: SpekAngka; volt?: SpekAngka; ampere?: SpekAngka; kwh?: SpekAngka };
  baterai?: SpekAngka;
  /** Dikendalikan lewat pemancar inframerah: status tidak dibaca balik dari alatnya. */
  inframerah?: boolean;
  /** Pemancar inframerah itu sendiri (hub remote), bukan remote yang dibuat di dalamnya. */
  pemancarIr?: boolean;
  /** Properti lain yang bisa ditulis (bool/value/enum) - untuk kendali generik. */
  lainnya: PropertiModel[];
  /** Properti hanya-baca yang bermakna (sensor, status). */
  bacaan: PropertiModel[];
}

const KODE_DAYA = ["switch_led", "switch", "led_switch", "switch_1", "power", "switch_power", "switch_on", "Power", "power_go"];
const KODE_TERANG = ["bright_value_v2", "bright_value", "bright_value_1", "bright"];
const KODE_SUHU_PUTIH = ["temp_value_v2", "temp_value", "temp_value_1"];
const KODE_WARNA = ["colour_data_v2", "colour_data", "colour_data_1"];
const KODE_SUHU_TARGET = ["temp_set", "set_temp", "temp_set_f", "T", "temperature"];
const KODE_SUHU_RUANG = ["temp_current", "va_temperature", "temp_indoor", "temperature"];
const KODE_KELEMBAPAN = ["humidity_value", "va_humidity", "humidity_current", "humidity_indoor"];
const KODE_MODE_AC = ["mode", "work_mode_ac", "M"];
const KODE_KIPAS = ["fan_speed_enum", "windspeed", "fan_speed", "fan", "wind", "speed", "F"];
const KODE_HITUNG_MUNDUR = ["countdown", "countdown_1", "countdown_left"];

/**
 * AC lewat remote IR (kategori qt/infrared_ac): mode & kipas berupa angka.
 * Arti mengikuti perintah AC inframerah baku Tuya: mode 0 dingin, 1 panas,
 * 2 otomatis, 3 kipas, 4 kering; kipas 0 otomatis, 1 pelan, 2 sedang, 3 kencang.
 */
const ARTI_MODE_IR: Record<string, string> = { "0": "cold", "1": "hot", "2": "auto", "3": "wind", "4": "wet" };
const ARTI_KIPAS_IR: Record<string, string> = { "0": "auto", "1": "low", "2": "mid", "3": "high" };

/** Properti protokol (kode remote, data adegan/musik, kalibrasi): tidak bisa diatur manusia, tidak ditampilkan. */
const KODE_INTERNAL =
  /^(scene_data(_v2)?|flash_scene_\d+|music_data|control_data|paint_colour_data|dreamlight\w*|power_memory|test_bit|\w+_coe|study_code|ir_code|ir_send|ir_study_code|key_code\d*|key_study\d*|delay_time|add_ele)$/;
/** Khusus perangkat inframerah: `control` (send_ir/study) dan `type` adalah urusan remote. */
const KODE_INTERNAL_IR = /^(control|type)$/;

function semuaProperti(model: ModelPerangkat | null | undefined): PropertiModel[] {
  const hasil: PropertiModel[] = [];
  for (const s of model?.services ?? []) for (const p of s.properties ?? []) if (p?.code) hasil.push(p);
  return hasil;
}

const bisaTulis = (p: PropertiModel) => p.accessMode === "rw" || p.accessMode === "wr";

/**
 * Sebagian model Tuya tidak menyebut min/max (lampu strip, softbox). Rentangnya
 * ditebak dari keluarga kode + nilai sekarang: >255 berarti skala 0-1000.
 */
function rentangTebakan(kode: string, contoh: unknown): { min: number; max: number } | null {
  const besar = kode.endsWith("_v2") || (typeof contoh === "number" && contoh > 255);
  if (kode.startsWith("bright_value")) return besar ? { min: 10, max: 1000 } : { min: 25, max: 255 };
  if (kode.startsWith("temp_value")) return besar ? { min: 0, max: 1000 } : { min: 0, max: 255 };
  if (kode.startsWith("countdown")) return { min: 0, max: 86400 };
  return null;
}

function angkaDari(prop: Record<string, unknown> | null | undefined) {
  return (p: PropertiModel): SpekAngka | null => {
    const t = p.typeSpec as TypeSpec & Record<string, unknown>;
    if (t.type !== "value") return null;
    const v = t as { min?: number; max?: number; step?: number; scale?: number; unit?: string };
    let min = v.min,
      max = v.max;
    if (typeof min !== "number" || typeof max !== "number" || max <= min) {
      const r = rentangTebakan(p.code, prop?.[p.code]);
      if (!r) return null;
      ({ min, max } = r);
    }
    return { kode: p.code, min, max, step: v.step && v.step > 0 ? v.step : 1, scale: v.scale ?? 0, unit: v.unit ?? "" };
  };
}

function enumDari(p: PropertiModel): SpekEnum | null {
  const t = p.typeSpec as { type: string; range?: unknown };
  if (t.type !== "enum" || !Array.isArray(t.range) || t.range.length === 0) return null;
  return { kode: p.code, pilihan: t.range.map(String) };
}

function cari(daftar: PropertiModel[], kode: string[], syarat: (p: PropertiModel) => boolean = () => true): PropertiModel | undefined {
  for (const k of kode) {
    const p = daftar.find((x) => x.code === k && syarat(x));
    if (p) return p;
  }
  return undefined;
}

const semuaAngka = (s: SpekEnum) => s.pilihan.every((x) => /^\d+$/.test(x));

/** Pilihan enum dalam bentuk bermakna (yang dilihat layar & agen). */
export function pilihanBermakna(s: SpekEnum): string[] {
  return s.arti ? s.pilihan.map((x) => s.arti![x] ?? x) : s.pilihan;
}

function maknaDari(s: SpekEnum | undefined, mentahNilai: unknown): string | null {
  if (typeof mentahNilai !== "string" && typeof mentahNilai !== "number") return null;
  const v = String(mentahNilai);
  return s?.arti?.[v] ?? v;
}

/** `prop` (opsional) = keadaan sekarang, dipakai menebak rentang yang tidak ditulis di model. */
const KODE_BATERAI = ["battery_percentage", "va_battery", "electricity_left", "residual_electricity", "battery_value"];

export function rakitKemampuan(model: ModelPerangkat | null | undefined, prop?: Record<string, unknown> | null): Kemampuan {
  const semua = semuaProperti(model);
  const angka = angkaDari(prop);
  const dipakai = new Set<string>();
  const pakai = <T>(p: PropertiModel | undefined, ubah: (p: PropertiModel) => T | null): T | undefined => {
    if (!p) return undefined;
    const h = ubah(p);
    if (h) dipakai.add(p.code);
    return h ?? undefined;
  };
  const k: Kemampuan = { lainnya: [], bacaan: [] };
  const kontrolIr = semua.find(
    (p) => p.code === "control" && (p.typeSpec as { range?: unknown }).range instanceof Array && (p.typeSpec as { range: string[] }).range.includes("send_ir"),
  );
  if (kontrolIr) k.inframerah = true;
  if (semua.some((p) => p.code === "ir_send") && !kontrolIr) k.pemancarIr = true;

  // Multi-saluran: switch_1..switch_8 bool yang bisa ditulis.
  const saluran = semua
    .filter((p) => /^switch_[1-8]$/.test(p.code) && p.typeSpec.type === "bool" && bisaTulis(p))
    .map((p) => ({ kode: p.code, nomor: Number(p.code.slice(7)) }))
    .sort((a, b) => a.nomor - b.nomor);
  if (saluran.length > 1) {
    k.saluran = saluran;
    saluran.forEach((s) => dipakai.add(s.kode));
  } else {
    k.daya = pakai(
      cari(semua, KODE_DAYA, (p) => p.typeSpec.type === "bool" && bisaTulis(p)),
      (p) => ({ kode: p.code }),
    );
  }

  k.terang = pakai(cari(semua, KODE_TERANG, bisaTulis), angka);
  k.suhuPutih = pakai(cari(semua, KODE_SUHU_PUTIH, bisaTulis), angka);
  k.warna = pakai(
    cari(semua, KODE_WARNA, (p) => bisaTulis(p) && (p.typeSpec.type === "string" || p.typeSpec.type === "struct" || p.typeSpec.type === "raw")),
    (p) => ({ kode: p.code, skalaSV: p.code.endsWith("_v2") ? 1000 : 255 }) as const,
  );
  k.modeKerja = pakai(
    semua.find((p) => p.code === "work_mode" && bisaTulis(p) && p.typeSpec.type === "enum"),
    enumDari,
  );
  k.suhuTarget = pakai(cari(semua, KODE_SUHU_TARGET, bisaTulis), angka);
  k.suhuRuang = pakai(
    cari(semua, KODE_SUHU_RUANG, (p) => !dipakai.has(p.code)),
    angka,
  );
  k.kelembapan = pakai(cari(semua, KODE_KELEMBAPAN), angka);
  k.modeAc = pakai(
    cari(semua, KODE_MODE_AC, (p) => bisaTulis(p) && p.typeSpec.type === "enum"),
    enumDari,
  );
  if (k.modeAc && semuaAngka(k.modeAc) && (k.inframerah || k.suhuTarget)) k.modeAc.arti = ARTI_MODE_IR;
  const kipas = cari(semua, KODE_KIPAS, bisaTulis);
  k.kipas = pakai(kipas, (p) => enumDari(p) ?? angka(p));
  if (k.kipas && "pilihan" in k.kipas && semuaAngka(k.kipas) && (k.inframerah || k.suhuTarget)) k.kipas.arti = ARTI_KIPAS_IR;
  // Tirai hanya bila pilihannya memang buka/tutup (kode `control` juga dipakai remote IR: send_ir/study).
  k.tirai = pakai(
    semua.find((p) => (p.code === "control" || p.code === "mach_operate") && bisaTulis(p)),
    (p) => {
      const e = enumDari(p);
      const lower = e?.pilihan.map((x) => x.toLowerCase()) ?? [];
      return e && lower.includes("open") && lower.includes("close") ? e : null;
    },
  );
  k.posisi = pakai(
    semua.find((p) => (p.code === "percent_control" || p.code === "position") && bisaTulis(p)),
    angka,
  );
  k.hitungMundur = pakai(cari(semua, KODE_HITUNG_MUNDUR, bisaTulis), angka);
  // Baterai: sensor (battery_percentage/va_battery), robot vakum (electricity_left), kunci pintu (residual_electricity).
  k.baterai = pakai(
    semua.find((p) => KODE_BATERAI.includes(p.code) && p.typeSpec.type === "value"),
    angka,
  );

  const listrik: NonNullable<Kemampuan["listrik"]> = {};
  listrik.watt = pakai(
    semua.find((p) => p.code === "cur_power"),
    angka,
  );
  listrik.volt = pakai(
    semua.find((p) => p.code === "cur_voltage"),
    angka,
  );
  listrik.ampere = pakai(
    semua.find((p) => p.code === "cur_current"),
    angka,
  );
  listrik.kwh = pakai(
    semua.find((p) => p.code === "add_ele"),
    angka,
  );
  if (listrik.watt || listrik.kwh || listrik.volt || listrik.ampere) k.listrik = listrik;

  const bisaDiatur = new Set(["bool", "value", "enum"]);
  // Bacaan juga memuat bitmap (tanda gangguan/alarm) dan teks pendek (status) yang hanya dilaporkan.
  const bisaDibaca = new Set(["bool", "value", "enum", "bitmap", "string"]);
  for (const p of semua) {
    if (dipakai.has(p.code)) continue;
    if (KODE_INTERNAL.test(p.code) || ((k.inframerah || k.pemancarIr) && KODE_INTERNAL_IR.test(p.code))) continue;
    if (bisaTulis(p) && bisaDiatur.has(p.typeSpec.type)) k.lainnya.push(p);
    else if (!bisaTulis(p) && bisaDibaca.has(p.typeSpec.type)) k.bacaan.push(p);
  }
  return k;
}

/** Nilai bacaan siap tampil: angka dibagi skala resmi + satuan, bitmap jadi daftar tanda yang aktif. */
export function nilaiBacaan(p: PropertiModel, mentah: unknown): { nilai: string | number | boolean | string[] | null; satuan: string } {
  const t = p.typeSpec as { type: string; scale?: number; unit?: string; label?: string[] };
  if (mentah === undefined || mentah === null) return { nilai: null, satuan: "" };
  if (t.type === "value") {
    const n = typeof mentah === "number" ? mentah : Number(mentah);
    return { nilai: Number.isFinite(n) ? n / 10 ** (t.scale ?? 0) : null, satuan: t.unit ?? "" };
  }
  if (t.type === "bitmap") {
    const n = Number(mentah);
    return { nilai: Number.isFinite(n) ? (t.label ?? []).filter((_, i) => (n >> i) & 1) : null, satuan: "" };
  }
  if (typeof mentah === "string" || typeof mentah === "number" || typeof mentah === "boolean") return { nilai: mentah, satuan: "" };
  return { nilai: null, satuan: "" };
}

// ------------------------------------------------------------ konversi angka

/** Nilai mentah -> nilai nyata (bagi 10^scale). */
export function nyata(spek: SpekAngka, mentah: unknown): number | null {
  const n = typeof mentah === "number" ? mentah : typeof mentah === "string" && mentah.trim() !== "" ? Number(mentah) : NaN;
  if (!Number.isFinite(n)) return null;
  return n / 10 ** spek.scale;
}

/** Nilai nyata -> mentah: dikali 10^scale, dibulatkan ke `step`, dijepit ke [min,max]. */
export function mentah(spek: SpekAngka, nilaiNyata: number): number {
  const m = Math.round(nilaiNyata * 10 ** spek.scale);
  const langkah = Math.round((m - spek.min) / spek.step) * spek.step + spek.min;
  return Math.min(spek.max, Math.max(spek.min, langkah));
}

/** Persen 0-100 <-> rentang mentah (dipakai untuk terang & suhu putih). */
export function persenKeMentah(spek: SpekAngka, persen: number): number {
  const p = Math.min(100, Math.max(0, persen));
  // 1% tidak boleh jatuh ke bawah min (lampu Tuya: min 10 -> tetap menyala redup).
  return mentah({ ...spek, scale: 0 }, spek.min + ((spek.max - spek.min) * p) / 100);
}

export function mentahKePersen(spek: SpekAngka, nilai: unknown): number | null {
  const n = typeof nilai === "number" ? nilai : Number(nilai);
  if (!Number.isFinite(n)) return null;
  return Math.round(((n - spek.min) / (spek.max - spek.min)) * 100);
}

// ------------------------------------------------------------------ warna

export type Hsv = { h: number; s: number; v: number }; // h 0-360, s/v 0-100

const NAMA_WARNA: Record<string, Hsv | "putih" | "hangat" | "sejuk"> = {
  merah: { h: 0, s: 100, v: 100 },
  red: { h: 0, s: 100, v: 100 },
  oranye: { h: 30, s: 100, v: 100 },
  jingga: { h: 30, s: 100, v: 100 },
  orange: { h: 30, s: 100, v: 100 },
  kuning: { h: 55, s: 100, v: 100 },
  yellow: { h: 55, s: 100, v: 100 },
  hijau: { h: 120, s: 100, v: 100 },
  green: { h: 120, s: 100, v: 100 },
  tosca: { h: 170, s: 90, v: 100 },
  toska: { h: 170, s: 90, v: 100 },
  teal: { h: 170, s: 90, v: 100 },
  biru_muda: { h: 195, s: 80, v: 100 },
  cyan: { h: 185, s: 100, v: 100 },
  sian: { h: 185, s: 100, v: 100 },
  biru: { h: 230, s: 100, v: 100 },
  blue: { h: 230, s: 100, v: 100 },
  nila: { h: 255, s: 100, v: 100 },
  indigo: { h: 255, s: 100, v: 100 },
  ungu: { h: 275, s: 100, v: 100 },
  purple: { h: 275, s: 100, v: 100 },
  violet: { h: 275, s: 100, v: 100 },
  pink: { h: 320, s: 80, v: 100 },
  merah_muda: { h: 330, s: 70, v: 100 },
  magenta: { h: 300, s: 100, v: 100 },
  putih: "putih",
  white: "putih",
  hangat: "hangat",
  warm: "hangat",
  kuning_hangat: "hangat",
  sejuk: "sejuk",
  cool: "sejuk",
  dingin: "sejuk",
};

export function hexKeHsv(hex: string): Hsv | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const maks = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = maks - min;
  let h = 0;
  if (d) {
    if (maks === r) h = 60 * (((g - b) / d) % 6);
    else if (maks === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h: Math.round(h), s: Math.round(maks ? (d / maks) * 100 : 0), v: Math.round(maks * 100) };
}

export function hsvKeHex({ h, s, v }: Hsv): string {
  const S = s / 100,
    V = v / 100;
  const c = V * S,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = V - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const ke = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${ke(r)}${ke(g)}${ke(b)}`;
}

/** Nama ("biru", "warm", "merah muda") atau hex -> warna. */
export function tafsirWarna(masukan: string): Hsv | "putih" | "hangat" | "sejuk" | null {
  const kunci = masukan.trim().toLowerCase().replace(/\s+/g, "_");
  if (NAMA_WARNA[kunci]) return NAMA_WARNA[kunci];
  return hexKeHsv(masukan);
}

/**
 * Format colour_data yang ditemui di lapangan (Tuya mengirim apa adanya dari DP perangkat):
 *  - JSON  {"h":0-360,"s":..,"v":..}           (colour_data_v2 baku)
 *  - hex12 "hhhhssssvvvv" s/v 0-1000             (lampu strip, softbox)
 *  - hex14 "rrggbbhhhhssvv" s/v 0-255            (lampu lama)
 * Saat menulis, format MENGIKUTI nilai yang sedang dipegang perangkat.
 */
type FormatWarna = "json" | "hex12" | "hex14";

function formatWarna(nilai: unknown): FormatWarna | null {
  if (typeof nilai === "string") {
    if (/^[0-9a-f]{12}$/i.test(nilai)) return "hex12";
    if (/^[0-9a-f]{14}$/i.test(nilai)) return "hex14";
    if (nilai.trim().startsWith("{")) return "json";
    return null;
  }
  return nilai && typeof nilai === "object" ? "json" : null;
}

/** Bacaan warna dari properti mentah (JSON, objek, atau hex). */
export function bacaWarna(nilai: unknown, skalaSV: 255 | 1000): Hsv | null {
  const f = formatWarna(nilai);
  if (f === "hex12") {
    const s = nilai as string;
    const h = parseInt(s.slice(0, 4), 16),
      sa = parseInt(s.slice(4, 8), 16),
      v = parseInt(s.slice(8, 12), 16);
    return { h: h % 360, s: Math.round((Math.min(1000, sa) / 1000) * 100), v: Math.round((Math.min(1000, v) / 1000) * 100) };
  }
  if (f === "hex14") {
    const s = nilai as string;
    const h = parseInt(s.slice(6, 10), 16),
      sa = parseInt(s.slice(10, 12), 16),
      v = parseInt(s.slice(12, 14), 16);
    return { h: h % 360, s: Math.round((sa / 255) * 100), v: Math.round((v / 255) * 100) };
  }
  if (f !== "json") return null;
  let o: unknown = nilai;
  if (typeof nilai === "string") {
    try {
      o = JSON.parse(nilai);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== "object") return null;
  const { h, s, v } = o as Record<string, unknown>;
  if (typeof h !== "number" || typeof s !== "number" || typeof v !== "number") return null;
  return { h: Math.round(h), s: Math.round((s / skalaSV) * 100), v: Math.round((v / skalaSV) * 100) };
}

const hex = (n: number, panjang: number) => Math.max(0, Math.round(n)).toString(16).padStart(panjang, "0");

/** `contoh` = nilai yang sedang dipegang perangkat; formatnya diikuti. */
function tulisWarna(w: Hsv, skalaSV: 255 | 1000, contoh?: unknown): string {
  const h = Math.round(w.h) % 360,
    v = Math.max(1, w.v);
  const f = formatWarna(contoh);
  if (f === "hex12") return hex(h, 4) + hex((w.s / 100) * 1000, 4) + hex((v / 100) * 1000, 4);
  if (f === "hex14") return hsvKeHex({ h, s: w.s, v }).slice(1) + hex(h, 4) + hex((w.s / 100) * 255, 2) + hex((v / 100) * 255, 2);
  return JSON.stringify({ h, s: Math.round((w.s / 100) * skalaSV), v: Math.round((v / 100) * skalaSV) });
}

// ----------------------------------------------------------------- keadaan

export interface KeadaanRamah {
  nyala: boolean | null;
  saluran?: Array<{ nomor: number; nyala: boolean | null }>;
  terangPersen?: number | null;
  suhuPutihPersen?: number | null; // 0 = paling hangat, 100 = paling sejuk
  warnaHex?: string | null;
  modeKerja?: string | null;
  suhuTarget?: number | null;
  suhuRuang?: number | null;
  kelembapan?: number | null;
  modeAc?: string | null;
  kipas?: string | number | null;
  tirai?: string | null;
  posisiPersen?: number | null;
  hitungMundurDetik?: number | null;
  watt?: number | null;
  volt?: number | null;
  ampere?: number | null;
  kwhTotal?: number | null;
  bateraiPersen?: number | null;
  lainnya: Record<string, unknown>;
}

export function bacaKeadaan(k: Kemampuan, prop: Record<string, unknown> | null | undefined): KeadaanRamah {
  const p = prop ?? {};
  const bool = (kode: string) => (typeof p[kode] === "boolean" ? (p[kode] as boolean) : null);
  const keadaan: KeadaanRamah = { nyala: null, lainnya: {} };
  if (k.saluran) {
    keadaan.saluran = k.saluran.map((s) => ({ nomor: s.nomor, nyala: bool(s.kode) }));
    const ada = keadaan.saluran.filter((s) => s.nyala !== null);
    keadaan.nyala = ada.length ? ada.some((s) => s.nyala) : null;
  } else if (k.daya) keadaan.nyala = bool(k.daya.kode);
  if (k.terang) keadaan.terangPersen = mentahKePersen(k.terang, p[k.terang.kode]);
  // Lampu mode warna: kecerahan sebenarnya ada di V warna, bukan bright_value.
  const modeSekarang = k.modeKerja ? p[k.modeKerja.kode] : undefined;
  if (k.warna && modeSekarang === "colour") {
    const w = bacaWarna(p[k.warna.kode], k.warna.skalaSV);
    if (w) keadaan.terangPersen = w.v;
  }
  if (k.suhuPutih) keadaan.suhuPutihPersen = mentahKePersen(k.suhuPutih, p[k.suhuPutih.kode]);
  if (k.warna) {
    const w = bacaWarna(p[k.warna.kode], k.warna.skalaSV);
    keadaan.warnaHex = w ? hsvKeHex({ ...w, v: 100 }) : null;
  }
  if (k.modeKerja) keadaan.modeKerja = typeof p[k.modeKerja.kode] === "string" ? (p[k.modeKerja.kode] as string) : null;
  if (k.suhuTarget) keadaan.suhuTarget = nyata(k.suhuTarget, p[k.suhuTarget.kode]);
  if (k.suhuRuang) keadaan.suhuRuang = nyata(k.suhuRuang, p[k.suhuRuang.kode]);
  if (k.kelembapan) keadaan.kelembapan = nyata(k.kelembapan, p[k.kelembapan.kode]);
  if (k.modeAc) keadaan.modeAc = maknaDari(k.modeAc, p[k.modeAc.kode]);
  if (k.kipas) {
    const v = p[k.kipas.kode];
    keadaan.kipas = "pilihan" in k.kipas ? maknaDari(k.kipas, v) : typeof v === "number" ? v : null;
  }
  if (k.tirai) keadaan.tirai = typeof p[k.tirai.kode] === "string" ? (p[k.tirai.kode] as string) : null;
  if (k.posisi) keadaan.posisiPersen = nyata(k.posisi, p[k.posisi.kode]);
  if (k.hitungMundur) keadaan.hitungMundurDetik = nyata(k.hitungMundur, p[k.hitungMundur.kode]);
  if (k.listrik?.watt) keadaan.watt = nyata(k.listrik.watt, p[k.listrik.watt.kode]);
  if (k.listrik?.kwh) keadaan.kwhTotal = nyata(k.listrik.kwh, p[k.listrik.kwh.kode]);
  if (k.listrik?.volt) keadaan.volt = nyata(k.listrik.volt, p[k.listrik.volt.kode]);
  if (k.listrik?.ampere) {
    const a = nyata(k.listrik.ampere, p[k.listrik.ampere.kode]);
    // cur_current Tuya melapor mA (walau model kadang tidak mencantumkan satuan); tampilkan dalam A.
    keadaan.ampere = a != null && !["a", "amp", "amps"].includes(k.listrik.ampere.unit.toLowerCase()) ? Math.round(a) / 1000 : a;
  }
  if (k.baterai) keadaan.bateraiPersen = nyata(k.baterai, p[k.baterai.kode]);
  for (const x of [...k.lainnya, ...k.bacaan]) if (x.code in p) keadaan.lainnya[x.code] = p[x.code];
  return keadaan;
}

// ------------------------------------------------------------------ perintah

/** Perintah ramah. Semua opsional; yang diisi saja yang diterjemahkan. */
export interface PerintahRamah {
  nyala?: boolean;
  saluran?: number; // untuk saklar multi-saluran; kosong = semua saluran
  terangPersen?: number;
  warna?: string; // nama atau hex
  suhuPutihPersen?: number;
  suhuTarget?: number;
  modeAc?: string;
  kipas?: string | number;
  tirai?: "buka" | "tutup" | "berhenti";
  posisiPersen?: number;
  /** Mode lampu: putih / warna / adegan / musik. */
  modeLampu?: string;
  /** Timer bawaan perangkat dalam menit (0 = batalkan). Berjalan di perangkat, bukan server. */
  hitungMundurMenit?: number;
  properti?: Record<string, unknown>; // mentah (lanjutan)
}

export type HasilTerjemah =
  { ok: true; properti: Record<string, unknown>; ringkasan: string[] } | { ok: false; kode: "tidak_didukung" | "di_luar_rentang" | "nilai_tidak_sah" | "kosong"; pesan: string };

const SINONIM_MODE: Record<string, string[]> = {
  cold: ["dingin", "cool", "cooling", "cold"],
  hot: ["panas", "hangat", "heat", "heating", "hot"],
  auto: ["otomatis", "auto"],
  wind: ["kipas", "angin", "fan", "wind"],
  wet: ["kering", "dry", "dehumidify", "wet", "dehumidification"],
  sleep: ["tidur", "sleep"],
  eco: ["hemat", "eco", "ecology"],
};

const SINONIM_LAMPU: Record<string, string[]> = {
  white: ["putih", "white"],
  colour: ["warna", "color", "colour", "berwarna"],
  scene: ["adegan", "scene", "efek"],
  music: ["musik", "music", "irama"],
};

const SINONIM_KIPAS: Record<string, string[]> = {
  auto: ["otomatis", "auto"],
  low: ["pelan", "rendah", "low", "1"],
  mid: ["sedang", "middle", "mid", "medium", "2"],
  middle: ["sedang", "mid", "medium", "2"],
  high: ["kencang", "tinggi", "high", "3"],
  strong: ["sangat kencang", "turbo", "strong", "4"],
};

/** Seperti `cocokkanPilihan`, tapi mengerti `arti` (mis. "dingin" -> "cold" -> "0" di AC inframerah). Mengembalikan nilai MENTAH. */
function cocokBermakna(spek: SpekEnum, masukan: string, sinonim: Record<string, string[]>): string | null {
  if (!spek.arti) return cocokkanPilihan(spek.pilihan, masukan, sinonim);
  const makna = cocokkanPilihan(pilihanBermakna(spek), masukan, sinonim) ?? (spek.pilihan.includes(masukan.trim()) ? spek.arti[masukan.trim()] : null);
  if (!makna) return null;
  return spek.pilihan.find((x) => (spek.arti![x] ?? x) === makna) ?? null;
}

/** Cocokkan masukan bebas ke salah satu pilihan enum perangkat. */
export function cocokkanPilihan(pilihan: string[], masukan: string, sinonim: Record<string, string[]> = {}): string | null {
  const m = masukan.trim().toLowerCase();
  const tepat = pilihan.find((p) => p.toLowerCase() === m);
  if (tepat) return tepat;
  // Satu kelompok sinonim = kanonik + semua sinonimnya; pilihan perangkat yang
  // masuk kelompok yang sama dengan masukan dianggap cocok ("dingin" -> "cool").
  for (const [kanonik, daftar] of Object.entries(sinonim)) {
    const kelompok = new Set([kanonik, ...daftar]);
    if (!kelompok.has(m)) continue;
    const p = pilihan.find((x) => kelompok.has(x.toLowerCase()));
    if (p) return p;
  }
  return null;
}

/** `sekarang` = properti terakhir perangkat (opsional) - dipakai agar kecerahan lampu berwarna tetap berwarna. */
export function terjemahkan(k: Kemampuan, cmd: PerintahRamah, sekarang?: Record<string, unknown> | null): HasilTerjemah {
  const out: Record<string, unknown> = {};
  const ringkas: string[] = [];
  const tolak = (kode: Extract<HasilTerjemah, { ok: false }>["kode"], pesan: string): HasilTerjemah => ({ ok: false, kode, pesan });

  if (cmd.nyala !== undefined) {
    if (k.saluran) {
      const target = cmd.saluran ? k.saluran.filter((s) => s.nomor === cmd.saluran) : k.saluran;
      if (!target.length) return tolak("tidak_didukung", `Saluran ${cmd.saluran} tidak ada. Pilihan: ${k.saluran.map((s) => s.nomor).join(", ")}.`);
      for (const s of target) out[s.kode] = cmd.nyala;
    } else if (k.daya) out[k.daya.kode] = cmd.nyala;
    else return tolak("tidak_didukung", "Perangkat ini tidak punya saklar nyala/mati yang bisa dikendalikan.");
    ringkas.push(cmd.nyala ? "nyalakan" : "matikan");
  }

  const butuhNyala = () => {
    if (cmd.nyala === undefined && k.daya && !(k.daya.kode in out)) out[k.daya.kode] = true;
  };

  if (cmd.terangPersen !== undefined) {
    if (!k.terang) return tolak("tidak_didukung", "Kecerahan perangkat ini tidak bisa diatur.");
    if (!Number.isFinite(cmd.terangPersen)) return tolak("nilai_tidak_sah", "Kecerahan harus angka 0-100.");
    if (cmd.terangPersen <= 0) {
      if (!k.daya) return tolak("di_luar_rentang", "Kecerahan minimum 1%.");
      out[k.daya.kode] = false;
      ringkas.push("matikan");
    } else {
      // Lampu yang sedang berwarna: kecerahannya ada di V warna, bukan bright_value.
      const wSekarang = k.warna && sekarang?.[k.modeKerja?.kode ?? "work_mode"] === "colour" ? bacaWarna(sekarang[k.warna.kode], k.warna.skalaSV) : null;
      if (wSekarang && k.warna && cmd.warna === undefined)
        out[k.warna.kode] = tulisWarna({ ...wSekarang, v: Math.min(100, cmd.terangPersen) }, k.warna.skalaSV, sekarang?.[k.warna.kode]);
      else out[k.terang.kode] = persenKeMentah(k.terang, cmd.terangPersen);
      butuhNyala();
      ringkas.push(`terang ${Math.round(Math.min(100, cmd.terangPersen))}%`);
    }
  }

  if (cmd.warna !== undefined) {
    const w = tafsirWarna(cmd.warna);
    if (!w) return tolak("nilai_tidak_sah", `Warna "${cmd.warna}" tidak dikenali. Contoh: merah, biru, hangat, putih, atau kode #ff8800.`);
    if (w === "putih" || w === "hangat" || w === "sejuk") {
      if (k.modeKerja?.pilihan.includes("white")) out[k.modeKerja.kode] = "white";
      if (k.suhuPutih) out[k.suhuPutih.kode] = persenKeMentah(k.suhuPutih, w === "hangat" ? 0 : w === "sejuk" ? 100 : 50);
      else if (w !== "putih" && !k.warna) return tolak("tidak_didukung", "Lampu ini hanya putih satu suhu.");
      else if (!k.warna && !k.modeKerja) return tolak("tidak_didukung", "Warna lampu ini tidak bisa diubah.");
      ringkas.push(w === "hangat" ? "putih hangat" : w === "sejuk" ? "putih sejuk" : "putih");
    } else {
      if (!k.warna) return tolak("tidak_didukung", "Lampu ini tidak mendukung warna (hanya putih).");
      const terang = cmd.terangPersen !== undefined ? Math.max(1, Math.min(100, cmd.terangPersen)) : 100;
      out[k.warna.kode] = tulisWarna({ ...w, v: terang }, k.warna.skalaSV, sekarang?.[k.warna.kode]);
      if (k.modeKerja?.pilihan.includes("colour")) out[k.modeKerja.kode] = "colour";
      // Dalam mode warna, terang ikut V warna; hapus bright_value agar lampu tidak berkedip ke mode putih.
      if (k.terang && cmd.terangPersen !== undefined) delete out[k.terang.kode];
      ringkas.push(`warna ${cmd.warna}`);
    }
    butuhNyala();
  }

  if (cmd.suhuPutihPersen !== undefined) {
    if (!k.suhuPutih) return tolak("tidak_didukung", "Suhu warna putih lampu ini tidak bisa diatur.");
    out[k.suhuPutih.kode] = persenKeMentah(k.suhuPutih, cmd.suhuPutihPersen);
    if (k.modeKerja?.pilihan.includes("white")) out[k.modeKerja.kode] = "white";
    butuhNyala();
    ringkas.push(`putih ${cmd.suhuPutihPersen <= 35 ? "hangat" : cmd.suhuPutihPersen >= 65 ? "sejuk" : "netral"}`);
  }

  if (cmd.suhuTarget !== undefined) {
    if (!k.suhuTarget) return tolak("tidak_didukung", "Suhu perangkat ini tidak bisa diatur.");
    const min = k.suhuTarget.min / 10 ** k.suhuTarget.scale,
      max = k.suhuTarget.max / 10 ** k.suhuTarget.scale;
    if (cmd.suhuTarget < min || cmd.suhuTarget > max) return tolak("di_luar_rentang", `Suhu harus antara ${min} dan ${max}${k.suhuTarget.unit || "°"}.`);
    out[k.suhuTarget.kode] = mentah(k.suhuTarget, cmd.suhuTarget);
    butuhNyala();
    ringkas.push(`suhu ${cmd.suhuTarget}°`);
  }

  if (cmd.modeAc !== undefined) {
    if (!k.modeAc) return tolak("tidak_didukung", "Mode perangkat ini tidak bisa diatur.");
    const p = cocokBermakna(k.modeAc, cmd.modeAc, SINONIM_MODE);
    if (!p) return tolak("nilai_tidak_sah", `Mode "${cmd.modeAc}" tidak ada. Pilihan: ${pilihanBermakna(k.modeAc).join(", ")}.`);
    out[k.modeAc.kode] = p;
    butuhNyala();
    ringkas.push(`mode ${cmd.modeAc}`);
  }

  if (cmd.kipas !== undefined) {
    if (!k.kipas) return tolak("tidak_didukung", "Kecepatan kipas tidak bisa diatur.");
    if ("pilihan" in k.kipas) {
      const p = cocokBermakna(k.kipas, String(cmd.kipas), SINONIM_KIPAS);
      if (!p) return tolak("nilai_tidak_sah", `Kecepatan "${cmd.kipas}" tidak ada. Pilihan: ${pilihanBermakna(k.kipas).join(", ")}.`);
      out[k.kipas.kode] = p;
    } else {
      const n = Number(cmd.kipas);
      if (!Number.isFinite(n)) return tolak("nilai_tidak_sah", `Kecepatan kipas berupa angka ${k.kipas.min}-${k.kipas.max}.`);
      out[k.kipas.kode] = mentah(k.kipas, n);
    }
    butuhNyala();
    ringkas.push(`kipas ${cmd.kipas}`);
  }

  if (cmd.modeLampu !== undefined) {
    if (!k.modeKerja) return tolak("tidak_didukung", "Mode lampu ini tidak bisa diatur.");
    const p = cocokkanPilihan(k.modeKerja.pilihan, cmd.modeLampu, SINONIM_LAMPU);
    if (!p) return tolak("nilai_tidak_sah", `Mode lampu "${cmd.modeLampu}" tidak ada. Pilihan: ${k.modeKerja.pilihan.join(", ")}.`);
    out[k.modeKerja.kode] = p;
    butuhNyala();
    ringkas.push(`mode lampu ${p}`);
  }

  if (cmd.hitungMundurMenit !== undefined) {
    if (!k.hitungMundur) return tolak("tidak_didukung", "Perangkat ini tidak punya timer bawaan. Pakai jadwal (create_schedule) sebagai gantinya.");
    const detik = Math.round(cmd.hitungMundurMenit * 60);
    const max = k.hitungMundur.max / 10 ** k.hitungMundur.scale;
    if (!Number.isFinite(detik) || detik < 0 || detik > max) return tolak("di_luar_rentang", `Timer 0-${Math.floor(max / 60)} menit.`);
    out[k.hitungMundur.kode] = mentah(k.hitungMundur, detik);
    ringkas.push(detik === 0 ? "timer dibatalkan" : `timer ${Math.round(detik / 60)} menit`);
  }

  if (cmd.tirai !== undefined) {
    if (!k.tirai) return tolak("tidak_didukung", "Perangkat ini bukan tirai.");
    const peta = { buka: ["open", "on"], tutup: ["close", "off"], berhenti: ["stop", "pause"] } as const;
    const p = k.tirai.pilihan.find((x) => (peta[cmd.tirai!] as readonly string[]).includes(x.toLowerCase()));
    if (!p) return tolak("tidak_didukung", `Tirai ini tidak mendukung "${cmd.tirai}".`);
    out[k.tirai.kode] = p;
    ringkas.push(`tirai ${cmd.tirai}`);
  }

  if (cmd.posisiPersen !== undefined) {
    if (!k.posisi) return tolak("tidak_didukung", "Posisi tirai tidak bisa diatur persen.");
    out[k.posisi.kode] = mentah(k.posisi, Math.min(100, Math.max(0, cmd.posisiPersen)));
    ringkas.push(`posisi ${cmd.posisiPersen}%`);
  }

  if (cmd.properti) {
    const semua = new Map([...k.lainnya, ...k.bacaan].map((p) => [p.code, p]));
    for (const [kode, nilai] of Object.entries(cmd.properti)) {
      const p = semua.get(kode);
      const dikenal = Object.values(k).some((v) => v && typeof v === "object" && "kode" in v && (v as { kode: string }).kode === kode) || !!k.saluran?.some((x) => x.kode === kode);
      if (!p && !dikenal) {
        return tolak("tidak_didukung", `Properti "${kode}" tidak ada di perangkat ini.`);
      }
      if (p && !bisaTulis(p)) return tolak("tidak_didukung", `Properti "${kode}" hanya bisa dibaca.`);
      if (p) {
        const cek = periksaNilai(p, nilai);
        if (cek) return tolak("nilai_tidak_sah", cek);
      }
      out[kode] = nilai;
      ringkas.push(`${kode}=${JSON.stringify(nilai)}`);
    }
  }

  if (Object.keys(out).length === 0) return tolak("kosong", "Tidak ada perintah yang diberikan.");
  return { ok: true, properti: out, ringkasan: ringkas };
}

function periksaNilai(p: PropertiModel, nilai: unknown): string | null {
  const t = p.typeSpec;
  if (t.type === "bool") return typeof nilai === "boolean" ? null : `${p.code} harus true/false.`;
  if (t.type === "enum")
    return typeof nilai === "string" && (t as { range: string[] }).range.includes(nilai) ? null : `${p.code} harus salah satu: ${(t as { range: string[] }).range.join(", ")}.`;
  if (t.type === "value") {
    const v = t as { min: number; max: number };
    return typeof nilai === "number" && nilai >= v.min && nilai <= v.max ? null : `${p.code} harus angka ${v.min}-${v.max} (nilai mentah).`;
  }
  if (t.type === "string") return typeof nilai === "string" ? null : `${p.code} harus teks.`;
  return `${p.code} bertipe ${t.type} dan tidak didukung.`;
}

/** Daftar kemampuan dalam kalimat pendek - untuk agen & lembar detail. */
export function uraikanKemampuan(k: Kemampuan): string[] {
  const d: string[] = [];
  if (k.saluran) d.push(`nyala/mati per saluran (${k.saluran.map((s) => s.nomor).join(", ")})`);
  else if (k.daya) d.push("nyala/mati");
  if (k.terang) d.push("kecerahan 1-100%");
  if (k.warna) d.push("warna (nama atau hex)");
  if (k.suhuPutih) d.push("putih hangat-sejuk 0-100");
  if (k.suhuTarget) d.push(`suhu ${k.suhuTarget.min / 10 ** k.suhuTarget.scale}-${k.suhuTarget.max / 10 ** k.suhuTarget.scale}°`);
  if (k.modeKerja) d.push(`mode lampu (light_mode): ${k.modeKerja.pilihan.join(", ")}`);
  if (k.modeAc) d.push(`mode: ${pilihanBermakna(k.modeAc).join(", ")}`);
  if (k.kipas) d.push("pilihan" in k.kipas ? `kipas: ${pilihanBermakna(k.kipas).join(", ")}` : `kipas ${k.kipas.min}-${k.kipas.max}`);
  if (k.hitungMundur) d.push(`timer bawaan (timer_minutes) 0-${Math.floor(k.hitungMundur.max / 10 ** k.hitungMundur.scale / 60)} menit`);
  if (k.tirai) d.push("tirai buka/tutup/berhenti");
  if (k.posisi) d.push("posisi tirai 0-100%");
  if (k.listrik) d.push("pemakaian listrik (watt, volt, ampere)");
  if (k.inframerah) d.push("dikendalikan lewat remote inframerah: perintah terkirim, tapi keadaan asli AC tidak bisa dibaca balik");
  if (k.pemancarIr) d.push("pemancar remote IR: tambahkan remote (AC/TV) di aplikasi Smart Life, lalu kendalikan perangkat remotenya");
  if (k.suhuRuang) d.push("membaca suhu ruangan");
  if (k.kelembapan) d.push("membaca kelembapan");
  for (const p of k.lainnya) d.push(`lanjutan: ${p.code} (${p.typeSpec.type})`);
  return d;
}
