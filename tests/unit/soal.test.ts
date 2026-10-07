import fc from "fast-check";
import { describe, expect, it } from "vitest";
import emas from "../emas/soal.json";
import { Acak } from "@/lib/soal/acak";
import { bakukanJawaban, benihLuring, buatHitungan, buatSoal, jawabanBenar, periksaLuring, sesudahJawab, type JenisSoalDibuat, type Tingkat } from "@/lib/soal/soal";

// Contoh emas soal: berkas yang SAMA dipakai aplikasi PC (Rust, P10). Dibuat oracle Python
// terpisah, jadi kecocokan di sini membuktikan aturan TypeScript sesuai spesifikasi.

describe("contoh emas soal", () => {
  it.each(emas.prng.map((p) => [p.benih, p] as const))("mulberry32 benih %i", (_, p) => {
    const r = new Acak(p.benih);
    expect(Array.from({ length: p.keluaran.length }, () => r.berikut())).toEqual(p.keluaran);
  });

  it.each(emas.kasus.map((k) => [`${k.jenis} ${k.tingkat} benih ${k.benih}`, k] as const))("%s", (_, k) => {
    const s = buatSoal(k.jenis as JenisSoalDibuat, k.tingkat as Tingkat, k.benih, (k as { sumber?: string[] }).sumber ?? []);
    expect({ teks: s.teks, jawaban: s.jawaban }).toEqual({ teks: k.teks, jawaban: k.jawaban });
  });

  it.each(emas.luring.map((l) => [`${l.kunci} #${l.i}`, l] as const))("benih luring %s", async (_, l) => {
    expect(await benihLuring(l.kunci, l.i)).toBe(l.benih);
  });
});

describe("aturan hitungan (PRD §15)", () => {
  const POLA: Record<Tingkat, RegExp[]> = {
    ringan: [/^(\d+) \+ (\d+)$/, /^(\d+) − (\d+)$/],
    sedang: [/^(\d+) × (\d+) \+ (\d+)$/, /^(\d+) × (\d+) − (\d+)$/],
    berat: [/^\((\d+) \+ (\d+)\) × (\d+) − (\d+)$/, /^(\d+)² \+ (\d+)$/],
  };

  it.each(["ringan", "sedang", "berat"] as const)("%s: bentuk dan rentang benar, jawaban 1 sampai 999, cocok dengan teksnya", (tingkat) => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (benih) => {
        const s = buatHitungan(tingkat, benih);
        const n = Number(s.jawaban);
        if (!Number.isInteger(n) || n < 1 || n > 999) return false;
        const [p0, p1] = POLA[tingkat];
        const m0 = p0.exec(s.teks);
        const m1 = p1.exec(s.teks);
        const v = (m0 ?? m1)?.slice(1).map(Number);
        if (!v) return false;
        const dalam = (x: number, lo: number, hi: number) => x >= lo && x <= hi;
        if (tingkat === "ringan") return m0 ? v.every((x) => dalam(x, 12, 89)) && v[0] + v[1] === n : v.every((x) => dalam(x, 12, 89)) && v[0] - v[1] === n;
        if (tingkat === "sedang") return dalam(v[0], 3, 12) && dalam(v[1], 3, 9) && dalam(v[2], 5, 40) && (m0 ? v[0] * v[1] + v[2] : v[0] * v[1] - v[2]) === n;
        return m0
          ? dalam(v[0], 2, 15) && dalam(v[1], 2, 15) && dalam(v[2], 3, 9) && dalam(v[3], 1, 40) && (v[0] + v[1]) * v[2] - v[3] === n
          : dalam(v[0], 6, 15) && dalam(v[1], 5, 40) && v[0] * v[0] + v[1] === n;
      }),
      { numRuns: 3000 },
    );
  });

  it("kedua bentuk tiap tingkat benar-benar muncul", () => {
    for (const t of ["ringan", "sedang", "berat"] as const) {
      const bentuk = new Set(Array.from({ length: 200 }, (_, i) => (/[−]/.test(buatHitungan(t, i * 7919).teks) && !/\(/.test(buatHitungan(t, i * 7919).teks) ? "kurang" : "lain")));
      if (t !== "berat") expect(bentuk.size).toBe(2);
    }
    expect(new Set(Array.from({ length: 200 }, (_, i) => buatHitungan("berat", i).teks.includes("²"))).size).toBe(2);
  });
});

