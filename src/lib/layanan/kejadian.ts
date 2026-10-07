import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { isiDariBaris } from "@/lib/alarm/baris";
import { BAWAAN_SISTEM, type IsiAlarm } from "@/lib/alarm/isi";
import { denganPengguna, schema } from "@/lib/db";
import { bagianLokal } from "@/lib/jadwal/zona";
import { STATUS_AKTIF } from "@/lib/penjadwal/mesin";
import type { IsiKejadian } from "@/lib/penjadwal/saluran";
import { catatAudit } from "./audit";
import { GalatLayanan, pesanMasukan, type Sumber } from "./dasar";
import { konteksPengguna } from "./konteks";

/** Kejadian alarm dari sisi pengguna: uji alarm (PRD B9) dan kejadian yang sedang aktif. */

export const UJI_DALAM_MS = 60_000;
export const SkemaUji = z.strictObject({ alarmId: z.uuid().optional(), spam: z.boolean().optional(), tuya: z.boolean().optional() });

export type KejadianAktif = {
  id: string;
  alarmId: string | null;
  status: string;
  judul: string;
  detail: string | null;
  jam: string;
  jadwalUtc: Date;
  tundaSampai: Date | null;
  tunda: { terpakai: number; jatah: number; menit: number };
  uji: boolean;
};

/**
 * Uji alarm: berbunyi 1 menit lagi di semua perangkat siaga, versi singkat (berhenti sendiri
 * sesudah 5 menit), soal Ringan 1 kali, tanpa tunda dan tanpa Komitmen. Spam dan rumah pintar ikut
 * hanya bila dicentang. Tidak menggeser jadwal alarm asli dan tidak dihitung skor. Satu uji aktif
 * per pengguna: memanggil lagi mengembalikan uji yang sama.
 */
export async function ujiAlarm(penggunaId: string, masukan: unknown, sumber: Sumber, opsi: { sekarang?: Date } = {}): Promise<{ kejadianId: string; jadwalUtc: Date }> {
  const sekarang = opsi.sekarang ?? new Date();
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const h = SkemaUji.safeParse(masukan ?? {});
    if (!h.success) throw new GalatLayanan("masukan", pesanMasukan(h.error, k.t));
    const [ada] = await tx
      .select()
      .from(schema.kejadianAlarm)
      .where(and(eq(schema.kejadianAlarm.penggunaId, penggunaId), eq(schema.kejadianAlarm.uji, true), inArray(schema.kejadianAlarm.status, ["menunggu", ...STATUS_AKTIF])));
    if (ada) return { kejadianId: ada.id, jadwalUtc: ada.jadwalUtc };

    let dasar: IsiAlarm = {
      ...BAWAAN_SISTEM,
      ...k.bawaan,
      jam: "00:00",
      pengulangan: { jenis: "harian" },
      agendaJudul: k.t.uji.judul,
      agendaDetail: null,
      tuya: [],
      aktif: true,
    } as IsiAlarm;
    if (h.data.alarmId) {
      const [a] = await tx
        .select()
        .from(schema.alarm)
        .where(and(eq(schema.alarm.penggunaId, penggunaId), eq(schema.alarm.id, h.data.alarmId)));
      if (!a) throw new GalatLayanan("tidak_ditemukan", k.t.galat.alarmTidakAda);
      dasar = isiDariBaris(a);
    }
    const jadwal = new Date(sekarang.getTime() + UJI_DALAM_MS);
    const lokal = bagianLokal(jadwal, k.zona);
    const jam = `${String(lokal.jam).padStart(2, "0")}:${String(lokal.menit).padStart(2, "0")}`;
    const isi: IsiKejadian = {
      ...dasar,
      jam,
      soal: { jenis: "hitungan", tingkat: "ringan", benar: 1, kodeQr: [] },
      tunda: { jatah: 0, menit: 5 },
      masihBangun: { ...dasar.masihBangun, aktif: false },
      komitmen: false,
      batasMenit: 5,
      spam: h.data.spam ? dasar.spam : { ...dasar.spam, kanal: [] },
      tuya: h.data.tuya ? dasar.tuya : [],
      zona: k.zona,
    };
    const [baru] = await tx
      .insert(schema.kejadianAlarm)
      .values({
        penggunaId,
        alarmId: h.data.alarmId ?? null,
        jadwalUtc: jadwal,
        tanggalLokal: lokal.tanggal,
        jamLokal: jam,
        judul: dasar.agendaJudul,
        uji: true,
        isi,
        dibuat: sekarang,
        diubah: sekarang,
      })
      .returning();
    await catatAudit(penggunaId, { sumber, jenis: "kejadian", ringkasan: `Uji alarm ${jam}`, detail: { kejadianId: baru.id, spam: !!h.data.spam, tuya: !!h.data.tuya } }, tx);
    return { kejadianId: baru.id, jadwalUtc: jadwal };
  });
}

/** Kejadian yang sedang berbunyi, ditunda, atau menunggu konfirmasi bangun (layar alarm, PRD B8). */
export async function kejadianAktif(penggunaId: string): Promise<KejadianAktif[]> {
  const daftar = await denganPengguna(penggunaId, (tx) =>
    tx
      .select()
      .from(schema.kejadianAlarm)
      .where(and(eq(schema.kejadianAlarm.penggunaId, penggunaId), inArray(schema.kejadianAlarm.status, [...STATUS_AKTIF])))
      .orderBy(asc(schema.kejadianAlarm.jadwalUtc)),
  );
  return daftar.map((x) => {
    const isi = x.isi as IsiKejadian | null;
    return {
      id: x.id,
      alarmId: x.alarmId,
      status: x.status,
      judul: x.judul,
      detail: isi?.agendaDetail ?? null,
      jam: x.jamLokal,
      jadwalUtc: x.jadwalUtc,
      tundaSampai: x.tundaSampai,
      tunda: { terpakai: x.jumlahTunda, jatah: isi?.tunda.jatah ?? 0, menit: isi?.tunda.menit ?? 5 },
      uji: x.uji,
    };
  });
}
