/**
 * Pusat data Tuya ditentukan dua huruf sesudah `sk-` pada API key end-user
 * (sumber: github.com/tuya/tuya-openclaw-skills references/api-conventions.md,
 * tuya.ai/developer/docs). Pengguna tidak pernah memilih wilayah sendiri.
 */

export type KodeWilayah = "AY" | "AZ" | "EU" | "IN" | "UE" | "WE" | "SG";

export interface Wilayah {
  kode: KodeWilayah;
  nama: { id: string; en: string };
  rest: string;
  ws: string;
}

export const WILAYAH: Record<KodeWilayah, Wilayah> = {
  AY: { kode: "AY", nama: { id: "Tiongkok", en: "China" }, rest: "https://openapi.tuyacn.com", ws: "wss://wsmsgs.tuyacn.com" },
  AZ: { kode: "AZ", nama: { id: "Amerika Barat", en: "US West" }, rest: "https://openapi.tuyaus.com", ws: "wss://wsmsgs.iot-wus.com" },
  EU: { kode: "EU", nama: { id: "Eropa Tengah", en: "Central Europe" }, rest: "https://openapi.tuyaeu.com", ws: "wss://wsmsgs.iot-eu.com" },
  IN: { kode: "IN", nama: { id: "India", en: "India" }, rest: "https://openapi.tuyain.com", ws: "wss://wsmsgs.iot-ap.com" },
  UE: { kode: "UE", nama: { id: "Amerika Timur", en: "US East" }, rest: "https://openapi-ueaz.tuyaus.com", ws: "wss://wsmsgs.iot-eus.com" },
  WE: { kode: "WE", nama: { id: "Eropa Barat", en: "Western Europe" }, rest: "https://openapi-weaz.tuyaeu.com", ws: "wss://wsmsgs.iot-weu.com" },
  SG: { kode: "SG", nama: { id: "Singapura", en: "Singapore" }, rest: "https://openapi-sg.iotbing.com", ws: "wss://wsmsgs.iot-sea.com" },
};

/** Bentuk kunci: `sk-` + 2 huruf wilayah + sisa alfanumerik. Spasi/kutip di tepi dibuang. */
const POLA_KUNCI = /^sk-([A-Za-z]{2})[A-Za-z0-9]{8,}$/;

export type HasilBacaKunci =
  | { ok: true; kunci: string; wilayah: Wilayah }
  | { ok: false; alasan: "kosong" | "bukan_kunci" | "wilayah_tak_dikenal" };

export function bacaKunci(masukan: string): HasilBacaKunci {
  const kunci = masukan.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!kunci) return { ok: false, alasan: "kosong" };
  const cocok = POLA_KUNCI.exec(kunci);
  if (!cocok) return { ok: false, alasan: "bukan_kunci" };
  const kode = cocok[1].toUpperCase() as KodeWilayah;
  const wilayah = WILAYAH[kode];
  if (!wilayah) return { ok: false, alasan: "wilayah_tak_dikenal" };
  return { ok: true, kunci, wilayah };
}

/** Untuk tampilan: `sk-SG••••7a2f`. Kunci utuh tidak pernah dikirim ke peramban. */
export function samarkanKunci(kunci: string): string {
  if (kunci.length <= 9) return "sk-••••";
  return `${kunci.slice(0, 5)}••••${kunci.slice(-4)}`;
}
