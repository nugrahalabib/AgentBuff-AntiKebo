// Disalin dari template AgentBuff-Tuya (`937aa8a`): membuktikan modul Tuya yang disalin tetap benar.
import { describe, expect, it } from "vitest";
import { bacaKeadaan, cocokkanPilihan, hexKeHsv, hsvKeHex, persenKeMentah, rakitKemampuan, tafsirWarna, terjemahkan } from "@/lib/tuya/kemampuan";
import type { ModelPerangkat, PropertiModel } from "@/lib/tuya/tipe";

const p = (code: string, typeSpec: PropertiModel["typeSpec"], accessMode = "rw"): PropertiModel => ({ code, accessMode, typeSpec });
const model = (...props: PropertiModel[]): ModelPerangkat => ({ services: [{ code: "", properties: props }] });

const LAMPU_RGB = model(
  p("switch_led", { type: "bool" }),
  p("work_mode", { type: "enum", range: ["white", "colour", "scene", "music"] }),
  p("bright_value_v2", { type: "value", min: 10, max: 1000, step: 1, scale: 0 }),
  p("temp_value_v2", { type: "value", min: 0, max: 1000, step: 1, scale: 0 }),
  p("colour_data_v2", { type: "string", maxlen: 255 }),
  p("countdown_1", { type: "value", min: 0, max: 86400, step: 1, scale: 0 }),
);

const AC = model(
  p("switch", { type: "bool" }),
  p("temp_set", { type: "value", min: 160, max: 300, step: 5, scale: 1, unit: "℃" }),
  p("temp_current", { type: "value", min: -200, max: 800, step: 1, scale: 1 }, "ro"),
  p("mode", { type: "enum", range: ["cold", "hot", "wet", "wind", "auto"] }),
  p("fan_speed_enum", { type: "enum", range: ["auto", "low", "middle", "high"] }),
);

const STRIP_4 = model(...[1, 2, 3, 4].map((n) => p(`switch_${n}`, { type: "bool" })), p("relay_status", { type: "enum", range: ["off", "on", "memory"] }));

const COLOKAN = model(
  p("switch_1", { type: "bool" }),
  p("cur_power", { type: "value", min: 0, max: 50000, step: 1, scale: 1, unit: "W" }, "ro"),
  p("add_ele", { type: "value", min: 0, max: 50000, step: 100, scale: 3, unit: "kwh" }, "ro"),
);

describe("rakitKemampuan", () => {
  it("lampu RGB dikenali lengkap", () => {
    const k = rakitKemampuan(LAMPU_RGB);
    expect(k.daya?.kode).toBe("switch_led");
    expect(k.terang?.kode).toBe("bright_value_v2");
    expect(k.warna).toEqual({ kode: "colour_data_v2", skalaSV: 1000 });
    expect(k.suhuPutih?.kode).toBe("temp_value_v2");
    expect(k.hitungMundur?.kode).toBe("countdown_1");
    expect(k.lainnya).toHaveLength(0);
  });
  it("saklar 4 saluran = saluran, bukan satu daya", () => {
    const k = rakitKemampuan(STRIP_4);
    expect(k.daya).toBeUndefined();
    expect(k.saluran?.map((s) => s.nomor)).toEqual([1, 2, 3, 4]);
    expect(k.lainnya.map((x) => x.code)).toEqual(["relay_status"]);
  });
  it("colokan satu saluran: switch_1 jadi daya + listrik", () => {
    const k = rakitKemampuan(COLOKAN);
    expect(k.daya?.kode).toBe("switch_1");
    expect(k.listrik?.watt?.kode).toBe("cur_power");
  });
  it("model kosong tidak melempar", () => {
    expect(rakitKemampuan(null).lainnya).toEqual([]);
  });
});

