import { bacaKeadaan, nilaiBacaan, type Kemampuan } from "@/lib/tuya/kemampuan";
import { bagianLokal } from "@/lib/waktu/jadwal";

// Pemicu otomasi: MURNI (tanpa DB), supaya bisa diuji tuntas. Pemicu ditembak
// hanya pada TEPI: syarat salah/tak diketahui sebelumnya, benar sesudahnya.
// Kode sensor mengikuti Standard Instruction Set Tuya (mcs, pir, ywbj, sj, rqbj).

export const JENIS_PEMICU = [
  "menyala",
  "mati",
  "offline",
  "online",
  "pintu_terbuka",
  "pintu_tertutup",
  "gerakan",
  "asap",
  "bocor_air",
  "gas",
  "suhu_di_atas",
  "suhu_di_bawah",
  "lembap_di_atas",
  "lembap_di_bawah",
  "daya_di_atas",
  "baterai_di_bawah",
  "properti_sama",
  "nilai_di_atas",
  "nilai_di_bawah",
] as const;
export type JenisPemicu = (typeof JENIS_PEMICU)[number];

export type Pemicu = { deviceId: string; jenis: JenisPemicu; nilai?: number; kode?: string; sama?: string | number | boolean };

/** Keadaan perangkat yang dipantau pada satu saat. */
export type Pantauan = { online: boolean; properti: Record<string, unknown> };

const KODE_PINTU = ["doorcontact_state", "door_state", "doorcontact_state_2"];
const KODE_GERAK = ["pir", "presence_state", "pir_state", "motion_state"];
const KODE_ASAP = ["smoke_sensor_status", "smoke_sensor_state"];
const KODE_AIR = ["watersensor_state", "water_sensor_state"];
const KODE_GAS = ["gas_sensor_status", "gas_sensor_state"];
const KODE_BATERAI_ENUM = ["battery_state", "battery_status"];

const PERLU_ANGKA = new Set<JenisPemicu>(["suhu_di_atas", "suhu_di_bawah", "lembap_di_atas", "lembap_di_bawah", "daya_di_atas", "baterai_di_bawah", "nilai_di_atas", "nilai_di_bawah"]);
export const pemicuButuhKode = (j: JenisPemicu) => j === "properti_sama" || j === "nilai_di_atas" || j === "nilai_di_bawah";

/** Nilai NYATA (sudah diskalakan) properti angka apa pun, mis. co2_value, pm25_value, bright_value sensor cahaya. */
function angkaProperti(k: Kemampuan, kode: string | undefined, p: Record<string, unknown>): number | null {
  if (!kode || !(kode in p)) return null;
  const spek = [...k.bacaan, ...k.lainnya].find((x) => x.code === kode);
  if (spek) {
    const v = nilaiBacaan(spek, p[kode]).nilai;
    return typeof v === "number" ? v : null;
  }
  const n = Number(p[kode]);
  return Number.isFinite(n) ? n : null;
}
export const pemicuButuhAngka = (j: JenisPemicu) => PERLU_ANGKA.has(j);

function pertama(p: Record<string, unknown>, kode: string[]): unknown {
  for (const k of kode) if (k in p) return p[k];
  return undefined;
}

function alarm(v: unknown): boolean | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  return s === "alarm" || s === "1" || s === "true";
}

function gerak(v: unknown): boolean | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  return s === "pir" || s === "presence" || s === "motion" || s === "1" || s === "true";
}

function pintuTerbuka(v: unknown): boolean | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  return s === "open" || s === "1" || s === "true";
}

const lebih = (a: number | null | undefined, b: number | undefined) => (a == null || b === undefined ? null : a > b);
const kurang = (a: number | null | undefined, b: number | undefined) => (a == null || b === undefined ? null : a < b);

/** true = syarat terpenuhi, false = tidak, null = belum bisa dinilai (data belum ada). */
export function syaratTerpenuhi(pm: Pemicu, k: Kemampuan, x: Pantauan): boolean | null {
  if (pm.jenis === "online") return x.online;
  if (pm.jenis === "offline") return !x.online;
  if (!x.online) return false;
  const p = x.properti ?? {};
  const s = bacaKeadaan(k, p);
  switch (pm.jenis) {
    case "menyala":
      return s.nyala;
    case "mati":
      return s.nyala === null ? null : !s.nyala;
    case "pintu_terbuka":
      return pintuTerbuka(pertama(p, KODE_PINTU));
    case "pintu_tertutup": {
      const b = pintuTerbuka(pertama(p, KODE_PINTU));
      return b === null ? null : !b;
    }
    case "gerakan":
      return gerak(pertama(p, KODE_GERAK));
    case "asap":
      return alarm(pertama(p, KODE_ASAP));
    case "bocor_air":
      return alarm(pertama(p, KODE_AIR));
    case "gas":
      return alarm(pertama(p, KODE_GAS));
    case "suhu_di_atas":
      return lebih(s.suhuRuang, pm.nilai);
    case "suhu_di_bawah":
      return kurang(s.suhuRuang, pm.nilai);
    case "lembap_di_atas":
      return lebih(s.kelembapan, pm.nilai);
    case "lembap_di_bawah":
      return kurang(s.kelembapan, pm.nilai);
    case "daya_di_atas":
      return lebih(s.watt, pm.nilai);
    case "baterai_di_bawah": {
      if (s.bateraiPersen != null) return kurang(s.bateraiPersen, pm.nilai);
      const e = pertama(p, KODE_BATERAI_ENUM);
      return e === undefined ? null : String(e).toLowerCase() === "low";
    }
    case "properti_sama":
      return pm.kode && pm.kode in p ? String(p[pm.kode]) === String(pm.sama) : null;
    case "nilai_di_atas":
      return lebih(angkaProperti(k, pm.kode, p), pm.nilai);
    case "nilai_di_bawah":
      return kurang(angkaProperti(k, pm.kode, p), pm.nilai);
  }
}

