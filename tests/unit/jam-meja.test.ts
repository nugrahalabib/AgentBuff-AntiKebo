import { describe, expect, it } from "vitest";
import { alarmBerikutnyaLokal, asetSiaga, jagaanBerikutnya, TENGGANG_LOKAL_MS, type ItemLokal } from "@/lib/jam-meja/jadwal-lokal";

// Pengatur waktu lokal Mode Jam Meja: berbunyi sendiri hanya bila server diam sesudah tenggang.

const T = Date.parse("2026-10-08T05:00:00+07:00");
const item = (kunci: string, jadwal: number, isi: Partial<ItemLokal> = {}): ItemLokal => ({
  kunci,
  kejadianId: `k-${kunci}`,
  jadwalUtc: new Date(jadwal).toISOString(),
  jam: "05:00",
  status: "menunggu",
  judul: kunci,
  detail: null,
  bunyi: "klasik",
  tundaSampai: null,
  uji: false,
  omelan: [],
  ...isi,
});

describe("jagaan berikutnya", () => {
  it("paling dulu menunggu, berbunyi sendiri sesudah tenggang", () => {
    const j = [item("b", T + 3_600_000), item("a", T)];
    expect(jagaanBerikutnya(j, T - 60_000, new Set())).toEqual({ item: j[1], pada: T + TENGGANG_LOKAL_MS });
  });

  it("kunci yang sudah ditangani dilewati", () => {
    const j = [item("a", T), item("b", T + 60_000)];
    expect(jagaanBerikutnya(j, T - 1_000, new Set(["a"]))?.item.kunci).toBe("b");
  });

  it("ditunda dijaga sampai tunda habis; jadwal lama dan yang selesai diabaikan", () => {
    const j = [
      item("lama", T - 31 * 60_000),
      item("selesai", T + 60_000, { status: "bangun" }),
      item("tunda", T - 600_000, { status: "ditunda", tundaSampai: new Date(T + 120_000).toISOString() }),
    ];
    expect(jagaanBerikutnya(j, T, new Set())).toEqual({ item: j[2], pada: T + 120_000 + TENGGANG_LOKAL_MS });
  });

  it("sudah lewat jadwal (dibuka terlambat): langsung", () => {
    const j = [item("a", T - 120_000)];
    expect(jagaanBerikutnya(j, T, new Set())?.pada).toBe(T);
  });

  it("lebih dari 24 jam ke depan belum dijaga", () => {
    expect(jagaanBerikutnya([item("jauh", T + 25 * 3_600_000)], T, new Set())).toBeNull();
  });
});

describe("alarm berikutnya dan aset", () => {
  it("pil siaga menunjuk alarm menunggu terdekat", () => {
    const j = [item("b", T + 7_200_000), item("a", T + 3_600_000), item("x", T + 60_000, { status: "dibatalkan" })];
    expect(alarmBerikutnyaLokal(j, T)?.kunci).toBe("a");
    expect(alarmBerikutnyaLokal([], T)).toBeNull();
  });

  it("bunyi dan klip tanpa ganda, urut", () => {
    const j = [
      item("a", T, {
        bunyi: "sirene",
        omelan: [
          { jenis: "umum", teks: "x", klip: "h2" },
          { jenis: "umum", teks: "y", klip: null },
        ],
      }),
      item("b", T, { bunyi: "sirene", omelan: [{ jenis: "umum", teks: "z", klip: "h1" }] }),
    ];
    expect(asetSiaga(j)).toEqual(["/api/perangkat/klip/h1", "/api/perangkat/klip/h2", "/bunyi/sirene.wav"]);
  });
});
