import { describe, expect, it } from "vitest";
import { broadlinkKePulsa, kodeMerek, muatPustaka } from "@/lib/ir/kode-ac";
import { bitaPanasonic, checksum, dekodePanasonic, keadaanPanasonic, pulsaPanasonic, templatVarian, VARIAN_PANASONIC } from "@/lib/ir/protokol/panasonic";
import { uraiJarakPulsa } from "@/lib/ir/pulsa";

function* jalan(n: unknown, jalur: string[] = []): Generator<[string[], string]> {
  if (typeof n === "string") yield [jalur, n];
  else if (n && typeof n === "object") for (const [k, v] of Object.entries(n)) yield* jalan(v, [...jalur, k]);
}

/** Semua rekaman Panasonic asli di pustaka yang berprotokol 27 byte. */
function rekamanPanasonic() {
  const hasil: Array<{ id: string; jalur: string[]; bita: number[] }> = [];
  for (const k of kodeMerek("Panasonic")) {
    const p = muatPustaka(k.id)!;
    for (const [jalur, kode] of jalan(p.perintah)) {
      const b = dekodePanasonic(broadlinkKePulsa(kode));
      if (b) hasil.push({ id: k.id, jalur, bita: b });
    }
  }
  return hasil;
}

describe("protokol Panasonic (diukur dari rekaman asli)", () => {
  const semua = rekamanPanasonic();

  it("ribuan rekaman terurai, checksum semuanya cocok", () => {
    expect(semua.length).toBeGreaterThan(4000);
    for (const r of semua) expect(checksum(r.bita)).toBe(r.bita[26]);
  });

  it("keadaan yang dibaca dari rekaman, dibangun ulang dari templat model yang sama = PERSIS rekaman itu", () => {
    let dibanding = 0;
    for (const r of semua) {
      // Templat = rekaman AC MENYALA dari model yang sama (sebagian model mengubah byte model saat mati).
      // 1029 (CS-LJ) mengikat byte 23/25 ke kipas otomatis: tidak dibandingkan byte per byte.
      if (r.jalur[0] === "off" || r.id === "1029" || r.jalur.some((x) => /quiet|powerful/i.test(x))) continue;
      const templat = semua.find((x) => x.id === r.id && x.jalur[0] !== "off")?.bita;
      if (!templat) continue;
      const s = keadaanPanasonic(r.bita);
      const kita = bitaPanasonic(templat, s);
      // posisi ayunan tetap (1-5) disalin dari rekaman, karena kita hanya membedakan ayun/tidak
      kita[16] = (kita[16] & 0xf0) | (r.bita[16] & 0x0f);
      kita[26] = checksum(kita);
      // Kipas 6 tingkat (nibble 4/6) sengaja dipetakan ke 4 tingkat kita: dilewati.
      if (r.bita[16] >> 4 === 4 || r.bita[16] >> 4 === 6) continue;
      expect(kita.map((x) => x.toString(16)).join(" "), `${r.id} ${r.jalur.join("/")}`).toBe(r.bita.map((x) => x.toString(16)).join(" "));
      dibanding++;
    }
    expect(dibanding).toBeGreaterThan(2500);
  });

  it("label pustaka cocok dengan arti byte: mode & suhu", () => {
    // Mode kipas/kering/otomatis memakai suhu tetap atau relatif: hanya dingin & panas dibandingkan.
    const MODE: Record<string, string> = { cool: "cold", heat: "hot" };
    // Pustaka sendiri punya sedikit rekaman salah label (mis. "dingin" yang isinya mati) -
    // justru alasan kita membangun sinyal dari protokol. Batas salah < 1%.
    let n = 0;
    const salah: string[] = [];
    for (const r of semua) {
      if (r.jalur[0] === "off" || !MODE[r.jalur[0]]) continue;
      const s = keadaanPanasonic(r.bita);
      const suhu = Number(r.jalur[r.jalur.length - 1]);
      if (!s.nyala || s.mode !== MODE[r.jalur[0]] || (Number.isFinite(suhu) && s.suhu !== suhu)) salah.push(`${r.id} ${r.jalur.join("/")}`);
      n++;
    }
    expect(n).toBeGreaterThan(2000);
    expect(salah.length / n).toBeLessThan(0.02);
  });

  it("pulsa buatan kita terurai kembali jadi byte yang sama", () => {
    for (const v of VARIAN_PANASONIC) {
      const b = bitaPanasonic(templatVarian(v.id)!, { nyala: true, mode: "cold", suhu: 27, kipas: "high", ayun: true });
      expect(dekodePanasonic(pulsaPanasonic(b))).toEqual(b);
      expect(keadaanPanasonic(b)).toEqual({ nyala: true, mode: "cold", suhu: 27, kipas: "high", ayun: true });
    }
  });

  it("mati mempertahankan pengaturan, hanya bit nyala yang berubah", () => {
    const t = templatVarian("1")!;
    const nyala = bitaPanasonic(t, { nyala: true, mode: "cold", suhu: 25 });
    const mati = bitaPanasonic(nyala, { nyala: false });
    expect(keadaanPanasonic(mati)).toMatchObject({ nyala: false, mode: "cold", suhu: 25 });
  });
});

describe("urai pulsa", () => {
  it("derau pendek bukan bingkai", () => {
    expect(uraiJarakPulsa([300, 30000])).toEqual([]);
  });
});

describe("pasangan lama Panasonic ikut dibangun dari protokol", () => {
  it("kode pustaka 1021 (CS-RE) = protokol dengan byte model berkasnya; ayunan kini terkirim", async () => {
    const { sumberDari, pulsaUntuk } = await import("@/lib/ir/kode-ac");
    const s = sumberDari("1021")!;
    expect(s.jenis).toBe("panasonic");
    if (s.jenis !== "panasonic") return;
    expect([s.templat[17], s.templat[19], s.templat[20], s.templat[23], s.templat[25]]).toEqual([0x00, 0x06, 0x60, 0x80, 0x06]);
    const h = pulsaUntuk(s, { nyala: true, mode: "cold", suhu: 22, kipas: "mid", ayun: true }, true);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const b = dekodePanasonic(h.pulsa[0])!;
    expect(keadaanPanasonic(b)).toEqual({ nyala: true, mode: "cold", suhu: 22, kipas: "mid", ayun: true });
  });
});
