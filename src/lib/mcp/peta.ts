import { z } from "zod";
import { BUNYI, KARAKTER, type AturanTuya, type MasukanAlarm } from "@/lib/alarm/isi";
import type { Pengulangan } from "@/lib/jadwal/pengulangan";
import type { AlarmLengkap } from "@/lib/layanan/alarm";

/**
 * Peta masukan dan keluaran alat MCP (docs/11-ALAT-MCP.md): nama isian bahasa Inggris snake_case
 * untuk agen, isian internal bahasa Indonesia untuk layanan. MURNI (tanpa DB). Layanan tetap
 * memeriksa ulang semuanya (Komitmen, batas, kode QR, rumah pintar); peta ini hanya menerjemahkan.
 */

// ------------------------------------------------------------------ kamus nilai

const HARI = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const KE = { first: 1, second: 2, third: 3, fourth: 4, last: -1 } as const;
const JENIS_SOAL = { math: "hitungan", memory: "ingat", typing: "ketik", qr: "qr", math_and_qr: "gabungan" } as const;
const TINGKAT = { easy: "ringan", medium: "sedang", hard: "berat" } as const;
const KAPAN = { before: "sebelum", with_alarm: "bareng", on_snooze: "tunda", after_wake: "sesudah" } as const;
const MODE_AC = { cool: "dingin", heat: "panas", fan: "kipas", dry: "kering", auto: "otomatis" } as const;
const SESUDAH = { restore: "kembalikan", morning_mood: "suasana_pagi", leave: "biarkan" } as const;

const balik = <T extends Record<string, string | number>>(o: T) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k])) as Record<T[keyof T], keyof T>;

// ------------------------------------------------------------------ skema masukan

const Tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const Hari = z.enum(HARI);
const DaftarHari = z.array(Hari).min(1).max(7);

export const SkemaUlangMcp = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("once"),
    date: Tanggal.optional().describe("Local date. Omit = the next time the clock shows this time (today if still ahead, else tomorrow)."),
  }),
  z.strictObject({ type: z.literal("daily") }),
  z.strictObject({ type: z.literal("weekdays").describe("Monday to Friday") }),
  z.strictObject({ type: z.literal("weekends").describe("Saturday and Sunday") }),
  z.strictObject({ type: z.literal("days"), days: DaftarHari }),
  z.strictObject({
    type: z.literal("every_n_weeks"),
    every: z.int().min(2).max(12),
    days: DaftarHari,
    start_date: Tanggal.describe("Any date in the first week"),
  }),
  z.strictObject({ type: z.literal("monthly_date"), day: z.int().min(1).max(31).describe("Day of month; short months use their last day") }),
  z.strictObject({ type: z.literal("monthly_weekday"), nth: z.enum(["first", "second", "third", "fourth", "last"]), weekday: Hari }),
]);
export type UlangMcp = z.infer<typeof SkemaUlangMcp>;

const SkemaAksiRumah = z.strictObject({
  power: z.boolean().optional(),
  brightness: z.int().min(1).max(100).optional().describe("Percent"),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional()
    .describe("Hex color, e.g. #ff8800"),
  white_temperature: z.int().min(0).max(100).optional().describe("0 = warmest .. 100 = coolest"),
  ac_temperature: z.int().min(16).max(30).optional(),
  ac_mode: z.enum(["cool", "heat", "fan", "dry", "auto"]).optional(),
});

export const SkemaAturanRumahMcp = z.strictObject({
  device_id: z.string().min(1).max(64).describe("From list_home_devices"),
  when: z.enum(["before", "with_alarm", "on_snooze", "after_wake"]),
  minutes_before: z.int().min(1).max(60).nullable().optional().describe("For when=before: start X minutes early, brightening step by step"),
  action: SkemaAksiRumah,
  flash: z.boolean().optional().describe("Blink the light while ringing"),
  after_wake: z.enum(["restore", "morning_mood", "leave"]).optional().describe("What happens to the device after the challenge is solved"),
});

