import { eq } from "drizzle-orm";
import { z } from "zod";
import { BAWAAN_SISTEM, SkemaBawaan, type Bawaan } from "@/lib/alarm/isi";
import { keadaanKunci } from "@/lib/alarm/komitmen";
import { denganPengguna, schema } from "@/lib/db";
import { isi, type Bahasa } from "@/lib/i18n";
import { SkemaJam } from "@/lib/jadwal/pengulangan";
import { zonaSah } from "@/lib/jadwal/zona";
import { alarmTerkunci, pindahZona } from "./alarm";
import { catatAudit } from "./audit";
import { GalatLayanan, pesanMasukan, type Sumber } from "./dasar";
import { jamTampil, konteksPengguna } from "./konteks";

/** Preferensi pengguna (PRD M): nama panggilan, zona, bahasa, jam tidur, tema, bawaan alarm baru, pengingat malam. */

export type Preferensi = {
  nama: string | null;
  namaPanggilan: string | null;
  zonaWaktu: string;
  bahasa: Bahasa;
  jamTidur: string;
  tema: "sistem" | "terang" | "gelap";
  /** Bawaan lengkap (bawaan sistem + yang diatur pengguna). */
  bawaan: Required<Bawaan>;
  pengingatMalam: boolean;
  orientasiSelesai: boolean;
};

export const SkemaUbahPreferensi = z.strictObject({
  namaPanggilan: z
    .string()
    .trim()
    .min(1, "nama_wajib")
    .refine((s) => Array.from(s).length <= 30, "terlalu_panjang")
    .nullable()
    .optional(),
  zonaWaktu: z.string().refine(zonaSah, "zona_tidak_sah").optional(),
  bahasa: z.enum(["id", "en"]).optional(),
  jamTidur: SkemaJam.optional(),
  tema: z.enum(["sistem", "terang", "gelap"]).optional(),
  /** Sebagian bawaan; digabung ke bawaan lama. */
  bawaan: SkemaBawaan.optional(),
  pengingatMalam: z.boolean().optional(),
  orientasiSelesai: z.boolean().optional(),
});

export async function ambilPreferensi(penggunaId: string): Promise<Preferensi> {
  return denganPengguna(penggunaId, async (tx) => {
    const [p] = await tx.select().from(schema.pengguna).where(eq(schema.pengguna.id, penggunaId));
    if (!p) throw new GalatLayanan("tidak_ditemukan", "Pengguna tidak ditemukan.");
    const b = SkemaBawaan.safeParse(p.bawaan);
    return {
      nama: p.nama,
      namaPanggilan: p.namaPanggilan,
      zonaWaktu: p.zonaWaktu,
      bahasa: p.bahasa === "en" ? "en" : "id",
      jamTidur: p.jamTidur,
      tema: p.tema === "terang" || p.tema === "gelap" ? p.tema : "sistem",
      bawaan: { ...BAWAAN_SISTEM, ...(b.success ? b.data : {}) },
      pengingatMalam: p.pengingatMalam,
      orientasiSelesai: !!p.orientasiSelesai,
    };
  });
}

export async function ubahPreferensi(penggunaId: string, masukan: unknown, sumber: Sumber, opsi: { sekarang?: Date } = {}): Promise<Preferensi> {
  const sekarang = opsi.sekarang ?? new Date();
  await denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const h = SkemaUbahPreferensi.safeParse(masukan ?? {});
    if (!h.success) throw new GalatLayanan("masukan", pesanMasukan(h.error, k.t));
    const m = h.data;

    // Jam tidur dan zona tidak boleh dipakai untuk membuka kunci Komitmen yang sedang berjalan.
    if ((m.jamTidur && m.jamTidur !== k.jamTidur) || (m.zonaWaktu && m.zonaWaktu !== k.zona)) {
      for (const a of await alarmTerkunci(tx, k, sekarang)) {
        const masih = keadaanKunci({ komitmen: true, aktif: true }, a.sampai, m.jamTidur ?? k.jamTidur, m.zonaWaktu ?? a.zona, sekarang);
        if (!masih.terkunci) throw new GalatLayanan("komitmen_terkunci", isi(k.t.galat.komitmen.jamTidur, { jam: jamTampil(a.sampai, a.zona, k.bahasa) }), { alasan: "jam_tidur" });
      }
    }
    if (m.zonaWaktu && m.zonaWaktu !== k.zona) await pindahZona(tx, k, m.zonaWaktu, sekarang);

    await tx
      .update(schema.pengguna)
      .set({
        ...(m.namaPanggilan !== undefined ? { namaPanggilan: m.namaPanggilan } : {}),
        ...(m.zonaWaktu ? { zonaWaktu: m.zonaWaktu } : {}),
        ...(m.bahasa ? { bahasa: m.bahasa } : {}),
        ...(m.jamTidur ? { jamTidur: m.jamTidur } : {}),
        ...(m.tema ? { tema: m.tema } : {}),
        ...(m.bawaan ? { bawaan: { ...k.bawaan, ...m.bawaan } } : {}),
        ...(m.pengingatMalam !== undefined ? { pengingatMalam: m.pengingatMalam } : {}),
        ...(m.orientasiSelesai !== undefined ? { orientasiSelesai: m.orientasiSelesai ? sekarang : null } : {}),
      })
      .where(eq(schema.pengguna.id, penggunaId));
    await catatAudit(penggunaId, { sumber, jenis: "pengaturan", ringkasan: "Pengaturan diubah", detail: { isian: Object.keys(m) } }, tx);
  });
  return ambilPreferensi(penggunaId);
}
