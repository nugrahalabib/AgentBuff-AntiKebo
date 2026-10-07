import type { schema } from "@/lib/db";
import type { IdBunyi, IdKarakter, IsiAlarm } from "./isi";

/** Peta baris tabel `alarm` dan isi alarm. Kolom sama nama, jadi peta ini hanya memilih isian. */

export type BarisAlarm = typeof schema.alarm.$inferSelect;

export function isiDariBaris(a: BarisAlarm): IsiAlarm {
  return {
    jam: a.jam,
    pengulangan: a.pengulangan,
    agendaJudul: a.agendaJudul,
    agendaDetail: a.agendaDetail,
    karakter: a.karakter as IdKarakter,
    suaraId: a.suaraId,
    bunyi: a.bunyi as IdBunyi,
    soal: a.soal,
    tunda: a.tunda,
    spam: a.spam,
    tuya: a.tuya,
    komitmen: a.komitmen,
    masihBangun: a.masihBangun,
    liburNasional: a.liburNasional,
    batasMenit: a.batasMenit,
    aktif: a.aktif,
  };
}

/** Kolom yang ditulis dari isi alarm (tanpa id, pemilik, zona, cap waktu). */
export function kolomDariIsi(i: IsiAlarm) {
  return {
    jam: i.jam,
    pengulangan: i.pengulangan,
    agendaJudul: i.agendaJudul,
    agendaDetail: i.agendaDetail,
    karakter: i.karakter,
    suaraId: i.suaraId,
    bunyi: i.bunyi,
    soal: i.soal,
    tunda: i.tunda,
    spam: i.spam,
    tuya: i.tuya,
    komitmen: i.komitmen,
    masihBangun: i.masihBangun,
    liburNasional: i.liburNasional,
    batasMenit: i.batasMenit,
    aktif: i.aktif,
  };
}
