import { z } from "zod";
import { isi } from "@/lib/i18n";
import {
  alarmBerikutnya,
  ambilAlarm,
  aturAktifAlarm,
  batalLewati,
  buatAlarm,
  daftarAlarm,
  gandakanAlarm,
  hapusAlarm,
  lewatiBerikutnya,
  lewatiTanggal,
  ubahAlarm,
  type AlarmLengkap,
} from "@/lib/layanan/alarm";
import { kejadianAktif, ujiAlarm } from "@/lib/layanan/kejadian";
import { alat, type KonteksAlat } from "../dasar";
import { dariAlarm, keMasukanAlarm, SkemaAlarmMcp } from "../peta";
import { jam, kapan, SkemaId, tautan } from "./umum";

// Alarm (docs/11-ALAT-MCP.md §2). Semua aturan (Komitmen, sedang berbunyi, batas, kode QR, rumah
// pintar) ditegakkan layanan yang sama dengan web; galatnya sampai ke agen sebagai error_code.
// Tidak ada alat untuk mematikan, menunda, atau menjawab alarm yang sedang berbunyi.

const jadwal = (k: KonteksAlat, a: AlarmLengkap) =>
  a.berikutnya ? isi(k.t.mcp.jadwal, { kapan: kapan(k, a.berikutnya.utc, a.zona), zona: isi(k.t.mcp.zona, { zona: a.zona }) }) : k.t.mcp.tidakTerjadwal;

function status(k: KonteksAlat, a: AlarmLengkap): string {
  if (a.berbunyi) return k.t.mcp.berbunyi;
  if (!a.aktif) return k.t.mcp.mati;
  const s = jadwal(k, a);
  return a.terkunciJam ? `${s}, ${isi(k.t.mcp.terkunci, { jam: a.terkunciJam })}` : s;
}

const satu = (k: KonteksAlat, a: AlarmLengkap) => isi(k.t.mcp.alarmSatu, { judul: a.agendaJudul, ulang: a.uraianUlang, status: status(k, a) });
const data = (k: KonteksAlat, a: AlarmLengkap) => dariAlarm(a, (d) => jam(k, d, a.zona));

const MasukanId = z.strictObject({ alarm_id: SkemaId.describe("Alarm id from list_alarms") });

const listAlarms = alat({
  nama: "list_alarms",
  judul: "List alarms",
  kelas: "baca",
  deskripsi:
    "List all of the user's alarms with time, repeat, agenda, challenge, snooze, spam channels, smart home rules, Commitment Mode lock, and the next ring time. Use alarm ids from here for other alarm tools.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const daftar = await daftarAlarm(k.penggunaId);
    return {
      data: { alarms: daftar.map((a) => data(k, a)) },
      teks: daftar.length ? isi(k.t.mcp.alarmDaftar, { n: daftar.length, isi: daftar.map((a) => satu(k, a)).join(" ") }) : k.t.mcp.alarmKosong,
    };
  },
});

const getAlarm = alat({
  nama: "get_alarm",
  judul: "Get one alarm",
  kelas: "baca",
  deskripsi: "Get every setting of one alarm, its next ring time, skipped dates, and whether Commitment Mode locks it right now.",
  masukan: MasukanId,
  async jalankan(k, m) {
    const a = await ambilAlarm(k.penggunaId, m.alarm_id);
    return { data: { alarm: data(k, a) }, teks: satu(k, a) };
  },
});

const getNextAlarm = alat({
  nama: "get_next_alarm",
  judul: "Next alarm",
  kelas: "baca",
  deskripsi: "The next alarm that will ring (date, time, time zone, agenda). Use when the user asks 'besok bangun jam berapa?'.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const a = await alarmBerikutnya(k.penggunaId);
    if (!a?.berikutnya) return { data: { alarm: null }, teks: k.t.mcp.tidakAdaBerikutnya };
    return {
      data: { alarm: data(k, a) },
      teks: isi(k.t.mcp.berikutnya, { judul: a.agendaJudul, kapan: kapan(k, a.berikutnya.utc, a.zona), zona: isi(k.t.mcp.zona, { zona: a.zona }) }),
    };
  },
});

const createAlarm = alat({
  nama: "create_alarm",
  judul: "Create an alarm",
  kelas: "tulis",
  idempoten: true,
  deskripsi:
    "Create an alarm from one sentence of the user. Only fill what the user said; everything else uses the user's defaults (or the template). time is the user's local 24-hour time; repeat.type once without date = the next time the clock shows it. Put the reason for waking up in agenda_title (and agenda_detail). Always repeat back the date, time and time zone from the result. Pass client_ref to make retries safe.",
  masukan: SkemaAlarmMcp.extend({ template: z.string().min(1).max(80).optional().describe("Template id from list_templates (built-in ids start with 'bawaan:')") }),
  async jalankan(k, m) {
    const { template, ...isiAlarm } = m;
    const a = await buatAlarm(k.penggunaId, keMasukanAlarm(isiAlarm), "agen", { template });
    return {
      data: { alarm: data(k, a) },
      teks: a.aktif ? isi(k.t.mcp.dibuat, { judul: a.agendaJudul, ulang: a.uraianUlang, jadwal: jadwal(k, a) }) : isi(k.t.mcp.dimatikan, { judul: a.agendaJudul }),
    };
  },
});

