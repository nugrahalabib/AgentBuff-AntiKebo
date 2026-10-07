import { describe, expect, it } from "vitest";
import { idSah, PembatasLaju } from "@/lib/keamanan/laju";

// Pembatas laju bersama (P13): menghitung per jendela, petanya terbatas, dan TIDAK PERNAH
// dikosongkan sekaligus oleh banjir kunci acak.

describe("PembatasLaju", () => {
  it("lolos sampai batas, lalu menunggu sampai jendela berikutnya", () => {
    const l = new PembatasLaju();
    for (let i = 0; i < 3; i++) expect(l.tunggu("a", 3, 60_000, 1_000)).toBe(0);
    expect(l.tunggu("a", 3, 60_000, 11_000)).toBe(50_000);
    expect(l.tunggu("a", 3, 60_000, 61_000)).toBe(0);
  });

  it("banjir kunci acak tidak menghapus batas yang masih berjalan; jendela basi dibuang lebih dulu", () => {
    const l = new PembatasLaju(100);
    for (let i = 0; i < 60; i++) l.tunggu(`basi:${i}`, 1, 60_000, 0);
    // Kunci korban sudah melewati batasnya, jendelanya masih berjalan.
    l.tunggu("korban", 1, 60_000, 50_000);
    expect(l.tunggu("korban", 1, 60_000, 50_001)).toBeGreaterThan(0);
    for (let i = 0; i < 39; i++) l.tunggu(`acak:${i}`, 1, 60_000, 61_000);
    // Penuh: 60 jendela basi dibuang, korban tetap terbatas.
    for (let i = 39; i < 80; i++) l.tunggu(`acak:${i}`, 1, 60_000, 61_000);
    expect(l.ukuran).toBeLessThanOrEqual(100);
    expect(l.tunggu("korban", 1, 60_000, 61_000)).toBeGreaterThan(0);
  });

  it("peta tidak pernah melebihi batas walau semua jendela masih berjalan", () => {
    const l = new PembatasLaju(50);
    for (let i = 0; i < 500; i++) l.tunggu(`k:${i}`, 1, 60_000, i);
    expect(l.ukuran).toBeLessThanOrEqual(50);
    expect(l.ukuran).toBeGreaterThan(0);
  });

  it("kunci panjang dipotong", () => {
    const l = new PembatasLaju();
    expect(l.tunggu("x".repeat(10_000), 1, 60_000, 0)).toBe(0);
    expect(l.tunggu("x".repeat(9_000), 1, 60_000, 1)).toBeGreaterThan(0);
  });
});

describe("idSah", () => {
  it("hanya uuid", () => {
    expect(idSah("7ec4746f-01f7-4c2c-81e2-c599a6d6bd21")).toBe(true);
    for (const x of ["", "abc", "7ec4746f01f74c2c81e2c599a6d6bd21", null, 42, "7ec4746f-01f7-4c2c-81e2-c599a6d6bd21x"]) expect(idSah(x)).toBe(false);
  });
});
