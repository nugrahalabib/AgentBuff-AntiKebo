import { describe, expect, it } from "vitest";
import { berikutnya, instanLokal, uraikanJadwal } from "@/lib/waktu/jadwal";

const WIB = "Asia/Jakarta";

describe("berikutnya", () => {
  it("harian 23:00 WIB dari pagi = hari yang sama 16:00 UTC", () => {
    const dari = new Date("2026-10-03T01:00:00Z"); // 08:00 WIB
    expect(berikutnya({ jenis: "harian", waktuLokal: "23:00", zona: WIB }, dari)?.toISOString()).toBe("2026-10-03T16:00:00.000Z");
  });
  it("harian: jam yang sudah lewat pindah ke besok; tepat pada jam = besok", () => {
    const dari = new Date("2026-10-03T16:00:00Z"); // tepat 23:00 WIB
    expect(berikutnya({ jenis: "harian", waktuLokal: "23:00", zona: WIB }, dari)?.toISOString()).toBe("2026-10-04T16:00:00.000Z");
  });
  it("lewat tengah malam lokal (00:30 WIB = 17:30 UTC hari sebelumnya)", () => {
    const dari = new Date("2026-10-03T12:00:00Z"); // 19:00 WIB Sabtu
    expect(berikutnya({ jenis: "harian", waktuLokal: "00:30", zona: WIB }, dari)?.toISOString()).toBe("2026-10-03T17:30:00.000Z");
  });
  it("mingguan hari kerja melompati akhir pekan", () => {
    const sabtu = new Date("2026-10-03T03:00:00Z"); // Sabtu 10:00 WIB
    const r = berikutnya({ jenis: "mingguan", waktuLokal: "06:30", hari: [1, 2, 3, 4, 5], zona: WIB }, sabtu);
    expect(r?.toISOString()).toBe("2026-10-04T23:30:00.000Z"); // Senin 5 Okt 06:30 WIB
  });
  it("zona WITA & WIT", () => {
    expect(instanLokal(2026, 10, 3, 7, 0, "Asia/Makassar").toISOString()).toBe("2026-10-02T23:00:00.000Z");
    expect(instanLokal(2026, 10, 3, 7, 0, "Asia/Jayapura").toISOString()).toBe("2026-10-02T22:00:00.000Z");
  });
  it("sekali: hanya bila masih di depan", () => {
    const pada = new Date("2026-10-03T10:00:00Z");
    expect(berikutnya({ jenis: "sekali", zona: WIB, pada }, new Date("2026-10-03T09:00:00Z"))).toEqual(pada);
    expect(berikutnya({ jenis: "sekali", zona: WIB, pada }, new Date("2026-10-03T10:00:00Z"))).toBeNull();
  });
  it("jam tidak sah / mingguan tanpa hari = null", () => {
    expect(berikutnya({ jenis: "harian", waktuLokal: "25:00", zona: WIB }, new Date())).toBeNull();
    expect(berikutnya({ jenis: "mingguan", waktuLokal: "07:00", hari: [], zona: WIB }, new Date())).toBeNull();
  });
});

describe("uraikanJadwal", () => {
  it("bahasa manusia", () => {
    expect(uraikanJadwal({ jenis: "harian", waktuLokal: "23:00", zona: WIB })).toBe("Setiap hari 23:00");
    expect(uraikanJadwal({ jenis: "mingguan", waktuLokal: "06:30", hari: [5, 1, 2, 3, 4], zona: WIB })).toBe("Hari kerja 06:30");
    expect(uraikanJadwal({ jenis: "mingguan", waktuLokal: "08:00", hari: [0, 6], zona: WIB })).toBe("Akhir pekan 08:00");
    expect(uraikanJadwal({ jenis: "mingguan", waktuLokal: "08:00", hari: [3, 1], zona: WIB })).toBe("Sen, Rab 08:00");
    expect(uraikanJadwal({ jenis: "sekali", zona: WIB, pada: new Date("2026-10-04T16:00:00Z") })).toBe("Sekali, 4 Okt 23:00");
  });
});
