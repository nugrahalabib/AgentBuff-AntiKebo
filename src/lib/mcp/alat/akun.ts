import { eq } from "drizzle-orm";
import { z } from "zod";
import { cekHak } from "@/lib/agentbuff/status";
import { tautanPerpanjang } from "@/lib/agentbuff/tautan-beku";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { isi } from "@/lib/i18n";
import { alarmBerikutnyaUtc, daftarAlarm } from "@/lib/layanan/alarm";
import { daftarKanalPengguna, ujiKanal, ujiPush } from "@/lib/layanan/kanal";
import { cabutPerangkat, daftarPerangkat, ubahNamaPerangkat, type PerangkatTampil } from "@/lib/layanan/perangkat";
import { ambilPreferensi, ubahPreferensi, type Preferensi } from "@/lib/layanan/preferensi";
import { statusRumah } from "@/lib/layanan/tuya";
import { siapMalamIni } from "@/lib/tampilan/siap";
import { waktuRelatif } from "@/lib/tampilan/uraian";
import { alat, type KonteksAlat } from "../dasar";
import { dariIsi, keMasukanAlarm, SkemaAlarmMcp } from "../peta";
import { langkahKunci } from "./rumah";
import { SkemaId, tautan } from "./umum";

// Ringkasan akun, pengaturan (PRD M), kanal + notifikasi (PRD G), perangkat siaga (PRD H).

// ------------------------------------------------------------------ ringkasan

const getSetupStatus = alat({
  nama: "get_setup_status",
  judul: "Setup status",
  kelas: "baca",
  deskripsi:
    "Check the user's AntiKebo account: access, the two AgentBuff permissions (send wake-up messages through the user's agent channels; make scolding voice clips with the user's voice settings), standby devices ready tonight, the next alarm, spam channels, smart home, and voice problems, each with a fix link. Call this FIRST when unsure, and remind the user when no device is ready tonight.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const [p] = await db().select().from(schema.pengguna).where(eq(schema.pengguna.id, k.penggunaId)).limit(1);
    const hak = await cekHak({ id: k.penggunaId, agentbuffSub: k.agentbuffSub });
    const perpanjang = hak.aktif ? null : tautanPerpanjang(hak.alasan, env("AGENTBUFF_ORIGIN"), env("AGENTBUFF_PRODUCT_KEY"));
    const izin = { send_messages: !!p?.izinKabar, make_voice: !!p?.izinSuara };
    const M = k.t.mcp;
    const kurang = [!izin.send_messages ? M.izinKabar : null, !izin.make_voice ? M.izinSuara : null].filter((x): x is string => !!x);
    const [alarm, perangkat, rumah] = await Promise.all([daftarAlarm(k.penggunaId), daftarPerangkat(k.penggunaId), statusRumah(k.penggunaId)]);
    const berikutnya = alarmBerikutnyaUtc(alarm);
    const siap = perangkat.filter((x) => siapMalamIni(x, berikutnya));
    const suaraBermasalah = alarm.filter((a) => a.aktif && a.suara.status === "belum");
    const kanal = izin.send_messages ? await daftarKanalPengguna(k.penggunaId).catch(() => null) : null;

    const baris = [
      hak.aktif ? M.aksesAktif : M.aksesBeku,
      kurang.length ? isi(M.izinKurang, { isi: kurang.join(M.dan), tautan: tautan.izin(k) }) : M.izinLengkap,
      siap.length
        ? isi(M.perangkatSiapMalam, { n: siap.length, isi: siap.map((x) => x.nama).join(", ") })
        : `${M.perangkatTidakSiap} ${isi(M.tautanPerangkat, { pc: tautan.unduhPc(k), jamMeja: tautan.jamMeja(k) })}`,
    ];
    if (suaraBermasalah.length) baris.push(isi(M.suaraBermasalah, { isi: suaraBermasalah.map((a) => a.agendaJudul).join(", ") }));
    baris.push(
      !rumah.tersambung
        ? `${M.rumahOpsional} ${langkahKunci(k)}`
        : rumah.bermasalah
          ? `${M.rumahBermasalah} ${langkahKunci(k)}`
          : isi(M.rumahStatus, { wilayah: rumah.wilayah.nama, n: rumah.perangkat }),
    );
    return {
      data: {
        access: hak.aktif ? "active" : "frozen",
        ...(hak.aktif ? {} : { reason: hak.alasan, renew_url: perpanjang?.startsWith("/") ? `${k.asal}${perpanjang}` : perpanjang }),
        permissions: izin,
        ...(kurang.length ? { grant_permissions_url: tautan.izin(k) } : {}),
        next_alarm_at: berikutnya?.toISOString() ?? null,
        standby_devices: { total: perangkat.length, ready_tonight: siap.length, setup_links: { pc: tautan.unduhPc(k), desk_clock: tautan.jamMeja(k) } },
        channels: kanal ? { total: kanal.kanal.length, ready: kanal.kanal.filter((x) => x.siap).length } : null,
        voice_problems: suaraBermasalah.map((a) => ({ alarm_id: a.id, title: a.agendaJudul, reason: a.suara.status === "belum" ? a.suara.alasan : null })),
        smart_home: !rumah.tersambung
          ? { connected: false, connect_url: tautan.rumah(k) }
          : { connected: !rumah.bermasalah, key_problem: rumah.bermasalah, region: rumah.wilayah.nama, devices: rumah.perangkat },
        app_url: tautan.app(k),
      },
      teks: baris.join(" "),
    };
  },
});

