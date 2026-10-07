import fc from "fast-check";
import { describe, expect, it } from "vitest";
import emas from "../emas/pengulangan.json";
import { adalahLiburNasional } from "@/lib/jadwal/libur";
import { bakukan, cocok, kejadianBerikutnya, kejadianDalamRentang, SkemaPengulangan, type OpsiKejadian, type Pengulangan } from "@/lib/jadwal/pengulangan";
import { keTanggal, tambahHari, tanggalSah } from "@/lib/jadwal/tanggal";
import { bagianLokal, instanLokal, zonaSah } from "@/lib/jadwal/zona";

type KasusEmas = { nama: string; pengulangan: unknown; jam: string; zona: string; setelah: string; opsi: OpsiKejadian; harapan: string | null; tanggal: string | null };

describe("contoh emas pengulangan", () => {
  const kasus = emas.kasus as KasusEmas[];

  it("ada paling sedikit 40 contoh", () => {
    expect(kasus.length).toBeGreaterThanOrEqual(40);
  });

  it.each(kasus.map((k) => [k.nama, k] as const))("%s", (_, k) => {
    const p = SkemaPengulangan.parse(k.pengulangan);
    const hasil = kejadianBerikutnya(p, k.jam, k.zona, new Date(k.setelah), k.opsi);
    if (k.harapan === null) expect(hasil).toBeNull();
    else {
      expect(hasil?.utc.toISOString()).toBe(new Date(k.harapan).toISOString());
      expect(hasil?.tanggal).toBe(k.tanggal);
    }
  });
});

describe("skema pengulangan", () => {
  it.each([
    [{ jenis: "sekali", tanggal: "2026-02-30" }],
    [{ jenis: "sekali", tanggal: "2026-2-3" }],
    [{ jenis: "hari", hari: [] }],
    [{ jenis: "hari", hari: [7] }],
    [{ jenis: "tiap_minggu", setiap: 1, hari: [1], mulai: "2026-10-05" }],
    [{ jenis: "bulanan_tanggal", tanggal: 32 }],
    [{ jenis: "bulanan_hari_ke", ke: 5, hari: 1 }],
    [{ jenis: "harian", lain: true }],
    [{ jenis: "tahunan" }],
  ])("menolak %j", (masukan) => {
    expect(SkemaPengulangan.safeParse(masukan).success).toBe(false);
  });

  it("merapikan daftar hari (unik, urut)", () => {
    expect(SkemaPengulangan.parse({ jenis: "hari", hari: [5, 1, 5, 3] })).toEqual({ jenis: "hari", hari: [1, 3, 5] });
  });

  it("membakukan hari pilihan yang sama dengan jenis khusus", () => {
    expect(bakukan({ jenis: "hari", hari: [0, 1, 2, 3, 4, 5, 6] })).toEqual({ jenis: "harian" });
    expect(bakukan({ jenis: "hari", hari: [1, 2, 3, 4, 5] })).toEqual({ jenis: "hari_kerja" });
    expect(bakukan({ jenis: "hari", hari: [0, 6] })).toEqual({ jenis: "akhir_pekan" });
    expect(bakukan({ jenis: "hari", hari: [1, 3] })).toEqual({ jenis: "hari", hari: [1, 3] });
  });
});

describe("zona", () => {
  it("mengenali zona IANA", () => {
    expect(zonaSah("Asia/Jakarta")).toBe(true);
    expect(zonaSah("Bulan/Purnama")).toBe(false);
    expect(zonaSah("")).toBe(false);
  });

  it("bolak-balik tanggal-jam lokal dan instan", () => {
    const t = instanLokal("2026-10-08", 5, 0, "Asia/Jakarta");
    expect(t.toISOString()).toBe("2026-10-07T22:00:00.000Z");
    expect(bagianLokal(t, "Asia/Jakarta")).toEqual({ tanggal: "2026-10-08", jam: 5, menit: 0 });
  });
});

// ------------------------------------------------------------------ tes properti

const ZONA = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "America/New_York", "Europe/London", "Australia/Lord_Howe", "Asia/Kolkata"];
const AWAL = Date.UTC(2026, 0, 1);
const AKHIR = Date.UTC(2028, 11, 31);

const tanggalAcak = fc.integer({ min: 0, max: Math.floor((AKHIR - AWAL) / 86_400_000) }).map((n) => tambahHari("2026-01-01", n));
const hariAcak = fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 });