/** Tepi naik: dulu tidak/tak diketahui, sekarang terpenuhi. */
export function terpicu(pm: Pemicu, k: Kemampuan, sebelum: Pantauan, sesudah: Pantauan): boolean {
  return syaratTerpenuhi(pm, k, sesudah) === true && syaratTerpenuhi(pm, k, sebelum) !== true;
}

/** Apakah perangkat bisa melaporkan pemicu ini? `kode` = semua kode properti model. */
export function pemicuDidukung(pm: Pemicu, k: Kemampuan, kode: Set<string>): boolean {
  const ada = (daftar: string[]) => daftar.some((c) => kode.has(c));
  switch (pm.jenis) {
    case "online":
    case "offline":
      return true;
    case "menyala":
    case "mati":
      return !!(k.daya || k.saluran);
    case "pintu_terbuka":
    case "pintu_tertutup":
      return ada(KODE_PINTU);
    case "gerakan":
      return ada(KODE_GERAK);
    case "asap":
      return ada(KODE_ASAP);
    case "bocor_air":
      return ada(KODE_AIR);
    case "gas":
      return ada(KODE_GAS);
    case "suhu_di_atas":
    case "suhu_di_bawah":
      return !!k.suhuRuang;
    case "lembap_di_atas":
    case "lembap_di_bawah":
      return !!k.kelembapan;
    case "daya_di_atas":
      return !!k.listrik?.watt;
    case "baterai_di_bawah":
      return !!k.baterai || ada(KODE_BATERAI_ENUM);
    case "properti_sama":
    case "nilai_di_atas":
    case "nilai_di_bawah":
      return !!pm.kode && kode.has(pm.kode);
  }
}

/** Kalimat bahasa Indonesia untuk pemicu, mis. "Sensor Pintu terbuka". */
export function uraikanPemicu(pm: Pemicu, nama: string): string {
  const n = pm.nilai;
  switch (pm.jenis) {
    case "menyala":
      return `${nama} menyala`;
    case "mati":
      return `${nama} mati`;
    case "offline":
      return `${nama} offline`;
    case "online":
      return `${nama} kembali online`;
    case "pintu_terbuka":
      return `${nama} terbuka`;
    case "pintu_tertutup":
      return `${nama} tertutup`;
    case "gerakan":
      return `${nama} mendeteksi gerakan`;
    case "asap":
      return `${nama} mendeteksi asap`;
    case "bocor_air":
      return `${nama} mendeteksi air bocor`;
    case "gas":
      return `${nama} mendeteksi gas`;
    case "suhu_di_atas":
      return `suhu ${nama} di atas ${n}°`;
    case "suhu_di_bawah":
      return `suhu ${nama} di bawah ${n}°`;
    case "lembap_di_atas":
      return `kelembapan ${nama} di atas ${n}%`;
    case "lembap_di_bawah":
      return `kelembapan ${nama} di bawah ${n}%`;
    case "daya_di_atas":
      return `daya ${nama} di atas ${n} W`;
    case "baterai_di_bawah":
      return `baterai ${nama} di bawah ${n}%`;
    case "properti_sama":
      return `${nama}: ${pm.kode} = ${String(pm.sama)}`;
    case "nilai_di_atas":
      return `${nama}: ${pm.kode} di atas ${n}`;
    case "nilai_di_bawah":
      return `${nama}: ${pm.kode} di bawah ${n}`;
  }
}

const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const jamSahOtomasi = (s: string) => POLA_JAM.test(s);

/** Rentang jam lokal "HH:MM"-"HH:MM"; rentang lewat tengah malam (22:00-06:00) didukung. */
export function dalamRentang(r: { mulai: string; akhir: string } | null | undefined, sekarang: Date, zona: string): boolean {
  if (!r) return true;
  const menit = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const b = bagianLokal(sekarang, zona);
  const kini = b.jam * 60 + b.menit;
  const a = menit(r.mulai), z = menit(r.akhir);
  if (a === z) return true;
  return a < z ? kini >= a && kini < z : kini >= a || kini < z;
}