// ------------------------------------------------------------------ pengaturan

const SkemaBawaanMcp = SkemaAlarmMcp.pick({
  character: true,
  voice_id: true,
  sound: true,
  challenge: true,
  snooze: true,
  spam: true,
  commitment: true,
  still_awake_check: true,
  skip_holidays: true,
  auto_stop_minutes: true,
});

function prefUntukAgen(p: Preferensi) {
  return {
    nickname: p.namaPanggilan,
    agentbuff_name: p.nama,
    time_zone: p.zonaWaktu,
    language: p.bahasa,
    bedtime: p.jamTidur,
    theme: p.tema === "terang" ? "light" : p.tema === "gelap" ? "dark" : "system",
    night_reminder: p.pengingatMalam,
    new_alarm_defaults: dariIsi(p.bawaan),
  };
}

const teksPref = (k: KonteksAlat, p: Preferensi) =>
  isi(k.t.mcp.preferensi, {
    nama: p.namaPanggilan ?? p.nama ?? "-",
    zona: p.zonaWaktu,
    bahasa: k.t.pengaturanLengkap.bahasaPilihan[p.bahasa],
    tidur: p.jamTidur,
    pengingat: p.pengingatMalam ? k.t.mcp.nyala : k.t.mcp.mati,
  });

const getPreferences = alat({
  nama: "get_preferences",
  judul: "User settings",
  kelas: "baca",
  deskripsi: "Nickname, time zone, language, bedtime (start of Commitment Mode lock and night reminder), theme, night reminder, and the defaults used for new alarms.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const p = await ambilPreferensi(k.penggunaId);
    return { data: { preferences: prefUntukAgen(p) }, teks: teksPref(k, p) };
  },
});

