import fc from "fast-check";
import { describe, expect, it } from "vitest";
import emas from "../emas/urutan-suara.json";
import { MENIT_WAKTU, NASKAH_KARAKTER } from "@/lib/suara/karakter";
import { hashKalimat, naskahAlarm } from "@/lib/suara/naskah";
import { bolehDiucapkan, temukanTerlarang } from "@/lib/suara/saring";
import { bahanUrutan } from "@/lib/suara/pemutar";
import { berikutnya, mulaiUrutan } from "@/lib/suara/urutan";

describe("naskah karakter (docs/10-SUARA.md §2)", () => {
  const semua = Object.entries(NASKAH_KARAKTER).flatMap(([id, n]) => (["id", "en"] as const).map((b) => [`${id} ${b}`, n[b]] as const));

  it.each(semua)("%s: ≥ 12 umum, 5 waktu, 3 agenda, cek, penutup; semua memakai {nama} atau {agenda}", (_, n) => {
    expect(n.umum.length).toBeGreaterThanOrEqual(12);
    expect(Object.keys(n.waktu).map(Number)).toEqual([...MENIT_WAKTU]);
    expect(n.agenda).toHaveLength(3);
    for (const t of n.agenda) expect(t).toContain("{agenda}");
    for (const t of [...n.umum, ...Object.values(n.waktu), n.cek, n.penutup]) expect(t).toContain("{nama}");
  });

  it.each(semua)("%s: maks 150 huruf (nama 20 huruf), lolos penyaring, tanpa tanda pisah panjang, tanpa kembar", (_, n) => {
    const kalimat = [...n.umum, ...Object.values(n.waktu), ...n.agenda, n.cek, n.penutup];
    expect(new Set(kalimat).size).toBe(kalimat.length);
    for (const t of kalimat) {
      const isi = t.replace(/\{nama\}/g, "x".repeat(20)).replace(/\{agenda\}/g, "x".repeat(20));
      expect(Array.from(isi).length, t).toBeLessThanOrEqual(150);
      expect(temukanTerlarang(t), t).toBeNull();
      expect(t).not.toMatch(/[–—]/);
    }
  });
});

describe("penyaring kata", () => {
  it.each(["kontol lu", "K0nt0lll", "k o n t o l", "dasar kafir", "aku bunuh kamu", "mati lu", "Ngentotin", "anjing lu", "I will kill you"])("menolak %j", (t) => {
    expect(bolehDiucapkan(t)).toBe(false);
  });
  it.each(["Bangun woy, kampret!", "Anjir, masih tidur?", "Presentasi jam 9", "Dasar bego, bangun!", "Cocktail party nanti malam", "Grape juice", "Ayo sarapan"])(
    "membolehkan %j",
    (t) => {
      expect(bolehDiucapkan(t)).toBe(true);
    },
  );
});