const berulang: fc.Arbitrary<Pengulangan> = fc
  .oneof(
    fc.constant({ jenis: "harian" }),
    fc.constant({ jenis: "hari_kerja" }),
    fc.constant({ jenis: "akhir_pekan" }),
    hariAcak.map((hari) => ({ jenis: "hari", hari })),
    fc.record({ jenis: fc.constant("tiap_minggu"), setiap: fc.integer({ min: 2, max: 12 }), hari: hariAcak, mulai: tanggalAcak }),
    fc.record({ jenis: fc.constant("bulanan_tanggal"), tanggal: fc.integer({ min: 1, max: 31 }) }),
    fc.record({ jenis: fc.constant("bulanan_hari_ke"), ke: fc.constantFrom(1, 2, 3, 4, -1), hari: fc.integer({ min: 0, max: 6 }) }),
  )
  .map((p) => SkemaPengulangan.parse(p));

const sekali: fc.Arbitrary<Pengulangan> = tanggalAcak.map((tanggal) => ({ jenis: "sekali", tanggal }));
const jamAcak = fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 })).map(([h, m]) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
const instanAcak = fc.integer({ min: AWAL, max: AKHIR }).map((t) => new Date(t));
const opsiAcak = fc.record({ lewati: fc.uniqueArray(tanggalAcak, { maxLength: 6 }), liburNasional: fc.boolean() });

function dilompati(tanggal: string, opsi: OpsiKejadian) {
  return [...(opsi.lewati ?? [])].includes(tanggal) || (!!opsi.liburNasional && adalahLiburNasional(tanggal));
}

describe("properti pengulangan", () => {
  it("hasil sesudah titik awal, cocok aturan, tidak dilewati, dan jamnya benar", () => {
    fc.assert(
      fc.property(fc.oneof(berulang, sekali), jamAcak, fc.constantFrom(...ZONA), instanAcak, opsiAcak, (p, jam, zona, setelah, opsi) => {
        const k = kejadianBerikutnya(p, jam, zona, setelah, opsi);
        if (!k) return p.jenis === "sekali";
        const [hh, mm] = jam.split(":").map(Number);
        return k.utc > setelah && cocok(p, k.tanggal) && !dilompati(k.tanggal, opsi) && k.utc.getTime() === instanLokal(k.tanggal, hh, mm, zona).getTime();
      }),
      { numRuns: 400 },
    );
  });

  it("tidak ada kejadian sah yang terlewat di antara titik awal dan hasil", () => {
    fc.assert(
      fc.property(berulang, jamAcak, fc.constantFrom(...ZONA), instanAcak, opsiAcak, (p, jam, zona, setelah, opsi) => {
        const k = kejadianBerikutnya(p, jam, zona, setelah, opsi);
        if (!k) return false;
        const [hh, mm] = jam.split(":").map(Number);
        // Periksa setiap tanggal dari sehari sebelum titik awal sampai sebelum hasil.
        for (let d = tambahHari(bagianLokal(setelah, zona).tanggal, -1); d < k.tanggal; d = tambahHari(d, 1)) {
          if (cocok(p, d) && !dilompati(d, opsi) && instanLokal(d, hh, mm, zona) > setelah) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it("semua jenis berulang benar-benar berulang: 12 kejadian berturut naik dan berbeda tanggal", () => {
    fc.assert(
      fc.property(berulang, jamAcak, fc.constantFrom(...ZONA), instanAcak, fc.boolean(), (p, jam, zona, setelah, liburNasional) => {
        let titik = setelah;
        const tanggal = new Set<string>();
        for (let i = 0; i < 12; i++) {
          const k = kejadianBerikutnya(p, jam, zona, titik, { liburNasional });
          if (!k || k.utc <= titik || tanggal.has(k.tanggal)) return false;
          tanggal.add(k.tanggal);
          titik = k.utc;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it("sekali hanya berbunyi satu kali", () => {
    fc.assert(
      fc.property(sekali, jamAcak, fc.constantFrom(...ZONA), instanAcak, (p, jam, zona, setelah) => {
        const k = kejadianBerikutnya(p, jam, zona, setelah);
        return !k || kejadianBerikutnya(p, jam, zona, k.utc) === null;
      }),
    );
  });

  it("rentang sama dengan memanggil berikutnya berulang", () => {
    fc.assert(
      fc.property(berulang, jamAcak, fc.constantFrom(...ZONA), instanAcak, (p, jam, zona, dari) => {
        const sampai = new Date(dari.getTime() + 21 * 86_400_000);
        const daftar = kejadianDalamRentang(p, jam, zona, dari, sampai);
        let titik = dari;
        for (const k of daftar) {
          const n = kejadianBerikutnya(p, jam, zona, titik);
          if (!n || n.utc.getTime() !== k.utc.getTime()) return false;
          titik = k.utc;
        }
        const lanjut = kejadianBerikutnya(p, jam, zona, titik);
        return !lanjut || lanjut.utc > sampai;
      }),
      { numRuns: 150 },
    );
  });

  it("tanggal kalender selalu sah", () => {
    fc.assert(fc.property(tanggalAcak, (d) => tanggalSah(d) && keTanggal(...(d.split("-").map(Number) as [number, number, number])) === d));
  });
});