const updatePreferences = alat({
  nama: "update_preferences",
  judul: "Change user settings",
  kelas: "tulis",
  deskripsi:
    "Change settings; only given fields change. new_alarm_defaults merge into the current defaults (spam.channel_ids = default spam channels, also used by the night reminder). Bedtime and time zone changes that would unlock an active Commitment Mode are rejected (commitment_locked). Changing time zone keeps each alarm's clock time.",
  masukan: z.strictObject({
    nickname: z.string().min(1).max(30).nullable().optional().describe("Name used in the scolding; null = name from AgentBuff"),
    time_zone: z.string().min(1).max(64).optional().describe("IANA zone, e.g. Asia/Jakarta, Asia/Makassar, Asia/Jayapura"),
    language: z.enum(["id", "en"]).optional(),
    bedtime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    theme: z.enum(["system", "light", "dark"]).optional(),
    night_reminder: z.boolean().optional(),
    new_alarm_defaults: SkemaBawaanMcp.optional(),
  }),
  async jalankan(k, m) {
    let bawaan: Record<string, unknown> | undefined;
    if (m.new_alarm_defaults) {
      // Bawaan disimpan utuh per isian: isian bersarang digabung ke bawaan sekarang.
      const lama = (await ambilPreferensi(k.penggunaId)).bawaan as Record<string, unknown>;
      const baru = keMasukanAlarm(m.new_alarm_defaults) as Record<string, unknown>;
      bawaan = Object.fromEntries(
        Object.entries(baru).map(([kunci, v]) => [kunci, v && typeof v === "object" && !Array.isArray(v) ? { ...(lama[kunci] as object), ...(v as object) } : v]),
      );
    }
    const p = await ubahPreferensi(
      k.penggunaId,
      {
        ...(m.nickname !== undefined ? { namaPanggilan: m.nickname } : {}),
        ...(m.time_zone ? { zonaWaktu: m.time_zone } : {}),
        ...(m.language ? { bahasa: m.language } : {}),
        ...(m.bedtime ? { jamTidur: m.bedtime } : {}),
        ...(m.theme ? { tema: m.theme === "light" ? "terang" : m.theme === "dark" ? "gelap" : "sistem" } : {}),
        ...(m.night_reminder !== undefined ? { pengingatMalam: m.night_reminder } : {}),
        ...(bawaan ? { bawaan } : {}),
      },
      "agen",
    );
    return { data: { preferences: prefUntukAgen(p) }, teks: `${k.t.mcp.preferensiDisimpan} ${teksPref(k, p)}` };
  },
});

// ------------------------------------------------------------------ kanal dan notifikasi

const listChannels = alat({
  nama: "list_channels",
  judul: "Spam channels",
  kelas: "baca",
  deskripsi:
    "Chat channels connected to the user's AgentBuff agent (Telegram, WhatsApp, Discord, ...). The agent spams the chosen channels while an alarm rings until the user wakes. 'ready' channels can be used; defaults come from new_alarm_defaults.spam.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const [d, p] = await Promise.all([daftarKanalPengguna(k.penggunaId), ambilPreferensi(k.penggunaId)]);
    const M = k.t.mcp;
    const bawaan = new Set(p.bawaan.spam.kanal);
    return {
      data: {
        channels: d.kanal.map((x) => ({ id: x.id, platform: x.platform, label: x.label, agent: x.agen, ready: x.siap, reason: x.alasan ?? null, default: bawaan.has(x.id) })),
      },
      teks: d.kanal.length
        ? isi(M.kanalDaftar, {
            n: d.kanal.length,
            isi: d.kanal
              .map((x) => `${x.label} (${x.siap ? M.kanalSiap : isi(M.kanalBelum, { alasan: x.alasan ?? "-" })}${bawaan.has(x.id) ? `, ${M.kanalBawaan}` : ""})`)
              .join("; "),
          })
        : M.kanalKosong,
    };
  },
});

const testChannel = alat({
  nama: "test_channel",
  judul: "Send a test message",
  kelas: "tulis",
  deskripsi: "Send one test wake-up message to a channel through the user's agent, to check it arrives.",
  masukan: z.strictObject({ channel_id: z.string().min(1).max(100).describe("From list_channels") }),
  async jalankan(k, m) {
    const r = await ujiKanal(k.penggunaId, { kanal: m.channel_id }, "agen");
    return { data: { sent: true }, teks: r.pesan };
  },
});

const testNotification = alat({
  nama: "test_notification",
  judul: "Send a test notification",
  kelas: "tulis",
  deskripsi: "Send a test alarm notification to every browser where the user turned on AntiKebo notifications (turning them on can only be done in that browser).",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const r = await ujiPush(k.penggunaId);
    return { data: { delivered: r.terkirim, failed: r.gagal }, teks: isi(k.t.mcp.notifikasiUji, { pesan: r.pesan }) };
  },
});

// ------------------------------------------------------------------ perangkat siaga

