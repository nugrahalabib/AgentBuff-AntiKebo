import { describe, expect, it } from "vitest";
import { dalamRentang, pemicuDidukung, syaratTerpenuhi, terpicu, uraikanPemicu } from "@/lib/otomasi/pemicu";
import { rakitKemampuan } from "@/lib/tuya/kemampuan";
import type { ModelPerangkat } from "@/lib/tuya/tipe";

const p = (code: string, typeSpec: unknown, accessMode = "rw") => ({ code, accessMode, typeSpec, name: code });
const sensorSuhu = rakitKemampuan({ services: [{ properties: [p("va_temperature", { type: "value", min: -200, max: 600, step: 1, scale: 1 }, "ro"), p("va_humidity", { type: "value", min: 0, max: 100, step: 1, scale: 0 }, "ro"), p("battery_state", { type: "enum", range: ["low", "middle", "high"] }, "ro")] }] } as unknown as ModelPerangkat);
const lampu = rakitKemampuan({ services: [{ properties: [p("switch_led", { type: "bool" })] }] } as unknown as ModelPerangkat);
const on = (properti: Record<string, unknown>) => ({ online: true, properti });

describe("pemicu otomasi", () => {
  it("suhu di atas: memakai nilai nyata (skala), tepi naik saja", () => {
    const pm = { deviceId: "s", jenis: "suhu_di_atas" as const, nilai: 30 };
    expect(syaratTerpenuhi(pm, sensorSuhu, on({ va_temperature: 305 }))).toBe(true);
    expect(syaratTerpenuhi(pm, sensorSuhu, on({ va_temperature: 295 }))).toBe(false);
    expect(terpicu(pm, sensorSuhu, on({ va_temperature: 295 }), on({ va_temperature: 305 }))).toBe(true);
    expect(terpicu(pm, sensorSuhu, on({ va_temperature: 305 }), on({ va_temperature: 310 }))).toBe(false);
    // Data sebelumnya belum ada = boleh menembak (bukan diam selamanya).
    expect(terpicu(pm, sensorSuhu, on({}), on({ va_temperature: 310 }))).toBe(true);
  });

  it("nyala/mati, offline/online, baterai enum", () => {
    expect(terpicu({ deviceId: "l", jenis: "menyala" }, lampu, on({ switch_led: false }), on({ switch_led: true }))).toBe(true);
    expect(terpicu({ deviceId: "l", jenis: "mati" }, lampu, on({ switch_led: true }), on({ switch_led: false }))).toBe(true);
    expect(terpicu({ deviceId: "l", jenis: "offline" }, lampu, on({}), { online: false, properti: {} })).toBe(true);
    expect(syaratTerpenuhi({ deviceId: "l", jenis: "menyala" }, lampu, { online: false, properti: { switch_led: true } })).toBe(false);
    expect(syaratTerpenuhi({ deviceId: "s", jenis: "baterai_di_bawah", nilai: 20 }, sensorSuhu, on({ battery_state: "low" }))).toBe(true);
  });

  it("sensor: pintu, gerakan, asap, bocor", () => {
    const k = rakitKemampuan(null);
    expect(syaratTerpenuhi({ deviceId: "x", jenis: "pintu_terbuka" }, k, on({ doorcontact_state: true }))).toBe(true);
    expect(syaratTerpenuhi({ deviceId: "x", jenis: "pintu_tertutup" }, k, on({ doorcontact_state: true }))).toBe(false);
    expect(syaratTerpenuhi({ deviceId: "x", jenis: "gerakan" }, k, on({ pir: "pir" }))).toBe(true);
    expect(syaratTerpenuhi({ deviceId: "x", jenis: "gerakan" }, k, on({ pir: "none" }))).toBe(false);
    expect(syaratTerpenuhi({ deviceId: "x", jenis: "asap" }, k, on({ smoke_sensor_status: "alarm" }))).toBe(true);
    expect(syaratTerpenuhi({ deviceId: "x", jenis: "bocor_air" }, k, on({ watersensor_state: "normal" }))).toBe(false);
  });

  it("dukungan pemicu dari model; uraian bahasa Indonesia", () => {
    expect(pemicuDidukung({ deviceId: "s", jenis: "suhu_di_atas", nilai: 1 }, sensorSuhu, new Set(["va_temperature"]))).toBe(true);
    expect(pemicuDidukung({ deviceId: "l", jenis: "pintu_terbuka" }, lampu, new Set(["switch_led"]))).toBe(false);
    expect(uraikanPemicu({ deviceId: "s", jenis: "suhu_di_atas", nilai: 30 }, "Sensor Kamar")).toBe("suhu Sensor Kamar di atas 30°");
  });

  it("rentang jam lewat tengah malam (WIB)", () => {
    const r = { mulai: "22:00", akhir: "06:00" };
    expect(dalamRentang(r, new Date("2026-10-03T16:00:00Z"), "Asia/Jakarta")).toBe(true); // 23.00
    expect(dalamRentang(r, new Date("2026-10-03T21:30:00Z"), "Asia/Jakarta")).toBe(true); // 04.30
    expect(dalamRentang(r, new Date("2026-10-03T05:00:00Z"), "Asia/Jakarta")).toBe(false); // 12.00
    expect(dalamRentang(null, new Date(), "Asia/Jakarta")).toBe(true);
  });
});