describe("terjemahkan", () => {
  it("nyalakan + terang 80% lampu", () => {
    const r = terjemahkan(rakitKemampuan(LAMPU_RGB), { nyala: true, terangPersen: 80 });
    expect(r).toMatchObject({ ok: true, properti: { switch_led: true, bright_value_v2: 802 } });
  });
  it("terang 1% tidak jatuh di bawah minimum perangkat", () => {
    const k = rakitKemampuan(LAMPU_RGB);
    expect(persenKeMentah(k.terang!, 1)).toBe(20);
    expect(persenKeMentah(k.terang!, 0)).toBe(10);
  });
  it("warna biru = mode colour + colour_data_v2 skala 1000 + nyala otomatis", () => {
    const r = terjemahkan(rakitKemampuan(LAMPU_RGB), { warna: "biru" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.properti.work_mode).toBe("colour");
    expect(r.properti.switch_led).toBe(true);
    expect(JSON.parse(r.properti.colour_data_v2 as string)).toEqual({ h: 230, s: 1000, v: 1000 });
  });
  it("warna + terang = V warna, tanpa bright_value (lampu tidak lompat ke mode putih)", () => {
    const r = terjemahkan(rakitKemampuan(LAMPU_RGB), { warna: "merah", terangPersen: 40 });
    if (!r.ok) throw new Error(r.pesan);
    expect(JSON.parse(r.properti.colour_data_v2 as string).v).toBe(400);
    expect(r.properti.bright_value_v2).toBeUndefined();
  });
  it("lampu yang sedang berwarna: ubah terang mengubah V warna yang sama", () => {
    const sekarang = { work_mode: "colour", colour_data_v2: '{"h":120,"s":1000,"v":1000}' };
    const r = terjemahkan(rakitKemampuan(LAMPU_RGB), { terangPersen: 30 }, sekarang);
    if (!r.ok) throw new Error(r.pesan);
    expect(JSON.parse(r.properti.colour_data_v2 as string)).toEqual({ h: 120, s: 1000, v: 300 });
  });
  it("hangat = mode white + suhu putih 0", () => {
    const r = terjemahkan(rakitKemampuan(LAMPU_RGB), { warna: "hangat" });
    expect(r).toMatchObject({ ok: true, properti: { work_mode: "white", temp_value_v2: 0 } });
  });
  it("AC 24 derajat mode dingin kipas kencang", () => {
    const r = terjemahkan(rakitKemampuan(AC), { nyala: true, suhuTarget: 24, modeAc: "dingin", kipas: "kencang" });
    expect(r).toMatchObject({ ok: true, properti: { switch: true, temp_set: 240, mode: "cold", fan_speed_enum: "high" } });
  });
  it("AC suhu di luar rentang ditolak dengan penjelasan", () => {
    const r = terjemahkan(rakitKemampuan(AC), { suhuTarget: 10 });
    expect(r).toMatchObject({ ok: false, kode: "di_luar_rentang" });
    if (!r.ok) expect(r.pesan).toContain("16");
  });
  it("suhu 24.3 dibulatkan ke langkah 0.5", () => {
    const r = terjemahkan(rakitKemampuan(AC), { suhuTarget: 24.3 });
    expect(r).toMatchObject({ ok: true, properti: { temp_set: 245 } });
  });
  it("strip: matikan saluran 2 saja, atau semua", () => {
    const k = rakitKemampuan(STRIP_4);
    expect(terjemahkan(k, { nyala: false, saluran: 2 })).toMatchObject({ ok: true, properti: { switch_2: false } });
    const semua = terjemahkan(k, { nyala: true });
    if (!semua.ok) throw new Error();
    expect(Object.keys(semua.properti)).toEqual(["switch_1", "switch_2", "switch_3", "switch_4"]);
    expect(terjemahkan(k, { nyala: true, saluran: 9 })).toMatchObject({ ok: false, kode: "tidak_didukung" });
  });
  it("warna di colokan ditolak", () => {
    expect(terjemahkan(rakitKemampuan(COLOKAN), { warna: "merah" })).toMatchObject({ ok: false, kode: "tidak_didukung" });
  });
  it("properti mentah divalidasi tipe & hanya-baca", () => {
    const k = rakitKemampuan(STRIP_4);
    expect(terjemahkan(k, { properti: { relay_status: "memory" } })).toMatchObject({ ok: true });
    expect(terjemahkan(k, { properti: { relay_status: "hidup" } })).toMatchObject({ ok: false, kode: "nilai_tidak_sah" });
    expect(terjemahkan(rakitKemampuan(COLOKAN), { properti: { cur_power: 5 } })).toMatchObject({ ok: false });
    expect(terjemahkan(k, { properti: { tidak_ada: 1 } })).toMatchObject({ ok: false, kode: "tidak_didukung" });
  });
  it("perintah kosong ditolak", () => {
    expect(terjemahkan(rakitKemampuan(AC), {})).toMatchObject({ ok: false, kode: "kosong" });
  });
});

describe("bacaKeadaan", () => {
  it("membaca AC dengan scale", () => {
    const s = bacaKeadaan(rakitKemampuan(AC), { switch: true, temp_set: 240, temp_current: 287, mode: "cold" });
    expect(s).toMatchObject({ nyala: true, suhuTarget: 24, suhuRuang: 28.7, modeAc: "cold" });
  });
  it("membaca warna lampu sebagai hex", () => {
    const s = bacaKeadaan(rakitKemampuan(LAMPU_RGB), { switch_led: true, colour_data_v2: '{"h":0,"s":1000,"v":500}' });
    expect(s.warnaHex).toBe("#ff0000");
  });
  it("strip: nyala bila salah satu saluran nyala", () => {
    expect(bacaKeadaan(rakitKemampuan(STRIP_4), { switch_1: false, switch_2: true }).nyala).toBe(true);
  });
  it("colokan: watt & kWh", () => {
    expect(bacaKeadaan(rakitKemampuan(COLOKAN), { cur_power: 1234, add_ele: 5100 })).toMatchObject({ watt: 123.4, kwhTotal: 5.1 });
  });
});

describe("warna & pilihan", () => {
  it("hex bolak-balik", () => {
    expect(hsvKeHex(hexKeHsv("#3366ff")!)).toBe("#3366ff");
  });
  it("nama warna Indonesia & Inggris + spasi", () => {
    expect(tafsirWarna("Merah Muda")).toEqual({ h: 330, s: 70, v: 100 });
    expect(tafsirWarna("warm")).toBe("hangat");
    expect(tafsirWarna("bukan-warna")).toBeNull();
  });
  it("sinonim mode memetakan ke pilihan perangkat", () => {
    expect(cocokkanPilihan(["cold", "hot", "auto"], "Dingin", { cold: ["dingin"] })).toBe("cold");
    expect(cocokkanPilihan(["cool", "heat"], "dingin", { cold: ["dingin", "cool"] })).toBe("cool");
  });
});

// Bentuk model ASLI dari rumah pengguna pertama (2026-10-03), bukan karangan.
const AC_IR = model(
  p("control", { type: "enum", range: ["send_ir", "study", "study_exit", "study_key"] }, "wr"),
  p("study_code", { type: "raw" }, "ro"),
  p("ir_code", { type: "string", maxlen: 255 }),
  p("key_code", { type: "string", maxlen: 255 }),
  p("key_study", { type: "raw" }),
  p("delay_time", { type: "value", min: 0, max: 255, step: 1, scale: 0 }, "wr"),
  p("type", { type: "value", min: 0, max: 255, step: 1, scale: 0 }),
  p("switch_power", { type: "bool" }),
  p("mode", { type: "enum", range: ["0", "1", "2", "3", "4"] }),
  p("temperature", { type: "value", min: 10, max: 40, step: 1, scale: 0, unit: "" }),
  p("fan", { type: "enum", range: ["0", "1", "2", "3"] }),
  p("swing", { type: "bool" }),
  p("ir_send", { type: "string", maxlen: 255 }),
  p("ir_study_code", { type: "raw" }),
);
const AC_IR_KEADAAN = { fan: "0", mode: "0", type: 0, swing: false, control: "send_ir", delay_time: 0, temperature: 16, switch_power: false };

const PEMANCAR_IR = model(p("ir_send", { type: "string", maxlen: 255 }), p("ir_study_code", { type: "raw" }, "ro"));

const STRIP_HEX12 = model(
  p("switch_led", { type: "bool" }),
  p("work_mode", { type: "enum", range: ["white", "colour", "scene", "music"] }),
  p("bright_value", { type: "value", min: 10, max: 1000, step: 1, scale: 0 }),
  p("colour_data", { type: "string", maxlen: 255 }),
  p("countdown", { type: "value", min: 0, max: 86400, step: 1, scale: 0 }),
  p("music_data", { type: "string", maxlen: 255 }, "wr"),
  p("light_length", { type: "value", min: 0, max: 50000, step: 1, scale: 0 }, "ro"),
  p("dreamlight_scene_mode", { type: "raw" }),
  p("lightpixel_number_set", { type: "value", min: 1, max: 1000, step: 1, scale: 1 }),
  p("paint_colour_data", { type: "raw" }),
);

const COLOKAN_LENGKAP = model(
  p("switch_1", { type: "bool" }),
  p("countdown_1", { type: "value", min: 0, max: 86400, step: 1, scale: 0, unit: "s" }),
  p("add_ele", { type: "value", min: 0, max: 50000, step: 100, scale: 3 }),
  p("cur_current", { type: "value", min: 0, max: 30000, step: 1, scale: 0, unit: "mA" }, "ro"),
  p("cur_power", { type: "value", min: 0, max: 50000, step: 1, scale: 1, unit: "W" }, "ro"),
  p("cur_voltage", { type: "value", min: 0, max: 5000, step: 1, scale: 1, unit: "V" }, "ro"),
  p("test_bit", { type: "value", min: 0, max: 5, step: 1, scale: 0 }, "ro"),
  p("voltage_coe", { type: "value", min: 0, max: 1000000, step: 1, scale: 0 }, "ro"),
  p("fault", { type: "bitmap", label: ["ov_cr"] }, "ro"),
);

describe("AC lewat remote IR (kategori qt)", () => {
  const k = rakitKemampuan(AC_IR, AC_IR_KEADAAN);

  it("dikenali sebagai AC: daya, suhu 10-40, mode & kipas bermakna, bukan tirai", () => {
    expect(k.inframerah).toBe(true);
    expect(k.daya?.kode).toBe("switch_power");
    expect(k.suhuTarget).toMatchObject({ kode: "temperature", min: 10, max: 40 });
    expect(k.suhuRuang).toBeUndefined();
    expect(k.tirai).toBeUndefined();
    expect(k.modeAc?.arti?.["0"]).toBe("cold");
    expect(k.kipas && "arti" in k.kipas ? k.kipas.arti?.["3"] : null).toBe("high");
  });

  it("pengaturan lain hanya ayunan (kode internal remote disembunyikan)", () => {
    expect(k.lainnya.map((x) => x.code)).toEqual(["swing"]);
  });

  it("keadaan dibaca dalam makna, bukan angka", () => {
    const s = bacaKeadaan(k, AC_IR_KEADAAN);
    expect(s.modeAc).toBe("cold");
    expect(s.kipas).toBe("auto");
    expect(s.suhuTarget).toBe(16);
    expect(s.nyala).toBe(false);
  });

  it("perintah 'dingin 24 kipas kencang' jadi nilai mentah remote", () => {
    const t = terjemahkan(k, { suhuTarget: 24, modeAc: "dingin", kipas: "kencang" });
    expect(t).toEqual({ ok: true, properti: { temperature: 24, mode: "0", fan: "3", switch_power: true }, ringkasan: expect.any(Array) });
  });

  it("mode kering = 4, kipas = 3, dan nilai mentah juga diterima", () => {
    const a = terjemahkan(k, { modeAc: "kering" });
    expect(a.ok && a.properti.mode).toBe("4");
    const b = terjemahkan(k, { modeAc: "kipas" });
    expect(b.ok && b.properti.mode).toBe("3");
    const c = terjemahkan(k, { modeAc: "1" });
    expect(c.ok && c.properti.mode).toBe("1");
  });

  it("mode asal ditolak dengan pilihan bermakna", () => {
    const t = terjemahkan(k, { modeAc: "turbo" });
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.pesan).toContain("cold");
  });

  it("ayunan lewat properti", () => {
    const t = terjemahkan(k, { properti: { swing: true } });
    expect(t.ok && t.properti).toEqual({ swing: true });
  });
});

