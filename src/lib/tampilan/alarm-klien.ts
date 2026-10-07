import type { AturanTuya, IsiAlarm } from "@/lib/alarm/isi";
import type { Pengulangan } from "@/lib/jadwal/pengulangan";
import type { AlarmLengkap } from "@/lib/layanan/alarm";
import type { LayarKejadian } from "@/lib/layanan/kejadian";
import type { RingkasAlarm } from "./jenis";

/** Bentuk data sesudah lewat JSON (Date jadi teks ISO). */
export type Jsonkan<T> = T extends Date ? string : T extends readonly (infer U)[] ? Jsonkan<U>[] : T extends object ? { [K in keyof T]: Jsonkan<T[K]> } : T;

export type AlarmKlien = Jsonkan<AlarmLengkap>;
export type LayarKejadianKlien = Jsonkan<LayarKejadian>;
export type { AturanTuya, IsiAlarm, Pengulangan };

/** Isi lembar Ubah alarm: isi alarm, dengan "sekali tanpa tanggal" (= kemunculan jam itu berikutnya). */
export type FormAlarm = Omit<IsiAlarm, "pengulangan"> & { pengulangan: Pengulangan | { jenis: "sekali" } };

/** "05:00" -> "05.00" (id) atau "05:00" (en). */
export function jamLokal(jam: string, bahasa: "id" | "en"): string {
  return bahasa === "id" ? jam.replace(":", ".") : jam;
}

export function ringkasAlarm(a: AlarmKlien, bahasa: "id" | "en"): RingkasAlarm {
  return {
    id: a.id,
    jam: jamLokal(a.jam, bahasa),
    judul: a.agendaJudul,
    detail: a.agendaDetail ?? undefined,
    uraianUlang: a.uraianUlang,
    aktif: a.aktif,
    karakter: a.karakter,
    jumlahKanal: a.spam.kanal.length,
    tuya: a.tuya.length > 0,
    terkunciSampai: a.terkunciJam ?? undefined,
    suara: a.suara,
  };
}

/** Isi alarm untuk lembar ubah (tanpa isian server). */
export function formDari(a: AlarmKlien): FormAlarm {
  return {
    jam: a.jam,
    pengulangan: a.pengulangan,
    agendaJudul: a.agendaJudul,
    agendaDetail: a.agendaDetail,
    karakter: a.karakter,
    suaraId: a.suaraId,
    bunyi: a.bunyi,
    soal: a.soal,
    tunda: a.tunda,
    spam: a.spam,
    tuya: a.tuya,
    komitmen: a.komitmen,
    masihBangun: a.masihBangun,
    liburNasional: a.liburNasional,
    batasMenit: a.batasMenit,
    kalimatPribadi: a.kalimatPribadi,
    aktif: a.aktif,
  };
}

/** Isian yang berubah saja (PATCH), supaya pemeriksaan yang tidak perlu (mis. rumah pintar) tidak ikut. */
export function bedaForm(lama: FormAlarm, baru: FormAlarm): Partial<FormAlarm> {
  const hasil: Record<string, unknown> = {};
  for (const k of Object.keys(baru) as Array<keyof FormAlarm>) {
    if (JSON.stringify(lama[k]) !== JSON.stringify(baru[k])) hasil[k] = baru[k];
  }
  return hasil as Partial<FormAlarm>;
}

/** Alarm aktif yang paling dulu berbunyi. */
export function alarmPalingDulu(daftar: readonly AlarmKlien[]): AlarmKlien | null {
  let pilih: AlarmKlien | null = null;
  for (const a of daftar) {
    if (!a.aktif || !a.berikutnya) continue;
    if (!pilih || a.berikutnya.utc < pilih.berikutnya!.utc) pilih = a;
  }
  return pilih;
}

/** Template untuk lembar alarm baru (PRD B10): nama tampil + isi sebagian. */
export type TemplateKlien = { id: string; nama: string; keterangan: string | null; bawaan: boolean; isi: Partial<Record<string, unknown>> };

const BERSARANG = ["soal", "tunda", "spam", "masihBangun"] as const;

/**
 * Terapkan isi template ke form lembar alarm baru: isian bersarang (soal, tunda, spam, Masih
 * bangun) digabung, sisanya diganti. Sama dengan cara server merakit alarm dari template.
 */
export function terapkanTemplate(form: FormAlarm, isi: Partial<Record<string, unknown>>): FormAlarm {
  const hasil: Record<string, unknown> = { ...form };
  for (const [k, v] of Object.entries(isi)) {
    if (v === undefined) continue;
    hasil[k] = (BERSARANG as readonly string[]).includes(k) && v && typeof v === "object" ? { ...(form[k as (typeof BERSARANG)[number]] as object), ...(v as object) } : v;
  }
  return hasil as FormAlarm;
}
