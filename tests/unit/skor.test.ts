import { describe, expect, it } from "vitest";
import { hariBeruntun, menitSampaiBangun, skorHarian, skorKejadian } from "@/lib/skor";
import emas from "../emas/skor.json";

// Contoh emas skor bangun (arsitektur §10): kejadian, harian, hari beruntun.

const BERBUNYI = new Date("2026-10-07T05:00:00Z");

describe("skor kejadian (contoh emas)", () => {
  it.each(emas.kejadian.map((k) => [k.nama, k] as const))("%s", (_, k) => {
    const bangunPada = k.bangunDtk === null ? null : new Date(BERBUNYI.getTime() + k.bangunDtk * 1000);
    expect(skorKejadian({ status: k.status, uji: k.uji, berbunyiPada: BERBUNYI, bangunPada, jumlahTunda: k.tunda, gagalCek: k.gagalCek })).toBe(k.skor);
  });

  it("menerima tanggal berupa teks ISO (data dari API)", () => {
    expect(skorKejadian({ status: "bangun", uji: false, berbunyiPada: BERBUNYI.toISOString(), bangunPada: "2026-10-07T05:07:00.000Z", jumlahTunda: 0, gagalCek: false })).toBe(95);
    expect(menitSampaiBangun({ berbunyiPada: BERBUNYI, bangunPada: null })).toBe(0);
  });
});

describe("skor harian (contoh emas)", () => {
  it.each(emas.harian.map((k) => [k.nama, k] as const))("%s", (_, k) => {
    expect(skorHarian(k.skor)).toBe(k.hasil);
  });
});

describe("hari beruntun (contoh emas)", () => {
  it.each(emas.beruntun.map((k) => [k.nama, k] as const))("%s", (_, k) => {
    expect(hariBeruntun(new Map(Object.entries(k.hari as Record<string, (number | null)[]>)))).toBe(k.hasil);
  });
});