describe("pemancar remote IR (kategori wnykq)", () => {
  it("dikenali sebagai pemancar, tanpa kendali palsu", () => {
    const k = rakitKemampuan(PEMANCAR_IR);
    expect(k.pemancarIr).toBe(true);
    expect(k.inframerah).toBeFalsy();
    expect(k.daya).toBeUndefined();
    expect(k.lainnya).toEqual([]);
  });
});

describe("lampu strip format hex12 + mode lampu + timer", () => {
  const sekarang = { work_mode: "colour", switch_led: true, colour_data: "00f003e803e8", bright_value: 1000 };
  const k = rakitKemampuan(STRIP_HEX12, sekarang);

  it("warna dibaca dari hex12 (h=240 biru)", () => {
    const s = bacaKeadaan(k, sekarang);
    expect(s.warnaHex?.toLowerCase()).toBe("#0000ff");
  });

  it("menulis warna mengikuti format hex12 perangkat", () => {
    const t = terjemahkan(k, { warna: "merah" }, sekarang);
    expect(t.ok && t.properti.colour_data).toBe("000003e803e8");
    expect(t.ok && t.properti.work_mode).toBe("colour");
  });

  it("mode lampu musik & adegan", () => {
    const t = terjemahkan(k, { modeLampu: "musik" });
    expect(t.ok && t.properti.work_mode).toBe("music");
    const u = terjemahkan(k, { modeLampu: "adegan" });
    expect(u.ok && u.properti.work_mode).toBe("scene");
  });

  it("timer 30 menit = 1800 detik, 0 = batal", () => {
    const t = terjemahkan(k, { hitungMundurMenit: 30 });
    expect(t.ok && t.properti).toEqual({ countdown: 1800 });
    const u = terjemahkan(k, { hitungMundurMenit: 0 });
    expect(u.ok && u.properti).toEqual({ countdown: 0 });
  });

  it("data efek internal tidak muncul di pengaturan lain", () => {
    expect(k.lainnya.map((x) => x.code)).toEqual(["lightpixel_number_set"]);
  });
});