/** Isian alarm agen. Semua opsional: yang kosong memakai template, lalu bawaan pengguna. */
export const SkemaAlarmMcp = z.strictObject({
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM")
    .optional()
    .describe("24-hour local time in the user's zone, e.g. 05:30"),
  repeat: SkemaUlangMcp.optional(),
  agenda_title: z.string().min(1).max(60).optional().describe("Why the user wakes up, e.g. 'Kuliah pagi' (spoken in the scolding). Default 'Bangun'."),
  agenda_detail: z.string().max(200).nullable().optional(),
  character: z.enum(KARAKTER).optional().describe("Scolding character id from list_characters"),
  voice_id: z.string().min(1).max(100).nullable().optional().describe("Voice id from list_voices; null = AgentBuff default voice"),
  sound: z.enum(BUNYI).optional().describe("Alarm sound id"),
  challenge: z
    .strictObject({
      type: z.enum(["math", "memory", "typing", "qr", "math_and_qr"]).optional(),
      level: z.enum(["easy", "medium", "hard"]).optional(),
      correct_in_a_row: z.int().min(1).max(5).optional(),
      qr_code_ids: z.array(z.uuid()).max(5).optional().describe("Wake code ids (list_wake_codes) for qr and math_and_qr"),
    })
    .optional()
    .describe("Challenge that stops the alarm (only on the alarm screen)"),
  snooze: z.strictObject({ count: z.int().min(0).max(5).optional(), minutes: z.union([z.literal(5), z.literal(10), z.literal(15)]).optional() }).optional(),
  spam: z
    .strictObject({
      channel_ids: z.array(z.string().min(1).max(100)).max(10).optional().describe("Channel ids from list_channels"),
      interval_seconds: z.int().min(5).max(600).nullable().optional().describe("null = platform default"),
      stop_after_minutes: z.int().min(1).max(240).nullable().optional().describe("null = until the user wakes"),
    })
    .optional(),
  smart_home: z.array(SkemaAturanRumahMcp).max(20).optional().describe("Replaces all smart home rules of the alarm"),
  commitment: z.boolean().optional().describe("Commitment Mode: from bedtime until it rings, the alarm cannot be weakened, skipped, or deleted"),
  still_awake_check: z
    .strictObject({
      enabled: z.boolean().optional(),
      after_minutes: z.int().min(3).max(15).optional(),
      answer_within_seconds: z.int().min(60).max(180).optional(),
    })
    .optional(),
  skip_holidays: z.boolean().optional().describe("Stay silent on Indonesian national holidays"),
  auto_stop_minutes: z.int().min(5).max(240).nullable().optional().describe("Give up after X minutes and record 'did not wake'; null = never"),
  custom_lines: z.array(z.string().min(1).max(150)).max(10).optional().describe("Personal scolding lines (filtered for slurs)"),
  enabled: z.boolean().optional(),
});
export type AlarmMcp = z.infer<typeof SkemaAlarmMcp>;

// ------------------------------------------------------------------ masukan -> internal

export function keUlang(u: UlangMcp): MasukanAlarm["pengulangan"] {
  const h = (d: readonly (typeof HARI)[number][]) => d.map((x) => HARI.indexOf(x));
  switch (u.type) {
    case "once":
      return u.date ? { jenis: "sekali", tanggal: u.date } : { jenis: "sekali" };
    case "daily":
      return { jenis: "harian" };
    case "weekdays":
      return { jenis: "hari_kerja" };
    case "weekends":
      return { jenis: "akhir_pekan" };
    case "days":
      return { jenis: "hari", hari: h(u.days) };
    case "every_n_weeks":
      return { jenis: "tiap_minggu", setiap: u.every, hari: h(u.days), mulai: u.start_date };
    case "monthly_date":
      return { jenis: "bulanan_tanggal", tanggal: u.day };
    case "monthly_weekday":
      return { jenis: "bulanan_hari_ke", ke: KE[u.nth], hari: HARI.indexOf(u.weekday) };
  }
}

function keAturan(r: z.infer<typeof SkemaAturanRumahMcp>): AturanTuya {
  const a = r.action;
  const aksi: AturanTuya["aksi"] = {};
  if (a.power !== undefined) aksi.nyala = a.power;
  if (a.brightness !== undefined) aksi.terang = a.brightness;
  if (a.color !== undefined) aksi.warna = a.color;
  if (a.white_temperature !== undefined) aksi.suhuPutih = a.white_temperature;
  if (a.ac_temperature !== undefined) aksi.suhuAc = a.ac_temperature;
  if (a.ac_mode !== undefined) aksi.modeAc = MODE_AC[a.ac_mode];
  return {
    perangkatId: r.device_id,
    kapan: KAPAN[r.when],
    menitSebelum: r.when === "before" ? (r.minutes_before ?? 10) : null,
    aksi,
    kedip: r.flash ?? false,
    sesudahBangun: SESUDAH[r.after_wake ?? "restore"],
  };
}

const tanpaKosong = <T extends Record<string, unknown>>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Isian agen -> masukan layanan alarm (sebagian; yang tidak disebut tidak dikirim). */
export function keMasukanAlarm(m: AlarmMcp): MasukanAlarm {
  return tanpaKosong({
    jam: m.time,
    pengulangan: m.repeat ? keUlang(m.repeat) : undefined,
    agendaJudul: m.agenda_title,
    agendaDetail: m.agenda_detail,
    karakter: m.character,
    suaraId: m.voice_id,
    bunyi: m.sound,
    soal: m.challenge
      ? tanpaKosong({
          jenis: m.challenge.type ? JENIS_SOAL[m.challenge.type] : undefined,
          tingkat: m.challenge.level ? TINGKAT[m.challenge.level] : undefined,
          benar: m.challenge.correct_in_a_row,
          kodeQr: m.challenge.qr_code_ids,
        })
      : undefined,
    tunda: m.snooze ? tanpaKosong({ jatah: m.snooze.count, menit: m.snooze.minutes }) : undefined,
    spam: m.spam ? tanpaKosong({ kanal: m.spam.channel_ids, jedaDtk: m.spam.interval_seconds, batasMenit: m.spam.stop_after_minutes }) : undefined,
    tuya: m.smart_home?.map(keAturan),
    komitmen: m.commitment,
    masihBangun: m.still_awake_check
      ? tanpaKosong({ aktif: m.still_awake_check.enabled, menit: m.still_awake_check.after_minutes, batasDtk: m.still_awake_check.answer_within_seconds })
      : undefined,
    liburNasional: m.skip_holidays,
    batasMenit: m.auto_stop_minutes,
    kalimatPribadi: m.custom_lines,
    aktif: m.enabled,
  }) as MasukanAlarm;
}

