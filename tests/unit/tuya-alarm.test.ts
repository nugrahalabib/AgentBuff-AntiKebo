import { afterEach, describe, expect, it } from "vitest";
import { bisaAlarm, kodePotret, opsiKlien, perintahDari } from "@/lib/layanan/tuya";
import { rakitKemampuan, terjemahkan } from "@/lib/tuya/kemampuan";
import { MODEL } from "../tiruan/tuya";

// Aturan rumah pintar per alarm (PRD I3): aksi alarm jadi perintah Tuya; kemampuan perangkat untuk
// layar aturan; server tiruan tidak pernah bisa menerima kunci di produksi.

describe("aksi alarm ke perintah Tuya", () => {
  it("hanya isian yang diatur yang dikirim", () => {
    expect(perintahDari({ nyala: true, terang: 80, warna: "#ff8800" })).toEqual({ nyala: true, terangPersen: 80, warna: "#ff8800" });
    expect(perintahDari({ suhuAc: 24, modeAc: "dingin" })).toEqual({ suhuTarget: 24, modeAc: "dingin" });
    expect(perintahDari({})).toEqual({});
  });
  it("lampu: terang 80% dan putih hangat; AC: dingin 24 derajat (nilai mentah sesuai model)", () => {
    const lampu = rakitKemampuan(MODEL.lampu as never, null);
    const l = terjemahkan(lampu, perintahDari({ nyala: true, terang: 80, suhuPutih: 30 }), null);
    expect(l.ok && l.properti).toMatchObject({ switch_led: true, bright_value_v2: 802, temp_value_v2: 300 });
    const ac = rakitKemampuan(MODEL.ac as never, null);
    const a = terjemahkan(ac, perintahDari({ nyala: true, suhuAc: 24, modeAc: "dingin" }), null);
    expect(a.ok && a.properti).toMatchObject({ switch: true, temp_set: 240, mode: "cold" });
  });
  it("kemampuan untuk layar aturan dan kode yang dipotret", () => {
    expect(bisaAlarm(rakitKemampuan(MODEL.lampu as never, null))).toEqual({ nyala: true, terang: true, warna: true, suhuPutih: true, suhuAc: null, modeAc: [] });
    expect(bisaAlarm(rakitKemampuan(MODEL.colokan as never, null))).toMatchObject({ nyala: true, terang: false, suhuAc: null });
    expect(bisaAlarm(rakitKemampuan(MODEL.pintu as never, null)).nyala).toBe(false);
    expect(kodePotret(rakitKemampuan(MODEL.ac as never, null)).sort()).toEqual(["mode", "switch", "temp_set"]);
  });
});

describe("server Tuya tiruan hanya di mode tiruan", () => {
  const asli = { t: process.env.AGENTBUFF_TIRUAN, b: process.env.TUYA_BASIS_UJI };
  afterEach(() => {
    process.env.AGENTBUFF_TIRUAN = asli.t;
    process.env.TUYA_BASIS_UJI = asli.b;
  });
  it("TUYA_BASIS_UJI diabaikan di produksi (kunci tidak pernah dikirim ke alamat lain)", () => {
    process.env.TUYA_BASIS_UJI = "http://127.0.0.1:3198";
    process.env.AGENTBUFF_TIRUAN = "";
    expect(opsiKlien()).toEqual({});
    process.env.AGENTBUFF_TIRUAN = "1";
    expect(opsiKlien()).toEqual({ basisOverride: "http://127.0.0.1:3198" });
  });
});
