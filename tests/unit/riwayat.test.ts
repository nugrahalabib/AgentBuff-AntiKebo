import { describe, expect, it } from "vitest";
import { ringkasRiwayat, selCsv, type BarisRiwayat } from "@/lib/layanan/riwayat";

// Ringkasan Riwayat (PRD K1, K2): skor dari src/lib/skor.ts (contoh emas tests/emas/skor.json).
const HARI = "2026-10-07";
let n = 0;
function baris(tanggal: string, isi: Partial<BarisRiwayat> = {}): BarisRiwayat {
  const berbunyi = new Date(`${tanggal}T05:00:00+07:00`);
  return {
    id: `k${++n}`,
    tanggal,
    jam: "05:00",
    judul: "Bangun",
    status: "bangun",
    berbunyiPada: berbunyi,
    bangunPada: new Date(berbunyi.getTime() + 2 * 60_000),
    jumlahTunda: 0,
    gagalCek: false,
    pesanKanal: 0,
    ...isi,
  };
}
const menit = (tanggal: string, m: number) => new Date(new Date(`${tanggal}T05:00:00+07:00`).getTime() + m * 60_000);

describe("ringkasan riwayat", () => {
  it("skor hari ini, hari beruntun, rata-rata menit, total tunda, grafik 30 hari", () => {
    const r = ringkasRiwayat(
      [
        baris(HARI, { bangunPada: menit(HARI, 12), jumlahTunda: 1, pesanKanal: 4 }), // 100 - 10 - 10 = 80
        baris("2026-10-06"), // 100
        baris("2026-10-05", { status: "terlewat", berbunyiPada: null, bangunPada: null }), // tidak dihitung, tidak memutus
        baris("2026-10-04", { jumlahTunda: 4 }), // 60: memutus
        baris("2026-10-03"),
      ],
      HARI,
    );
    expect(r.skorHariIni).toBe(80);
    expect(r.beruntun).toBe(2);
    expect(r.totalTunda).toBe(5);
    // Menit penuh sampai bangun: 12, 2, 2, 2 (terlewat tidak ikut) = 4,5 -> 5.
    expect(r.rataMenit).toBe(5);
    expect(r.skor30).toHaveLength(30);
    expect(r.hari30[29]).toBe(HARI);
    expect(r.hari30[0]).toBe("2026-09-08");
    expect(r.skor30.slice(-5)).toEqual([100, 60, null, 100, 80]);
    expect(r.kejadian.map((k) => [k.tanggal, k.status, k.skor])).toEqual([
      [HARI, "bangun", 80],
      ["2026-10-06", "bangun", 100],
      ["2026-10-05", "terlewat", null],
      ["2026-10-04", "bangun", 60],
      ["2026-10-03", "bangun", 100],
    ]);
    expect(r.kejadian[0]).toMatchObject({ tunda: 1, menitSampaiBangun: 12, pesanKanal: 4 });
  });

  it("tidak bangun = 0 dan memutus; dua kejadian sehari dirata-rata; cek_bangun tampil sebagai bangun", () => {
    const r = ringkasRiwayat([baris(HARI, { status: "tidak_bangun", bangunPada: null }), baris(HARI, { jam: "06:00", status: "cek_bangun" }), baris("2026-10-06")], HARI);
    expect(r.skorHariIni).toBe(50);
    expect(r.beruntun).toBe(0);
    expect(r.kejadian.map((k) => [k.jam, k.status])).toEqual([
      ["06:00", "bangun"],
      ["05:00", "tidak_bangun"],
      ["05:00", "bangun"],
    ]);
  });

  it("kejadian lebih dari 30 hari tidak tampil tapi tetap dihitung untuk hari beruntun; tanggal depan diabaikan", () => {
    const lama = Array.from({ length: 40 }, (_, i) => baris(new Date(Date.UTC(2026, 9, 7 - i)).toISOString().slice(0, 10)));
    const r = ringkasRiwayat([...lama, baris("2026-10-09")], HARI);
    expect(r.beruntun).toBe(40);
    expect(r.kejadian).toHaveLength(30);
    expect(r.kejadian.some((k) => k.tanggal === "2026-10-09")).toBe(false);
  });

  it("tanpa data: semuanya kosong, bukan nol palsu", () => {
    const r = ringkasRiwayat([], HARI);
    expect(r).toMatchObject({ skorHariIni: null, beruntun: 0, rataMenit: null, totalTunda: 0, kejadian: [] });
    expect(r.skor30.every((x) => x === null)).toBe(true);
  });
});

describe("sel CSV", () => {
  it("kutip, koma, baris baru, dan injeksi rumus", () => {
    expect(selCsv("Rapat, pagi")).toBe('"Rapat, pagi"');
    expect(selCsv('Kata "bos"')).toBe('"Kata ""bos"""');
    expect(selCsv("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(selCsv("-5+3")).toBe("'-5+3");
    expect(selCsv(-5)).toBe("-5");
    expect(selCsv(null)).toBe("");
  });
});