function perangkatUntukAgen(k: KonteksAlat, x: PerangkatTampil, berikutnya: Date | null) {
  return {
    id: x.id,
    name: x.nama,
    type: x.jenis === "pc" ? "pc" : "desk_clock",
    online: x.siaga,
    ready_tonight: siapMalamIni(x, berikutnya),
    last_seen: x.terakhirTerlihat?.toISOString() ?? null,
    charging: x.kemampuan.dicas ?? null,
    battery: x.kemampuan.baterai ?? null,
    app_version: x.versi,
  };
}

const listStandbyDevices = alat({
  nama: "list_standby_devices",
  judul: "Standby devices",
  kelas: "baca",
  deskripsi:
    "Devices that ring the alarm locally (AntiKebo for PC, phones/tablets in desk clock mode): online, ready tonight (voice for the next alarm stored), charging, battery, last seen.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const [d, alarm] = await Promise.all([daftarPerangkat(k.penggunaId), daftarAlarm(k.penggunaId)]);
    const berikutnya = alarmBerikutnyaUtc(alarm);
    const M = k.t.mcp;
    const sekarang = Date.now();
    return {
      data: { devices: d.map((x) => perangkatUntukAgen(k, x, berikutnya)), setup_links: { pc: tautan.unduhPc(k), desk_clock: tautan.jamMeja(k) } },
      teks: d.length
        ? isi(M.perangkatDaftar, {
            n: d.length,
            isi: d
              .map(
                (x) =>
                  `${x.nama} (${siapMalamIni(x, berikutnya) ? M.perangkatSiap : M.perangkatBelum}, ${isi(M.perangkatTerlihat, { waktu: waktuRelatif(x.terakhirTerlihat, sekarang, k.t) })})`,
              )
              .join("; "),
          })
        : `${M.perangkatKosong} ${isi(M.tautanPerangkat, { pc: tautan.unduhPc(k), jamMeja: tautan.jamMeja(k) })}`,
    };
  },
});

const getDeviceSetupLinks = alat({
  nama: "get_device_setup_links",
  judul: "Device setup links",
  kelas: "baca",
  deskripsi:
    "Links for things that must be done on the device itself: install AntiKebo for PC (Windows), turn a phone or tablet into a desk clock, turn on browser notifications (in Settings on that browser). Give these to the user; you cannot do them remotely.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    return {
      data: { pc_download: tautan.unduhPc(k), desk_clock: tautan.jamMeja(k), notifications: tautan.pengaturan(k), standby_tab: tautan.siaga(k) },
      teks: isi(k.t.mcp.tautanPerangkat, { pc: tautan.unduhPc(k), jamMeja: tautan.jamMeja(k) }),
    };
  },
});

const renameStandbyDevice = alat({
  nama: "rename_standby_device",
  judul: "Rename a standby device",
  kelas: "tulis",
  deskripsi: "Rename a standby device (max 40 letters).",
  masukan: z.strictObject({ device_id: SkemaId, name: z.string().min(1).max(40) }),
  async jalankan(k, m) {
    const p = await ubahNamaPerangkat(k.penggunaId, m.device_id, m.name, "agen");
    return { data: { device: { id: p.id, name: p.nama } }, teks: isi(k.t.mcp.perangkatDiubah, { nama: p.nama }) };
  },
});

const removeStandbyDevice = alat({
  nama: "remove_standby_device",
  judul: "Disconnect a standby device",
  kelas: "tulis",
  merusak: true,
  deskripsi: "Disconnect a standby device: it stops ringing alarms and its token no longer works. It can be connected again later. Confirm first, then call with confirm:true.",
  masukan: z.strictObject({ device_id: SkemaId, confirm: z.literal(true) }),
  async jalankan(k, m) {
    const nama = (await daftarPerangkat(k.penggunaId)).find((x) => x.id === m.device_id)?.nama ?? "";
    await cabutPerangkat(k.penggunaId, m.device_id, "agen");
    return { data: { removed: true, device_id: m.device_id }, teks: isi(k.t.mcp.perangkatDiputus, { nama }) };
  },
});

export const ALAT_AKUN = [
  getSetupStatus,
  getPreferences,
  updatePreferences,
  listChannels,
  testChannel,
  testNotification,
  listStandbyDevices,
  getDeviceSetupLinks,
  renameStandbyDevice,
  removeStandbyDevice,
];
