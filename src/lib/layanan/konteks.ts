import { eq } from "drizzle-orm";
import { SkemaBawaan, type Bawaan } from "@/lib/alarm/isi";
import { schema, type Tx } from "@/lib/db";
import { bahasaSah, type Bahasa, type Kamus } from "@/lib/i18n";
import { kamusUntuk } from "@/lib/i18n/kamus-server";
import { GalatLayanan } from "./dasar";

export type KonteksPengguna = { id: string; zona: string; jamTidur: string; bawaan: Bawaan; bahasa: Bahasa; t: Kamus };

/**
 * Preferensi yang dibutuhkan layanan dalam satu transaksi. `kunci` = kunci baris pengguna
 * (FOR UPDATE) supaya perubahan alarm satu pengguna berjalan berurutan: batas jumlah dan
 * "satu kejadian menunggu per alarm" tidak bisa dilanggar dua permintaan bersamaan.
 */
export async function konteksPengguna(tx: Tx, penggunaId: string, kunci = false): Promise<KonteksPengguna> {
  const q = tx
    .select({ zona: schema.pengguna.zonaWaktu, jamTidur: schema.pengguna.jamTidur, bawaan: schema.pengguna.bawaan, bahasa: schema.pengguna.bahasa })
    .from(schema.pengguna)
    .where(eq(schema.pengguna.id, penggunaId));
  const [p] = kunci ? await q.for("update") : await q;
  if (!p) throw new GalatLayanan("tidak_ditemukan", "Pengguna tidak ditemukan.");
  const bahasa = bahasaSah(p.bahasa);
  const bawaan = SkemaBawaan.safeParse(p.bawaan);
  return { id: penggunaId, zona: p.zona, jamTidur: p.jamTidur, bawaan: bawaan.success ? bawaan.data : {}, bahasa, t: kamusUntuk(bahasa) };
}

/** "05.00" (id) atau "05:00" (en) dari sebuah instan di zona pengguna. */
export function jamTampil(instan: Date, zona: string, bahasa: Bahasa): string {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: zona, hour: "2-digit", minute: "2-digit", hour12: false }).format(instan);
  return bahasa === "id" ? f.replace(":", ".") : f;
}
