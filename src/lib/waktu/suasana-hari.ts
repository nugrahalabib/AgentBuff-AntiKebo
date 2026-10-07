import { bagianLokal, zonaSah } from "./zona";

export type WaktuHari = "pagi" | "siang" | "sore" | "malam";

/** Bagian hari untuk latar ambient & sapaan: pagi 04-10, siang 10-15, sore 15-18, malam selebihnya. */
export function waktuHari(zona: string, kini = new Date()): WaktuHari {
  const j = bagianLokal(kini, zonaSah(zona) ? zona : "Asia/Jakarta").jam;
  if (j >= 4 && j < 10) return "pagi";
  if (j >= 10 && j < 15) return "siang";
  if (j >= 15 && j < 18) return "sore";
  return "malam";
}
