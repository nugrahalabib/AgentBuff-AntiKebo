import { describe, expect, it } from "vitest";
import { broadlinkKePulsa, daftarMerek, jsonKirimIr, kodeMerek, kodeUntuk, modeDidukung, muatPustaka, pulsaKeTuya, type PustakaAc } from "@/lib/ir/kode-ac";

// Kode "off" Toyotomi dari SmartIR (1000.json): pembuka NEC 9 ms / 4,5 ms.
const OFF_1000 =
  "JgCSAAABKZEXNBgQFxEXEBc1FxAYEBcQGDQXERcQGDQXERcQFxEXEBcRFxAYEBcQGBAXNRcQFxEXEBcRFxAYEBc1FxAXNRcQGBAXNRcQFwACjhcQGBAXEBgQFxEXEBcRFxAXERcQGBAXEBgQFzQYEBcRFxAYEBcQGBAXEBgQFxEXEBcRFxAXERcQGBAXNBg0FxEXAA0FAAAAAAAA";

const b64 = (s: string) => Buffer.from(s).toString("base64");

/** Pustaka buatan: kode = teks penanda (dibungkus format Broadlink minimal) supaya pilihan bisa dibaca. */
function bl(tanda: number): string {
  // 0x26, ulang 0, panjang 4, isi: tanda, 10, 10, 10 (satuan Broadlink)
  return Buffer.from([0x26, 0, 4, 0, tanda, 10, 10, 10]).toString("base64");
}
const tandaDari = (kode: string) => Buffer.from(kode, "base64")[4];

const PUSTAKA: PustakaAc = {
  id: "9",
  merek: "Uji",
  model: ["X"],
  min: 16,
  maks: 30,
  langkah: 1,
  mode: ["cool", "heat", "dry", "fan_only"],
  kipas: ["auto", "low", "mid", "high"],
  ayun: null,
  perintah: {
    off: bl(1),
    on: bl(2),
    cool: { auto: { "16": bl(10), "24": bl(11), "25": bl(12) }, low: { "24": bl(13) }, mid: { "24": bl(14) }, high: { "24": bl(15) } },
    heat: { auto: { "24": bl(20) } },
    dry: { auto: { "24": bl(30) } },
    fan_only: { low: bl(40), high: bl(41) },
  },
};

describe("konversi kode", () => {
  it("Broadlink -> pulsa µs (pembuka NEC ~9000/4500)", () => {
    const p = broadlinkKePulsa(OFF_1000);
    expect(p[0]).toBeGreaterThan(8800);
    expect(p[0]).toBeLessThan(9200);
    expect(p[1]).toBeGreaterThan(4300);
    expect(p[1]).toBeLessThan(4600);
    expect(p.length % 2).toBe(1); // berakhir dengan tanda, jeda penutup dibuang
  });

  it("pulsa -> base64 uint16 little-endian, dijepit 65535", () => {
    const s = pulsaKeTuya([300, 30000, 70000]);
    const buf = Buffer.from(s, "base64");
    expect([buf.readUInt16LE(0), buf.readUInt16LE(2), buf.readUInt16LE(4)]).toEqual([300, 30000, 65535]);
  });

  it("JSON ir_send sesuai format pemancar Tuya (key1 diawali '1')", () => {
    const j = JSON.parse(jsonKirimIr(OFF_1000));
    expect(j).toMatchObject({ control: "send_ir", head: "", type: 0, delay: 300 });
    expect(j.key1.startsWith("1")).toBe(true);
    expect(Buffer.from(j.key1.slice(1), "base64").readUInt16LE(0)).toBeGreaterThan(8800);
    expect(JSON.stringify(j).length).toBeLessThan(3072);
  });

  it("bukan kode IR ditolak", () => {
    expect(() => broadlinkKePulsa(b64("hello world"))).toThrow();
  });
});

describe("kodeUntuk: keadaan -> kode", () => {
  it("mati = kode off", () => {
    const r = kodeUntuk(PUSTAKA, { nyala: false }, true);
    expect(r.ok && r.kode.map(tandaDari)).toEqual([1]);
  });

  it("nyala dari mati: kirim 'on' dulu, lalu dingin otomatis 24", () => {
    const r = kodeUntuk(PUSTAKA, { nyala: true, mode: "cold", kipas: "auto", suhu: 24 }, false);
    expect(r.ok && r.kode.map(tandaDari)).toEqual([2, 11]);
  });

  it("sudah nyala: tanpa 'on'; kipas kencang; suhu tak ada dibulatkan ke terdekat", () => {
    const r = kodeUntuk(PUSTAKA, { nyala: true, mode: "cold", kipas: "high", suhu: 24 }, true);
    expect(r.ok && r.kode.map(tandaDari)).toEqual([15]);
    const s = kodeUntuk(PUSTAKA, { nyala: true, mode: "cold", kipas: "auto", suhu: 20 }, true);
    expect(s.ok && s.dipakai.suhu).toBe(16);
  });

  it("mode kering & kipas (tanpa suhu)", () => {
    expect(kodeUntuk(PUSTAKA, { nyala: true, mode: "wet", suhu: 24 }, true)).toMatchObject({ ok: true });
    const r = kodeUntuk(PUSTAKA, { nyala: true, mode: "wind", kipas: "low" }, true);
    expect(r.ok && r.kode.map(tandaDari)).toEqual([40]);
  });

  it("mode tidak ada di pustaka ditolak dengan pilihan", () => {
    const r = kodeUntuk(PUSTAKA, { nyala: true, mode: "auto" }, true);
    expect(r.ok).toBe(false);
    expect(modeDidukung(PUSTAKA)).toEqual(["cold", "hot", "wind", "wet"]);
  });
});

describe("pustaka asli", () => {
  it("merek umum ada dan setiap model punya kode mati + uji nyala", () => {
    const merek = daftarMerek().map((m) => m.merek);
    for (const m of ["Daikin", "Panasonic", "Sharp", "LG", "Samsung", "Gree", "Midea"]) expect(merek).toContain(m);
    let n = 0;
    for (const m of daftarMerek()) {
      for (const k of kodeMerek(m.merek)) {
        const p = muatPustaka(k.id)!;
        expect(kodeUntuk(p, { nyala: false }, true).ok).toBe(true);
        const r = kodeUntuk(p, { nyala: true, mode: "cold", kipas: "auto", suhu: 24 }, false);
        expect(r.ok).toBe(true);
        if (r.ok) for (const c of r.kode) expect(jsonKirimIr(c).length).toBeLessThan(3072);
        n++;
      }
    }
    expect(n).toBeGreaterThan(300);
  });

  it("id di luar indeks tidak pernah dibaca (bukan jalur bebas)", () => {
    expect(muatPustaka("../index")).toBeNull();
    expect(muatPustaka("999999")).toBeNull();
  });
});
