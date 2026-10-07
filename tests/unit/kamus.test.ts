import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/kamus/en";
import { id } from "@/lib/i18n/kamus/id";
import { isi } from "@/lib/i18n";

// Semua teks UI lewat kamus id + en (CLAUDE.md §5.8): bentuk sama, tidak kosong, tanpa tanda pisah panjang.

function daun(o: unknown, jalur = ""): Array<[string, string]> {
  if (typeof o === "string") return [[jalur, o]];
  if (Array.isArray(o)) return o.flatMap((x, i) => daun(x, `${jalur}[${i}]`));
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => daun(v, jalur ? `${jalur}.${k}` : k));
}

describe("kamus", () => {
  const a = daun(id);
  const b = daun(en);
  it("id dan en punya kunci yang sama persis", () => {
    expect(b.map(([k]) => k)).toEqual(a.map(([k]) => k));
  });
  it("tidak ada teks kosong, tanda pisah panjang, atau placeholder yang hilang", () => {
    for (const [k, v] of [...a, ...b]) {
      expect(v.trim(), k).not.toBe("");
      expect(v, k).not.toMatch(/[–—]/);
    }
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (let i = 0; i < a.length; i++) expect(ph(b[i][1]), a[i][0]).toEqual(ph(a[i][1]));
  });
  it("isi() mengganti placeholder", () => {
    expect(isi(id.pengaturan.masukSebagai, { email: "a@b.c" })).toBe("Masuk sebagai a@b.c");
    expect(isi("{x} {y}", { x: 1 })).toBe("1 {y}");
  });
});