describe("pemeriksa jawaban", () => {
  it("hitungan: spasi dan nol di depan diabaikan, huruf ditolak", () => {
    const s = { jenis: "hitungan" as const, jawaban: "69" };
    expect(jawabanBenar(s, "69")).toBe(true);
    expect(jawabanBenar(s, " 0 69 ")).toBe(true);
    expect(jawabanBenar(s, "68")).toBe(false);
    expect(jawabanBenar(s, "69a")).toBe(false);
    expect(jawabanBenar(s, "")).toBe(false);
  });

  it("ketik: huruf besar/kecil dan spasi ganda diabaikan, ejaan tidak", () => {
    const s = { jenis: "ketik" as const, jawaban: "Presentasi klien jam sembilan" };
    expect(jawabanBenar(s, "presentasi  KLIEN jam sembilan ")).toBe(true);
    expect(jawabanBenar(s, "presentasi klien jam 9")).toBe(false);
  });

  it("ingat: deret angka persis", () => {
    const s = { jenis: "ingat" as const, jawaban: "482910" };
    expect(jawabanBenar(s, "482 910")).toBe(true);
    expect(jawabanBenar(s, "482911")).toBe(false);
    expect(bakukanJawaban("ingat", "012345")).toBe("012345");
  });
});

describe("urutan dan turun tingkat (PRD D1, D6)", () => {
  it.each([
    ["benar menambah beruntun", { tingkat: "berat", benarBeruntun: 1, salahBeruntun: 0 }, true, { tingkat: "berat", benarBeruntun: 2, salahBeruntun: 0 }],
    ["salah mengulang dari nol", { tingkat: "berat", benarBeruntun: 2, salahBeruntun: 0 }, false, { tingkat: "berat", benarBeruntun: 0, salahBeruntun: 1 }],
    ["salah ketiga turun tingkat", { tingkat: "berat", benarBeruntun: 0, salahBeruntun: 2 }, false, { tingkat: "sedang", benarBeruntun: 0, salahBeruntun: 0 }],
    ["sedang turun ke ringan", { tingkat: "sedang", benarBeruntun: 0, salahBeruntun: 2 }, false, { tingkat: "ringan", benarBeruntun: 0, salahBeruntun: 0 }],
    ["ringan tetap ringan", { tingkat: "ringan", benarBeruntun: 0, salahBeruntun: 2 }, false, { tingkat: "ringan", benarBeruntun: 0, salahBeruntun: 0 }],
    ["benar memutus deret salah", { tingkat: "sedang", benarBeruntun: 0, salahBeruntun: 2 }, true, { tingkat: "sedang", benarBeruntun: 1, salahBeruntun: 0 }],
  ] as const)("%s", (_, awal, benar, akhir) => {
    expect(sesudahJawab(awal, benar)).toEqual(akhir);
  });
});

describe("pemeriksaan ulang jawaban luring (PRD D8)", () => {
  const KUNCI = "0b5a6e1e-6f39-4b5c-9a33-1c2d3e4f5a6b:2026-10-08";

  async function jawabanBenarLuring(awal: Tingkat, pola: boolean[]): Promise<string[]> {
    // Simulasikan aplikasi PC: soal ke-i dari benih luring, tingkat mengikuti aturan turun.
    let k = { tingkat: awal, benarBeruntun: 0, salahBeruntun: 0 };
    const hasil: string[] = [];
    for (let i = 0; i < pola.length; i++) {
      const s = buatHitungan(k.tingkat, await benihLuring(KUNCI, i));
      hasil.push(pola[i] ? s.jawaban : "0");
      k = sesudahJawab(k, pola[i]);
    }
    return hasil;
  }

  it("lolos dengan jawaban benar berturut-turut sesuai target", async () => {
    expect(await periksaLuring(KUNCI, "sedang", 2, await jawabanBenarLuring("sedang", [true, true]))).toEqual({ lolos: true, dipakai: 2 });
  });

  it("salah tiga kali turun tingkat, lalu lolos di tingkat bawah", async () => {
    const j = await jawabanBenarLuring("berat", [false, false, false, true, true]);
    expect(await periksaLuring(KUNCI, "berat", 2, j)).toEqual({ lolos: true, dipakai: 5 });
  });

  it("jawaban yang tidak sesuai soal turunan kunci ini tidak lolos", async () => {
    expect((await periksaLuring(KUNCI, "ringan", 2, ["1", "2", "3"])).lolos).toBe(false);
    const lain = await jawabanBenarLuring("sedang", [true, true]);
    expect((await periksaLuring("kunci-lain:2026-10-08", "sedang", 2, lain)).lolos).toBe(false);
  });
});