describe("naskah satu alarm", () => {
  const dasar = { karakter: "pelatih_tentara" as const, bahasa: "id" as const, nama: "Nugi", agenda: "Presentasi klien", suaraId: null, pribadi: ["Ingat cicilan, Nugi!"] };

  it("berisi umum, waktu, agenda, cek, penutup, pribadi dengan nama dan agenda terisi", () => {
    const k = naskahAlarm(dasar);
    expect(k.filter((x) => x.jenis === "umum")).toHaveLength(12);
    expect(k.filter((x) => x.jenis === "waktu").map((x) => x.menit)).toEqual([3, 5, 10, 15, 30]);
    expect(k.filter((x) => x.jenis === "agenda").every((x) => x.teks.includes("Presentasi klien"))).toBe(true);
    expect(k.filter((x) => x.jenis === "pribadi").map((x) => x.teks)).toEqual(["Ingat cicilan, Nugi!"]);
    expect(k.every((x) => !x.teks.includes("{"))).toBe(true);
    expect(k.find((x) => x.jenis === "umum")?.teks).toBe("BANGUN, Nugi! Ini bukan hari libur!");
  });

  it("tanpa agenda = tanpa kalimat agenda; kustom = hanya pribadi", () => {
    expect(naskahAlarm({ ...dasar, agenda: null }).some((x) => x.jenis === "agenda")).toBe(false);
    expect(naskahAlarm({ ...dasar, karakter: "kustom" }).map((x) => x.jenis)).toEqual(["pribadi"]);
  });

  it("kunci klip berubah hanya bila teks, suara, gaya, atau bahasa berubah (pakai ulang, PRD F7)", () => {
    const a = naskahAlarm(dasar).map((x) => x.hash);
    expect(naskahAlarm({ ...dasar, pribadi: [] }).map((x) => x.hash)).toEqual(a.slice(0, -1));
    expect(naskahAlarm({ ...dasar, suaraId: "v-2" })[0].hash).not.toBe(a[0]);
    expect(naskahAlarm({ ...dasar, nama: "Rani" })[0].hash).not.toBe(a[0]);
    expect(hashKalimat("x", null, "id")).not.toBe(hashKalimat("x", null, "en"));
    expect(hashKalimat("x", null, "id")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("contoh emas urutan putar (docs/10-SUARA.md §3)", () => {
  it.each(emas.kasus.map((k) => [k.nama, k] as const))("%s", (_, k) => {
    const bahan = Array.from({ length: k.jumlahBahan }, (_, i) => ({ id: `u${i}` }));
    const waktu = k.menitWaktu.map((m) => ({ id: `w${m}`, menit: m }));
    let s = mulaiUrutan();
    const hasil: Array<string | null> = [];
    for (const t of k.berlaluMs) {
      const r = berikutnya(bahan, waktu, k.benih, s, t);
      hasil.push(r.id);
      s = r.keadaan;
    }
    expect(hasil).toEqual(k.harapan);
  });
});

describe("properti urutan putar", () => {
  it("tidak ada kalimat sama berturut-turut, dan semua terpakai sebelum ada yang diulang", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 25 }), fc.integer({ min: 0, max: 0xffffffff }), (n, benih) => {
        const bahan = Array.from({ length: n }, (_, i) => ({ id: `u${i}` }));
        let s = mulaiUrutan();
        const hasil: string[] = [];
        for (let i = 0; i < n * 3; i++) {
          const r = berikutnya(bahan, [], benih, s, i * 6000);
          hasil.push(r.id!);
          s = r.keadaan;
        }
        for (let i = 1; i < hasil.length; i++) if (hasil[i] === hasil[i - 1]) return false;
        for (let p = 0; p < 3; p++) if (new Set(hasil.slice(p * n, p * n + n)).size !== n) return false;
        return true;
      }),
    );
  });

  it("kalimat waktu muncul tepat sekali, sesudah menitnya, berurutan", () => {
    const bahan = Array.from({ length: 12 }, (_, i) => ({ id: `u${i}` }));
    const waktu = MENIT_WAKTU.map((m) => ({ id: `w${m}`, menit: m }));
    let s = mulaiUrutan();
    const muncul: Array<[string, number]> = [];
    for (let t = 0; t <= 31 * 60_000; t += 6000) {
      const r = berikutnya(bahan, waktu, 77, s, t);
      if (r.id?.startsWith("w")) muncul.push([r.id, t]);
      s = r.keadaan;
    }
    expect(muncul.map(([id]) => id)).toEqual(["w3", "w5", "w10", "w15", "w30"]);
    for (const [id, t] of muncul) expect(t).toBeGreaterThanOrEqual(Number(id.slice(1)) * 60_000);
  });
});

describe("bahan pemutar dari omelan perangkat", () => {
  it("umum, agenda, pribadi = bahan acak; waktu = sisipan menit; cek dan penutup tidak diputar saat berbunyi", () => {
    const n = naskahAlarm({ karakter: "bos_killer", bahasa: "id", nama: "Nugi", agenda: "Rapat", suaraId: null, pribadi: ["Kopi!"] });
    const { bahan, waktu } = bahanUrutan(n.map((k) => ({ jenis: k.jenis, menit: k.menit, teks: k.teks, klip: null })));
    expect(bahan.map((b) => n[Number(b.id)].jenis).every((j) => j === "umum" || j === "agenda" || j === "pribadi")).toBe(true);
    expect(bahan).toHaveLength(n.filter((k) => ["umum", "agenda", "pribadi"].includes(k.jenis)).length);
    expect(waktu.map((w) => w.menit)).toEqual([3, 5, 10, 15, 30]);
    expect(waktu.every((w) => n[Number(w.id)].jenis === "waktu")).toBe(true);
  });
});
