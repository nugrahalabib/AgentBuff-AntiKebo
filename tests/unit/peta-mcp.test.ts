import { describe, expect, it } from "vitest";
import { SkemaIsiAlarm } from "@/lib/alarm/isi";
import { dariIsi, dariUlang, keMasukanAlarm, keUlang, SkemaAlarmMcp, SkemaUlangMcp, type AlarmMcp } from "@/lib/mcp/peta";

// Peta isian MCP (Inggris) ke isian alarm internal dan balik: tidak boleh ada yang hilang atau tertukar.

describe("peta pengulangan", () => {
  const kasus: Array<[unknown, unknown]> = [
    [
      { type: "once", date: "2026-10-20" },
      { jenis: "sekali", tanggal: "2026-10-20" },
    ],
    [{ type: "daily" }, { jenis: "harian" }],
    [{ type: "weekdays" }, { jenis: "hari_kerja" }],
    [{ type: "weekends" }, { jenis: "akhir_pekan" }],
    [
      { type: "days", days: ["sun", "wed", "sat"] },
      { jenis: "hari", hari: [0, 3, 6] },
    ],
    [
      { type: "every_n_weeks", every: 2, days: ["mon"], start_date: "2026-10-05" },
      { jenis: "tiap_minggu", setiap: 2, hari: [1], mulai: "2026-10-05" },
    ],
    [
      { type: "monthly_date", day: 31 },
      { jenis: "bulanan_tanggal", tanggal: 31 },
    ],
    [
      { type: "monthly_weekday", nth: "last", weekday: "fri" },
      { jenis: "bulanan_hari_ke", ke: -1, hari: 5 },
    ],
  ];
  it.each(kasus)("%j <-> %j", (mcp, internal) => {
    const u = SkemaUlangMcp.parse(mcp);
    expect(keUlang(u)).toEqual(internal);
    expect(dariUlang(internal as never)).toEqual(mcp);
  });

  it("once tanpa tanggal = kemunculan berikutnya", () => {
    expect(keUlang({ type: "once" })).toEqual({ jenis: "sekali" });
  });
});

describe("peta isian alarm", () => {
  const penuh: AlarmMcp = {
    time: "05:30",
    repeat: { type: "weekdays" },
    agenda_title: "Kuliah",
    agenda_detail: "Bawa laptop",
    character: "pelatih_tentara",
    voice_id: "id-ID-ArdiNeural",
    sound: "sirene",
    challenge: { type: "math_and_qr", level: "hard", correct_in_a_row: 3, qr_code_ids: ["00000000-0000-4000-8000-000000000001"] },
    snooze: { count: 2, minutes: 10 },
    spam: { channel_ids: ["k_tg"], interval_seconds: 30, stop_after_minutes: 20 },
    smart_home: [
      { device_id: "lampu1", when: "before", minutes_before: 15, action: { power: true, brightness: 80, color: "#ff8800" }, flash: true, after_wake: "morning_mood" },
      { device_id: "ac1", when: "with_alarm", action: { power: true, ac_temperature: 22, ac_mode: "cool" } },
    ],
    commitment: true,
    still_awake_check: { enabled: true, after_minutes: 7, answer_within_seconds: 90 },
    skip_holidays: true,
    auto_stop_minutes: 30,
    custom_lines: ["Bangun!"],
    enabled: true,
  };

  it("isian penuh menjadi isi alarm internal yang sah, lalu kembali sama", () => {
    expect(SkemaAlarmMcp.parse(penuh)).toEqual(penuh);
    const internal = keMasukanAlarm(penuh);
    expect(internal).toMatchObject({
      jam: "05:30",
      pengulangan: { jenis: "hari_kerja" },
      agendaJudul: "Kuliah",
      soal: { jenis: "gabungan", tingkat: "berat", benar: 3 },
      tunda: { jatah: 2, menit: 10 },
      spam: { kanal: ["k_tg"], jedaDtk: 30, batasMenit: 20 },
      masihBangun: { aktif: true, menit: 7, batasDtk: 90 },
      liburNasional: true,
      batasMenit: 30,
      kalimatPribadi: ["Bangun!"],
      aktif: true,
    });
    expect(internal.tuya).toEqual([
      { perangkatId: "lampu1", kapan: "sebelum", menitSebelum: 15, aksi: { nyala: true, terang: 80, warna: "#ff8800" }, kedip: true, sesudahBangun: "suasana_pagi" },
      { perangkatId: "ac1", kapan: "bareng", menitSebelum: null, aksi: { nyala: true, suhuAc: 22, modeAc: "dingin" }, kedip: false, sesudahBangun: "kembalikan" },
    ]);
    // Isi penuh lolos skema internal yang ketat.
    expect(SkemaIsiAlarm.safeParse(internal).success).toBe(true);
    // Dan kembali ke isian agen (aturan rumah mendapat nilai bawaannya).
    const balik = dariIsi(internal);
    expect(balik).toMatchObject({ ...penuh, smart_home: [penuh.smart_home![0], { ...penuh.smart_home![1], minutes_before: null, flash: false, after_wake: "restore" }] });
  });

  it("isian sebagian hanya mengirim yang disebut", () => {
    expect(keMasukanAlarm({ challenge: { level: "easy" }, snooze: { count: 0 } })).toEqual({ soal: { tingkat: "ringan" }, tunda: { jatah: 0 } });
    expect(keMasukanAlarm({})).toEqual({});
  });

  it("isian tak dikenal ditolak (strict)", () => {
    expect(SkemaAlarmMcp.safeParse({ time: "05:00", matikan: true }).success).toBe(false);
    expect(SkemaAlarmMcp.safeParse({ challenge: { type: "math", jawab: "4" } }).success).toBe(false);
  });
});