const updateAlarm = alat({
  nama: "update_alarm",
  judul: "Update an alarm",
  kelas: "tulis",
  deskripsi:
    "Change some settings of an alarm; settings not given stay the same (nested objects merge, smart_home replaces the whole list). Rejected with commitment_locked while Commitment Mode locks the alarm (between bedtime and ringing it may only get stricter or earlier), and with alarm_ringing while it rings.",
  masukan: SkemaAlarmMcp.extend({ alarm_id: SkemaId }),
  async jalankan(k, m) {
    const { alarm_id, ...isiAlarm } = m;
    const a = await ubahAlarm(k.penggunaId, alarm_id, keMasukanAlarm(isiAlarm), "agen");
    return { data: { alarm: data(k, a) }, teks: isi(k.t.mcp.diubah, { judul: a.agendaJudul, ulang: a.uraianUlang, jadwal: a.aktif ? jadwal(k, a) : k.t.mcp.mati }) };
  },
});

const deleteAlarm = alat({
  nama: "delete_alarm",
  judul: "Delete an alarm",
  kelas: "tulis",
  merusak: true,
  deskripsi:
    "Delete an alarm (its history stays). Only when the user clearly asks; confirm first, then call with confirm:true. Rejected while Commitment Mode locks it or while it rings.",
  masukan: MasukanId.extend({ confirm: z.literal(true) }),
  async jalankan(k, m) {
    const a = await ambilAlarm(k.penggunaId, m.alarm_id);
    await hapusAlarm(k.penggunaId, m.alarm_id, "agen");
    return { data: { deleted: true, alarm_id: m.alarm_id }, teks: isi(k.t.mcp.dihapus, { judul: a.agendaJudul }) };
  },
});

const setAlarmEnabled = alat({
  nama: "set_alarm_enabled",
  judul: "Turn an alarm on or off",
  kelas: "tulis",
  deskripsi:
    "Turn an alarm on or off without deleting it. Turning off is rejected while Commitment Mode locks it. A one-time alarm whose date passed is moved to the next time its clock time comes.",
  masukan: MasukanId.extend({ enabled: z.boolean() }),
  async jalankan(k, m) {
    const a = await aturAktifAlarm(k.penggunaId, m.alarm_id, m.enabled, "agen");
    return {
      data: { alarm: data(k, a) },
      teks: a.aktif ? isi(k.t.mcp.dinyalakan, { judul: a.agendaJudul, jadwal: jadwal(k, a) }) : isi(k.t.mcp.dimatikan, { judul: a.agendaJudul }),
    };
  },
});

const skipNextAlarm = alat({
  nama: "skip_next_alarm",
  judul: "Skip the next ring",
  kelas: "tulis",
  deskripsi: "Skip only the next ring of a repeating alarm (e.g. a day off). Rejected while Commitment Mode locks it.",
  masukan: MasukanId,
  async jalankan(k, m) {
    const lama = await ambilAlarm(k.penggunaId, m.alarm_id);
    const a = await lewatiBerikutnya(k.penggunaId, m.alarm_id, "agen");
    return { data: { alarm: data(k, a) }, teks: isi(k.t.mcp.dilewati, { judul: a.agendaJudul, tanggal: lama.berikutnya?.tanggal ?? "", jadwal: jadwal(k, a) }) };
  },
});

