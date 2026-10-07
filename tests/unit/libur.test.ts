import { describe, expect, it } from "vitest";
import { adaDataLibur, adalahLiburNasional, berkasLibur, jenisHari } from "@/lib/jadwal/libur";
import { tanggalSah } from "@/lib/jadwal/tanggal";

describe("data libur nasional", () => {
  it("setiap berkas mencatat sumber resmi dan tanggal pemeriksaan", () => {
    for (const b of berkasLibur()) {
      expect(b.sumber).toMatch(/^SKB Menteri Agama, Menteri Ketenagakerjaan, dan Menteri PANRB Nomor .+ Tahun \d{4}$/);
      expect(tanggalSah(b.diperiksa)).toBe(true);
    }
  });

  it("tanggal sah, di tahun berkasnya, urut, tidak ganda, dan tidak bertabrakan dengan cuti bersama", () => {
    for (const b of berkasLibur()) {
      const semua = [...b.libur, ...b.cutiBersama].map((x) => x.tanggal);
      for (const t of semua) {
        expect(tanggalSah(t), t).toBe(true);
        expect(t.startsWith(`${b.tahun}-`), t).toBe(true);
      }
      expect(new Set(semua).size).toBe(semua.length);
      for (const daftar of [b.libur, b.cutiBersama]) {
        const t = daftar.map((x) => x.tanggal);
        expect(t).toEqual([...t].sort());
      }
    }
  });

  it("jumlah sesuai SKB: 2026 = 17 libur + 8 cuti bersama, 2027 = 18 libur + 8 cuti bersama", () => {
    const [b26, b27] = berkasLibur();
    expect([b26.tahun, b26.libur.length, b26.cutiBersama.length]).toEqual([2026, 17, 8]);
    expect([b27.tahun, b27.libur.length, b27.cutiBersama.length]).toEqual([2027, 18, 8]);
  });

  it("membedakan libur nasional, cuti bersama, dan hari biasa", () => {
    expect(adalahLiburNasional("2026-08-17")).toBe(true);
    expect(adalahLiburNasional("2026-12-24")).toBe(false);
    expect(jenisHari("2026-12-24")).toEqual({ jenis: "cuti_bersama", nama: "Cuti bersama Kelahiran Yesus Kristus" });
    expect(jenisHari("2027-03-10")?.jenis).toBe("libur");
    expect(jenisHari("2026-10-07")).toBeNull();
    expect(adaDataLibur(2026)).toBe(true);
    expect(adaDataLibur(2028)).toBe(false);
  });
});