describe("colokan lengkap", () => {
  const k = rakitKemampuan(COLOKAN_LENGKAP);
  it("volt & ampere (mA jadi A), tanpa data kalibrasi di pengaturan lain", () => {
    const s = bacaKeadaan(k, { switch_1: true, cur_voltage: 2282, cur_current: 150, cur_power: 330 });
    expect(s.volt).toBe(228.2);
    expect(s.ampere).toBe(0.15);
    expect(s.watt).toBe(33);
    expect(k.lainnya).toEqual([]);
    expect(k.hitungMundur?.kode).toBe("countdown_1");
  });
});

describe("bacaan siap tampil", () => {
  it("angka sensor diskalakan + satuan; bitmap jadi daftar tanda aktif; bacaan masuk daftar", async () => {
    const { nilaiBacaan } = await import("@/lib/tuya/kemampuan");
    const suhu = p("temp_current", { type: "value", min: -200, max: 600, step: 1, scale: 1, unit: "℃" }, "ro");
    const gangguan = p("fault", { type: "bitmap", label: ["sensor_fault", "low_battery"] } as PropertiModel["typeSpec"], "ro");
    const SENSOR = model(
      suhu,
      p("humidity_value", { type: "value", min: 0, max: 100, step: 1, scale: 0, unit: "%" }, "ro"),
      gangguan,
      p("pir_state", { type: "enum", range: ["pir", "none"] }, "ro"),
    );
    const k = rakitKemampuan(SENSOR);
    expect(k.bacaan.map((x) => x.code)).toEqual(expect.arrayContaining(["fault", "pir_state"]));
    expect(nilaiBacaan(suhu, 291)).toEqual({ nilai: 29.1, satuan: "℃" });
    expect(nilaiBacaan(gangguan, 2)).toEqual({ nilai: ["low_battery"], satuan: "" });
    expect(nilaiBacaan(gangguan, 0)).toEqual({ nilai: [], satuan: "" });
  });
});
