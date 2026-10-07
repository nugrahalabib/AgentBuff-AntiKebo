import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { denganPengguna, schema } from "@/lib/db";
import { isi } from "@/lib/i18n";
import { STATUS_AKTIF } from "@/lib/penjadwal/mesin";
import { alarmTerkunci } from "./alarm";
import { catatAudit } from "./audit";
import { GalatLayanan, type Sumber } from "./dasar";
import { jamTampil, konteksPengguna } from "./konteks";

/**
 * Hapus semua data (PRD A5). Konfirmasi ketik ("HAPUS" / "DELETE" sesuai bahasa pengguna).
 * Ditolak selama alarm berbunyi (K-37) dan selama jendela Mode Komitmen (kalau tidak, hapus data
 * jadi jalan pintas mematikan alarm yang dikunci). Yang dihapus: alarm, kejadian + soal + langkah,
 * template, perangkat siaga (token tidak berlaku, aliran SSE ditutup), kode sambung, kode QR,
 * naskah + klip suara, kiriman kanal, langganan push, rumah pintar (kunci Tuya + cermin + potret),
 * token agen, catatan aktivitas, preferensi. Semua sesi dicabut. Baris `pengguna` tetap (dikunci
 * `agentbuff_sub`) dengan `dihapus_pada`, supaya masuk lagi = mulai dari awal dengan orientasi.
 */

export const SkemaHapusData = z.strictObject({ konfirmasi: z.string().max(40) });

export async function hapusSemuaData(penggunaId: string, masukan: unknown, sumber: Sumber, sekarang = new Date()): Promise<void> {
  await denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const m = SkemaHapusData.safeParse(masukan ?? {});
    if (!m.success || m.data.konfirmasi.trim().toUpperCase() !== k.t.hapusData.kata) throw new GalatLayanan("masukan", k.t.hapusData.salahKata);

    // Kunci semua kejadian yang belum selesai: worker (SKIP LOCKED) tidak bisa mengklaimnya di tengah jalan.
    const berjalan = await tx
      .select({ status: schema.kejadianAlarm.status })
      .from(schema.kejadianAlarm)
      .where(and(eq(schema.kejadianAlarm.penggunaId, penggunaId), inArray(schema.kejadianAlarm.status, ["menunggu", ...STATUS_AKTIF])))
      .for("update");
    if (berjalan.some((x) => x.status !== "menunggu")) throw new GalatLayanan("sedang_berbunyi", k.t.hapusData.berbunyi);
    const [kunci] = await alarmTerkunci(tx, k, sekarang);
    if (kunci) {
      throw new GalatLayanan("komitmen_terkunci", isi(k.t.hapusData.komitmen, { jam: jamTampil(kunci.sampai, kunci.zona, k.bahasa) }), {
        alasan: "hapus_data",
        terkunciSampai: kunci.sampai.toISOString(),
      });
    }

    // Perangkat dicabut dulu (pemicu mengabarkan `cabut`: aliran SSE ditutup, aplikasi PC keluar).
    await tx
      .update(schema.perangkatSiaga)
      .set({ dicabutPada: sekarang, tokenHash: null })
      .where(and(eq(schema.perangkatSiaga.penggunaId, penggunaId), isNull(schema.perangkatSiaga.dicabutPada)));

    await tx.delete(schema.langkahKejadian).where(eq(schema.langkahKejadian.penggunaId, penggunaId));
    await tx.delete(schema.soalKejadian).where(eq(schema.soalKejadian.penggunaId, penggunaId));
    await tx.delete(schema.potretTuya).where(eq(schema.potretTuya.penggunaId, penggunaId));
    await tx.delete(schema.kirimanKanal).where(eq(schema.kirimanKanal.penggunaId, penggunaId));
    await tx.delete(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.penggunaId, penggunaId));
    await tx.delete(schema.lewatiAlarm).where(eq(schema.lewatiAlarm.penggunaId, penggunaId));
    await tx.delete(schema.alarm).where(eq(schema.alarm.penggunaId, penggunaId));
    await tx.delete(schema.templateAlarm).where(eq(schema.templateAlarm.penggunaId, penggunaId));
    await tx.delete(schema.kodeQr).where(eq(schema.kodeQr.penggunaId, penggunaId));
    await tx.delete(schema.naskahSuara).where(eq(schema.naskahSuara.penggunaId, penggunaId));
    await tx.delete(schema.klipSuara).where(eq(schema.klipSuara.penggunaId, penggunaId));
    await tx.delete(schema.langgananPush).where(eq(schema.langgananPush.penggunaId, penggunaId));
    await tx.delete(schema.kodeSambung).where(eq(schema.kodeSambung.penggunaId, penggunaId));
    await tx.delete(schema.perangkatSiaga).where(eq(schema.perangkatSiaga.penggunaId, penggunaId));
    await tx.delete(schema.perangkatTuya).where(eq(schema.perangkatTuya.penggunaId, penggunaId));
    await tx.delete(schema.sambunganTuya).where(eq(schema.sambunganTuya.penggunaId, penggunaId));
    await tx.delete(schema.tokenMcp).where(eq(schema.tokenMcp.penggunaId, penggunaId));
    await tx.delete(schema.audit).where(eq(schema.audit.penggunaId, penggunaId));

    await tx
      .update(schema.pengguna)
      .set({
        email: null,
        nama: null,
        foto: null,
        namaPanggilan: null,
        jamTidur: "22:00",
        bawaan: {},
        pengingatMalam: true,
        pengingatTerkirim: null,
        orientasiSelesai: null,
        tema: "sistem",
        dihapusPada: sekarang,
      })
      .where(eq(schema.pengguna.id, penggunaId));
    await tx
      .update(schema.sesi)
      .set({ dicabutPada: sekarang })
      .where(and(eq(schema.sesi.penggunaId, penggunaId), isNull(schema.sesi.dicabutPada)));
    await catatAudit(penggunaId, { sumber, jenis: "lainnya", ringkasan: "Semua data dihapus" }, tx);
  });
}