// ------------------------------------------------------------------ internal -> keluaran

const NAMA_SOAL = balik(JENIS_SOAL);
const NAMA_TINGKAT = balik(TINGKAT);
const NAMA_KAPAN = balik(KAPAN);
const NAMA_MODE = balik(MODE_AC);
const NAMA_SESUDAH = balik(SESUDAH);
const NAMA_KE = balik(KE);

export function dariUlang(p: Pengulangan): UlangMcp {
  const h = (d: readonly number[]) => d.map((x) => HARI[x]);
  switch (p.jenis) {
    case "sekali":
      return { type: "once", date: p.tanggal };
    case "harian":
      return { type: "daily" };
    case "hari_kerja":
      return { type: "weekdays" };
    case "akhir_pekan":
      return { type: "weekends" };
    case "hari":
      return { type: "days", days: h(p.hari) };
    case "tiap_minggu":
      return { type: "every_n_weeks", every: p.setiap, days: h(p.hari), start_date: p.mulai };
    case "bulanan_tanggal":
      return { type: "monthly_date", day: p.tanggal };
    case "bulanan_hari_ke":
      return { type: "monthly_weekday", nth: NAMA_KE[p.ke], weekday: HARI[p.hari] };
  }
}

/** Isi alarm (tanpa jam dan status) dalam nama isian agen. Dipakai alarm dan template. */
export function dariIsi(i: MasukanAlarm) {
  const p = i.pengulangan;
  return tanpaKosong({
    time: i.jam,
    repeat: !p ? undefined : p.jenis === "sekali" && !("tanggal" in p) ? ({ type: "once" } as UlangMcp) : dariUlang(p as Pengulangan),
    agenda_title: i.agendaJudul,
    agenda_detail: i.agendaDetail,
    character: i.karakter,
    voice_id: i.suaraId,
    sound: i.bunyi,
    challenge: i.soal
      ? tanpaKosong({
          type: i.soal.jenis ? NAMA_SOAL[i.soal.jenis] : undefined,
          level: i.soal.tingkat ? NAMA_TINGKAT[i.soal.tingkat] : undefined,
          correct_in_a_row: i.soal.benar,
          qr_code_ids: i.soal.kodeQr,
        })
      : undefined,
    snooze: i.tunda ? tanpaKosong({ count: i.tunda.jatah, minutes: i.tunda.menit }) : undefined,
    spam: i.spam ? tanpaKosong({ channel_ids: i.spam.kanal, interval_seconds: i.spam.jedaDtk, stop_after_minutes: i.spam.batasMenit }) : undefined,
    smart_home: i.tuya?.map((r) => ({
      device_id: r.perangkatId,
      when: NAMA_KAPAN[r.kapan],
      minutes_before: r.menitSebelum,
      action: tanpaKosong({
        power: r.aksi.nyala,
        brightness: r.aksi.terang,
        color: r.aksi.warna,
        white_temperature: r.aksi.suhuPutih,
        ac_temperature: r.aksi.suhuAc,
        ac_mode: r.aksi.modeAc ? NAMA_MODE[r.aksi.modeAc] : undefined,
      }),
      flash: r.kedip,
      after_wake: NAMA_SESUDAH[r.sesudahBangun],
    })),
    commitment: i.komitmen,
    still_awake_check: i.masihBangun ? tanpaKosong({ enabled: i.masihBangun.aktif, after_minutes: i.masihBangun.menit, answer_within_seconds: i.masihBangun.batasDtk }) : undefined,
    skip_holidays: i.liburNasional,
    auto_stop_minutes: i.batasMenit,
    custom_lines: i.kalimatPribadi,
    enabled: i.aktif,
  });
}

/** Satu alarm untuk agen: isi + jadwal berikutnya + keadaan (terkunci, berbunyi, suara). */
export function dariAlarm(a: AlarmLengkap, jamTampil: (d: Date) => string) {
  return {
    id: a.id,
    ...dariIsi(a),
    repeat_text: a.uraianUlang,
    time_zone: a.zona,
    next: a.berikutnya ? { date: a.berikutnya.tanggal, at: a.berikutnya.utc.toISOString(), local_time: jamTampil(a.berikutnya.utc) } : null,
    skipped_dates: a.lewati,
    commitment_locked_until: a.terkunciSampai ? a.terkunciSampai.toISOString() : null,
    ringing: a.berbunyi,
    voice_status: a.suara.status,
  };
}
