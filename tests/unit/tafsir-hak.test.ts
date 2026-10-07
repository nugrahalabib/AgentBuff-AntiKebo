import { describe, expect, it } from "vitest";
import { jedaCobaLagiMs, jitterMs, melewatiToleransi, singgahanBasi, tafsirJawabanStatus, TOLERANSI_TAK_TERJANGKAU_MS } from "@/lib/agentbuff/tafsir";
import { tautanPerpanjang } from "@/lib/agentbuff/tautan-beku";

// Gerbang hak (docs/05-INTEGRASI-AGENTBUFF.md §2, K-12): hanya jawaban 200 yang jelas yang membekukan.

describe("tafsirJawabanStatus", () => {
  it("200 sah: aktif/tidak sesuai alasan", () => {
    expect(tafsirJawabanStatus(200, { aktif: true, alasan: "ok", pesan: "" })).toMatchObject({ jenis: "jawaban", aktif: true, alasan: "ok" });
    expect(tafsirJawabanStatus(200, { aktif: false, alasan: "belum_beli", pesan: "x", sub: "s" })).toMatchObject({
      jenis: "jawaban",
      aktif: false,
      alasan: "belum_beli",
      sub: "s",
    });
  });
  it("janggal atau bukan 200 = tidak terjangkau (bukan beku)", () => {
    expect(tafsirJawabanStatus(200, { aktif: true, alasan: "belum_beli" })).toEqual({ jenis: "tidak_terjangkau", kredensialDitolak: false });
    expect(tafsirJawabanStatus(200, { aktif: false, alasan: "alasan_baru" })).toEqual({ jenis: "tidak_terjangkau", kredensialDitolak: false });
    expect(tafsirJawabanStatus(200, null)).toEqual({ jenis: "tidak_terjangkau", kredensialDitolak: false });
    expect(tafsirJawabanStatus(503, { aktif: false, alasan: "belum_beli" })).toEqual({ jenis: "tidak_terjangkau", kredensialDitolak: false });
    expect(tafsirJawabanStatus(401, null)).toEqual({ jenis: "tidak_terjangkau", kredensialDitolak: true });
  });
});

describe("singgahan & toleransi", () => {
  const kini = Date.parse("2026-10-08T05:00:00Z");
  it("singgahan 10 menit + jitter tetap per pengguna (0 sampai 60 dtk)", () => {
    const j = jitterMs("pengguna-1");
    expect(j).toBe(jitterMs("pengguna-1"));
    expect(j).toBeGreaterThanOrEqual(0);
    expect(j).toBeLessThan(60_000);
    expect(singgahanBasi(null, "p", kini)).toBe(true);
    expect(singgahanBasi(new Date(kini - 9 * 60_000), "p", kini)).toBe(false);
    expect(singgahanBasi(new Date(kini - 11 * 60_000 - 60_000), "p", kini)).toBe(true);
  });
  it("toleransi tak terjangkau 72 jam (K-12)", () => {
    expect(TOLERANSI_TAK_TERJANGKAU_MS).toBe(72 * 3600_000);
    expect(melewatiToleransi(new Date(kini - 71 * 3600_000), kini)).toBe(false);
    expect(melewatiToleransi(new Date(kini - 73 * 3600_000), kini)).toBe(true);
    expect(melewatiToleransi(null, kini)).toBe(false);
  });
  it("jeda coba lagi 1, 2, 4, 8 menit, maks 10 menit", () => {
    expect([1, 2, 3, 4, 5, 9].map(jedaCobaLagiMs)).toEqual([60_000, 120_000, 240_000, 480_000, 600_000, 600_000]);
  });
});

describe("tautan perpanjang sesuai alasan", () => {
  it("setiap alasan punya jalan keluar", () => {
    const ab = "https://agentbuff.id";
    expect(tautanPerpanjang("belum_beli", ab, "antikebo")).toBe("https://agentbuff.id/app/shop?produk=antikebo");
    expect(tautanPerpanjang("akses_berakhir", ab, "antikebo")).toBe("https://agentbuff.id/checkout");
    expect(tautanPerpanjang("dicabut", ab, "antikebo")).toBe("/auth/agentbuff/start");
    expect(tautanPerpanjang("tidak_terjangkau", ab, "antikebo")).toBe("/api/hak/periksa");
    expect(tautanPerpanjang("tidak_dikenal", ab, "antikebo")).toBeNull();
  });
});
