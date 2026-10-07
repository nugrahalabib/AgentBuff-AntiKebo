import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifes from "../../public/bunyi/bunyi.json";
import { bangunBunyi, ID_BUNYI, kekerasan, LAJU, sampelMentah, TARGET_LUFS } from "@/lib/bunyi/sintesis";

// Bunyi alarm (PRD F1): minimal 8, dibuat skrip (deterministik), kekerasan setara, bisa diulang
// tanpa celah, berkas di repo = hasil skrip.

const FOLDER = path.resolve(import.meta.dirname, "../../public/bunyi");

describe("bunyi alarm buatan sendiri", () => {
  it("ada 8 bunyi dan manifes mencatat semuanya", () => {
    expect(ID_BUNYI).toHaveLength(8);
    expect(manifes.bunyi.map((b) => b.id)).toEqual([...ID_BUNYI]);
  });

  it.each([...ID_BUNYI])("%s: berkas repo sama persis dengan hasil skrip, 2 sampai 6 dtk, kekerasan dan puncak sesuai", (id) => {
    const b = bangunBunyi(id);
    const berkas = readFileSync(path.join(FOLDER, `${id}.wav`));
    expect(Buffer.compare(berkas, Buffer.from(b.wav))).toBe(0);
    expect(b.durasiMs).toBeGreaterThanOrEqual(2_000);
    expect(b.durasiMs).toBeLessThanOrEqual(6_000);
    expect(Math.abs(b.lufs - TARGET_LUFS)).toBeLessThanOrEqual(1);
    expect(b.puncakDb).toBeLessThanOrEqual(-1.5);
    // Titik potong ulang di (dekat) nol: tepi awal dan akhir senyap atau nyaris.
    const pcm = new Int16Array(b.wav.buffer.slice(44));
    expect(Math.abs(pcm[0])).toBeLessThan(200);
    expect(Math.abs(pcm[pcm.length - 1])).toBeLessThan(200);
    const m = manifes.bunyi.find((x) => x.id === id)!;
    expect(m).toMatchObject({ berkas: `/bunyi/${id}.wav`, durasiMs: b.durasiMs, bait: b.wav.length });
  });

  it("pengukur kekerasan: nada sinus 1 kHz amplitudo penuh = sekitar −3 LUFS (acuan BS.1770)", () => {
    const x = new Float64Array(LAJU * 3).map((_, i) => Math.sin((2 * Math.PI * 1000 * i) / LAJU));
    expect(kekerasan(x)).toBeCloseTo(-3.01, 0);
  });

  it("semua bunyi berbeda satu sama lain", () => {
    const sidik = new Set(ID_BUNYI.map((id) => sampelMentah(id).slice(0, 4000).join(",")));
    expect(sidik.size).toBe(8);
  });

  it("berkas lisensi menyatakan dibuat sendiri", () => {
    expect(readFileSync(path.join(FOLDER, "LISENSI.md"), "utf8")).toContain("dibuat sendiri");
  });
});