const skipAlarmDate = alat({
  nama: "skip_alarm_date",
  judul: "Skip a date",
  kelas: "tulis",
  deskripsi: "Skip a repeating alarm on one local date (YYYY-MM-DD), e.g. a holiday or leave. Rejected while Commitment Mode locks that ring.",
  masukan: MasukanId.extend({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  async jalankan(k, m) {
    const a = await lewatiTanggal(k.penggunaId, m.alarm_id, m.date, "agen");
    return { data: { alarm: data(k, a) }, teks: isi(k.t.mcp.dilewati, { judul: a.agendaJudul, tanggal: m.date, jadwal: jadwal(k, a) }) };
  },
});

const unskipAlarm = alat({
  nama: "unskip_alarm",
  judul: "Undo a skipped date",
  kelas: "tulis",
  deskripsi: "Make an alarm ring again on a date that was skipped.",
  masukan: MasukanId.extend({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  async jalankan(k, m) {
    const a = await batalLewati(k.penggunaId, m.alarm_id, m.date, "agen");
    return { data: { alarm: data(k, a) }, teks: isi(k.t.mcp.batalLewati, { judul: a.agendaJudul, tanggal: m.date, jadwal: jadwal(k, a) }) };
  },
});

const duplicateAlarm = alat({
  nama: "duplicate_alarm",
  judul: "Duplicate an alarm",
  kelas: "tulis",
  idempoten: true,
  deskripsi: "Copy an alarm. The copy is OFF and without Commitment Mode so two alarms never ring together by accident; change its time with update_alarm, then turn it on.",
  masukan: MasukanId,
  async jalankan(k, m) {
    const a = await gandakanAlarm(k.penggunaId, m.alarm_id, "agen");
    return { data: { alarm: data(k, a) }, teks: isi(k.t.mcp.digandakan, { judul: a.agendaJudul }) };
  },
});

const setCustomLines = alat({
  nama: "set_custom_lines",
  judul: "Personal scolding lines",
  kelas: "tulis",
  deskripsi:
    "Replace the personal scolding lines of one alarm (max 10, max 150 letters each). Fierce is fine; slurs are rejected by the filter. The user's AgentBuff then remakes the voice. Same Commitment rules as update_alarm.",
  masukan: MasukanId.extend({ lines: z.array(z.string().min(1).max(150)).max(10) }),
  async jalankan(k, m) {
    const a = await ubahAlarm(k.penggunaId, m.alarm_id, { kalimatPribadi: m.lines }, "agen");
    return { data: { alarm: data(k, a) }, teks: isi(k.t.mcp.kalimatDisimpan, { judul: a.agendaJudul, n: m.lines.length }) };
  },
});

const testAlarm = alat({
  nama: "test_alarm",
  judul: "Test alarm in 1 minute",
  kelas: "tulis",
  idempoten: true,
  deskripsi:
    "Ring a short test alarm 1 minute from now on the user's standby devices and open AntiKebo screens, using one alarm's settings (or the user's defaults). Spam channels and smart home only join when asked. Calling again while a test is pending returns the same test. The user stops it only by solving the challenge on the alarm screen.",
  masukan: z.strictObject({
    alarm_id: SkemaId.optional(),
    include_spam: z.boolean().optional().describe("Also send the spam messages (default false)"),
    include_smart_home: z.boolean().optional().describe("Also run smart home rules (default false)"),
  }),
  async jalankan(k, m) {
    const u = await ujiAlarm(k.penggunaId, { ...(m.alarm_id ? { alarmId: m.alarm_id } : {}), spam: !!m.include_spam, tuya: !!m.include_smart_home }, "agen");
    return {
      data: { test_event_id: u.kejadianId, rings_at: u.jadwalUtc.toISOString(), alarm_screen_url: tautan.alarm(k) },
      teks: isi(k.t.mcp.uji, { jam: jam(k, u.jadwalUtc), zona: isi(k.t.mcp.zona, { zona: k.zona }), tautan: tautan.alarm(k) }),
    };
  },
});

const getActiveAlarm = alat({
  nama: "get_active_alarm",
  judul: "Ringing alarm status",
  kelas: "baca",
  deskripsi:
    "Status ONLY: whether an alarm is ringing, snoozed, or waiting for 'Still awake?', plus the alarm screen link. There is no tool to stop, snooze, or answer it, and you must never claim it was turned off: give the user the link.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const daftar = await kejadianAktif(k.penggunaId);
    if (!daftar.length) return { data: { active: [] }, teks: k.t.mcp.aktifKosong };
    const M = k.t.mcp;
    const st = (x: (typeof daftar)[number]) =>
      x.status === "ditunda" && x.tundaSampai ? isi(M.statusDitunda, { jam: jam(k, x.tundaSampai) }) : x.status === "cek_bangun" ? M.statusCek : M.statusBerbunyi;
    return {
      data: {
        active: daftar.map((x) => ({
          event_id: x.id,
          alarm_id: x.alarmId,
          title: x.judul,
          status: x.status === "ditunda" ? "snoozed" : x.status === "cek_bangun" ? "still_awake_check" : "ringing",
          snoozed_until: x.tundaSampai?.toISOString() ?? null,
          test: x.uji,
          alarm_screen_url: tautan.alarm(k, x.id),
        })),
      },
      teks: daftar.map((x) => isi(M.aktif, { judul: x.judul, status: st(x), tautan: tautan.alarm(k, x.id) })).join(" "),
    };
  },
});

export const ALAT_ALARM = [
  listAlarms,
  getAlarm,
  getNextAlarm,
  createAlarm,
  updateAlarm,
  deleteAlarm,
  setAlarmEnabled,
  skipNextAlarm,
  skipAlarmDate,
  unskipAlarm,
  duplicateAlarm,
  setCustomLines,
  testAlarm,
  getActiveAlarm,
];
