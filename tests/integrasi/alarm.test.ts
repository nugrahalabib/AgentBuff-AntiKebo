import { and, eq, sql } from "drizzle-orm";
import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { arahkanDbAplikasi, buatPengguna, siapkanBasisData, type Ujian } from "./harness";

// Layanan alarm, template, preferensi terhadap migrasi ASLI, sebagai antikebo_app (RLS aktif).

let u: Ujian;
const L = () => import("@/lib/layanan/alarm");
const T = () => import("@/lib/layanan/template");
const P = () => import("@/lib/layanan/preferensi");

const wib = (s: string) => new Date(`${s}+07:00`);
const SIANG = wib("2026-10-07T12:00:00"); // Rabu

beforeAll(async () => {
  u = await siapkanBasisData();
  arahkanDbAplikasi(u);
}, 60_000);

async function menunggu(alarmId: string) {
  return u.pekerja((tx) =>
    tx
      .select()
      .from(schema.kejadianAlarm)
      .where(and(eq(schema.kejadianAlarm.alarmId, alarmId), eq(schema.kejadianAlarm.status, "menunggu"))),
  );
}

async function galat(p: Promise<unknown>): Promise<GalatLayanan> {
  try {
    await p;
  } catch (e) {
    if (e instanceof GalatLayanan) return e;
    throw e;
  }
  throw new Error("seharusnya gagal");
}

describe("buat alarm", () => {
  it("cukup jam: sekali di kemunculan berikutnya, isian lain bawaan, satu kejadian menunggu", async () => {
    const A = await buatPengguna(u);
    const { buatAlarm } = await L();
    const a = await buatAlarm(A, { jam: "05:00" }, "web", { sekarang: SIANG });
    expect(a.pengulangan).toEqual({ jenis: "sekali", tanggal: "2026-10-08" });
    expect(a.agendaJudul).toBe("Bangun");
    expect(a.soal).toEqual({ jenis: "hitungan", tingkat: "sedang", benar: 2, kodeQr: [] });
    expect(a.tunda).toEqual({ jatah: 2, menit: 5 });
    expect(a.berikutnya?.utc.toISOString()).toBe("2026-10-07T22:00:00.000Z");
    const m = await menunggu(a.id);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ tanggalLokal: "2026-10-08", jamLokal: "05:00", judul: "Bangun", penggunaId: A });
  });

  it("jam yang belum lewat hari ini berbunyi hari ini", async () => {
    const A = await buatPengguna(u);
    const a = await (await L()).buatAlarm(A, { jam: "18:00", agendaJudul: "Jemput adik" }, "agen", { sekarang: SIANG });
    expect(a.pengulangan).toEqual({ jenis: "sekali", tanggal: "2026-10-07" });
    expect(a.berikutnya?.tanggal).toBe("2026-10-07");
  });

  it("isian bersarang boleh sebagian dan digabung ke bawaan", async () => {
    const A = await buatPengguna(u);
    const a = await (await L()).buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" }, soal: { tingkat: "berat" }, tunda: { jatah: 0 } }, "agen", { sekarang: SIANG });
    expect(a.soal).toEqual({ jenis: "hitungan", tingkat: "berat", benar: 2, kodeQr: [] });
    expect(a.tunda).toEqual({ jatah: 0, menit: 5 });
  });

  it("memakai bawaan pengguna dari Pengaturan", async () => {
    const A = await buatPengguna(u);
    await (await P()).ubahPreferensi(A, { bawaan: { karakter: "pelatih_tentara", tunda: { jatah: 1, menit: 10 } } }, "web");
    const a = await (await L()).buatAlarm(A, { jam: "06:00", pengulangan: { jenis: "hari_kerja" } }, "web", { sekarang: SIANG });
    expect(a.karakter).toBe("pelatih_tentara");
    expect(a.tunda).toEqual({ jatah: 1, menit: 10 });
  });

  it("dari template bawaan Nuklir", async () => {
    const A = await buatPengguna(u);
    const a = await (await L()).buatAlarm(A, {}, "web", { sekarang: SIANG, template: "bawaan:nuklir" });
    expect(a).toMatchObject({ jam: "05:00", bunyi: "nuklir", komitmen: true, karakter: "pelatih_tentara", dariTemplate: "bawaan:nuklir" });
    expect(a.soal).toMatchObject({ tingkat: "berat", benar: 3 });
    expect(a.berikutnya?.tanggal).toBe("2026-10-08");
  });

  it("menolak masukan salah dengan kalimat manusia", async () => {
    const A = await buatPengguna(u);
    const { buatAlarm } = await L();
    const g1 = await galat(buatAlarm(A, { jam: "25:00" }, "web", { sekarang: SIANG }));
    expect(g1.kode).toBe("masukan");
    expect(g1.message).toBe("Ada isian yang belum benar: jam harus format 24 jam, contoh 05:30.");
    const g2 = await galat(buatAlarm(A, { jam: "05:00", agendaJudul: "x".repeat(61) }, "web", { sekarang: SIANG }));
    expect(g2.message).toContain("terlalu panjang");
    const g3 = await galat(buatAlarm(A, { jam: "05:00", soal: { jenis: "qr" } }, "web", { sekarang: SIANG }));
    expect(g3.message).toContain("kode QR");
    const g4 = await galat(buatAlarm(A, { jam: "05:00", rahasia: 1 }, "web", { sekarang: SIANG }));
    expect(g4.kode).toBe("masukan");
    const g5 = await galat(buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "sekali", tanggal: "2026-10-01" } }, "web", { sekarang: SIANG }));
    expect(g5.message).toBe("Waktunya sudah lewat. Pilih jam atau tanggal di depan.");
    const g6 = await galat(buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "sekali", tanggal: "2026-12-25" }, liburNasional: true }, "web", { sekarang: SIANG }));
    expect(g6.message).toContain("tidak akan pernah berbunyi");
  });

  it("pesan galat mengikuti bahasa pengguna", async () => {
    const A = await buatPengguna(u);
    await (await P()).ubahPreferensi(A, { bahasa: "en" }, "web");
    const g = await galat((await L()).buatAlarm(A, { jam: "5" }, "web", { sekarang: SIANG }));
    expect(g.message).toBe("Something isn't right yet: time must be 24 hour format, for example 05:30.");
    const a = await (await L()).buatAlarm(A, { jam: "05:00" }, "web", { sekarang: SIANG });
    expect(a.agendaJudul).toBe("Wake up");
  });

  it("paling banyak 50 alarm", async () => {
    const A = await buatPengguna(u);
    await u.superuser.insert(schema.alarm).values(
      Array.from({ length: 50 }, () => ({
        penggunaId: A,
        jam: "05:00",
        zona: "Asia/Jakarta",
        pengulangan: { jenis: "harian" as const },
        agendaJudul: "Bangun",
        karakter: "ibu_galak",
        bunyi: "klasik",
        soal: { jenis: "hitungan" as const, tingkat: "sedang" as const, benar: 2, kodeQr: [] },
        tunda: { jatah: 2, menit: 5 as const },
        spam: { kanal: [], jedaDtk: null, batasMenit: null },
        masihBangun: { aktif: true, menit: 5, batasDtk: 60 },
        aktif: false,
      })),
    );
    const g = await galat((await L()).buatAlarm(A, { jam: "05:00" }, "web", { sekarang: SIANG }));
    expect(g.message).toBe("Paling banyak 50 alarm. Hapus yang tidak dipakai dulu.");
  });
});

describe("ubah, aktif, hapus, gandakan", () => {
  it("ubah mempertahankan ID alarm dan kejadian menunggunya", async () => {
    const A = await buatPengguna(u);
    const { buatAlarm, ubahAlarm, daftarAlarm } = await L();
    const a = await buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" } }, "web", { sekarang: SIANG });
    const [m0] = await menunggu(a.id);
    const b = await ubahAlarm(A, a.id, { jam: "04:30", agendaJudul: "Lari pagi" }, "web", { sekarang: SIANG });
    expect(b.id).toBe(a.id);
    const m1 = await menunggu(a.id);
    expect(m1).toHaveLength(1);
    expect(m1[0]).toMatchObject({ id: m0.id, jamLokal: "04:30", judul: "Lari pagi" });
    expect(m1[0].jadwalUtc.toISOString()).toBe("2026-10-07T21:30:00.000Z");
    expect(await daftarAlarm(A)).toHaveLength(1);
  });

  it("matikan menghapus kejadian menunggu, nyalakan membuatnya lagi", async () => {
    const A = await buatPengguna(u);
    const { buatAlarm, aturAktifAlarm } = await L();
    const a = await buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" } }, "web", { sekarang: SIANG });
    const mati = await aturAktifAlarm(A, a.id, false, "web", { sekarang: SIANG });
    expect(mati.berikutnya).toBeNull();
    expect(await menunggu(a.id)).toHaveLength(0);
    const nyala = await aturAktifAlarm(A, a.id, true, "web", { sekarang: SIANG });
    expect(nyala.berikutnya?.tanggal).toBe("2026-10-08");
    expect(await menunggu(a.id)).toHaveLength(1);
  });

  it("menyalakan lagi alarm sekali yang sudah lewat = kemunculan jam itu berikutnya", async () => {
    const A = await buatPengguna(u);
    const { buatAlarm, aturAktifAlarm } = await L();
    const a = await buatAlarm(A, { jam: "05:00" }, "web", { sekarang: SIANG });
    await aturAktifAlarm(A, a.id, false, "web", { sekarang: SIANG });
    const b = await aturAktifAlarm(A, a.id, true, "web", { sekarang: wib("2026-10-09T07:00:00") });
    expect(b.pengulangan).toEqual({ jenis: "sekali", tanggal: "2026-10-10" });
  });

  it("hapus: alarm hilang, riwayat kejadian tetap ada", async () => {
    const A = await buatPengguna(u);
    const { buatAlarm, hapusAlarm, ambilAlarm } = await L();
    const a = await buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" } }, "web", { sekarang: SIANG });
    const [lama] = await u.jalan(A, (tx) =>
      tx
        .insert(schema.kejadianAlarm)
        .values({ penggunaId: A, alarmId: a.id, jadwalUtc: wib("2026-10-07T05:00:00"), tanggalLokal: "2026-10-07", jamLokal: "05:00", judul: "Bangun", status: "bangun" })
        .returning(),
    );
    await hapusAlarm(A, a.id, "web", { sekarang: SIANG });
    expect((await galat(ambilAlarm(A, a.id))).kode).toBe("tidak_ditemukan");
    expect(await menunggu(a.id)).toHaveLength(0);
    const [r] = await u.jalan(A, (tx) => tx.select().from(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.id, lama.id)));
    expect(r).toMatchObject({ status: "bangun", alarmId: null, judul: "Bangun" });
  });

  it("gandakan: ID baru, nonaktif, tanpa Komitmen, tanpa kejadian", async () => {
    const A = await buatPengguna(u);
    const { buatAlarm, gandakanAlarm } = await L();
    const a = await buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" }, komitmen: true, agendaJudul: "Kerja" }, "web", { sekarang: SIANG });
    const b = await gandakanAlarm(A, a.id, "web", { sekarang: SIANG });
    expect(b.id).not.toBe(a.id);
    expect(b).toMatchObject({ aktif: false, komitmen: false, agendaJudul: "Kerja", jam: "05:00", berikutnya: null });
    expect(await menunggu(b.id)).toHaveLength(0);
  });

  it("indeks unik menolak kejadian menunggu kedua di tingkat DB", async () => {
    const A = await buatPengguna(u);
    const a = await (await L()).buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" } }, "web", { sekarang: SIANG });
    await expect(
      u.jalan(A, (tx) =>
        tx.insert(schema.kejadianAlarm).values({ penggunaId: A, alarmId: a.id, jadwalUtc: wib("2026-10-09T05:00:00"), tanggalLokal: "2026-10-09", jamLokal: "05:00", judul: "x" }),
      ),
    ).rejects.toThrow();
  });
});

describe("lewati", () => {
  it("lewati sekali lalu batalkan", async () => {
    const A = await buatPengguna(u);
    const { buatAlarm, lewatiBerikutnya, batalLewati } = await L();
    const a = await buatAlarm(A, { jam: "06:00", pengulangan: { jenis: "hari_kerja" } }, "web", { sekarang: wib("2026-10-09T07:00:00") });
    expect(a.berikutnya?.tanggal).toBe("2026-10-12");
    const b = await lewatiBerikutnya(A, a.id, "web", { sekarang: wib("2026-10-09T07:00:00") });
    expect(b.berikutnya?.tanggal).toBe("2026-10-13");
    expect(b.lewati).toEqual(["2026-10-12"]);
    expect(b.aktif).toBe(true);
    const c = await batalLewati(A, a.id, "2026-10-12", "web", { sekarang: wib("2026-10-09T07:00:00") });
    expect(c.berikutnya?.tanggal).toBe("2026-10-12");
    expect(c.lewati).toEqual([]);
  });

  it("lewati tanggal tertentu; tanggal yang memang tidak berbunyi ditolak", async () => {
    const A = await buatPengguna(u);
    const { buatAlarm, lewatiTanggal } = await L();
    const a = await buatAlarm(A, { jam: "06:00", pengulangan: { jenis: "hari_kerja" } }, "web", { sekarang: SIANG });
    const b = await lewatiTanggal(A, a.id, "2026-10-08", "web", { sekarang: SIANG });
    expect(b.berikutnya?.tanggal).toBe("2026-10-09");
    const g = await galat(lewatiTanggal(A, a.id, "2026-10-10", "web", { sekarang: SIANG }));
    expect(g.message).toBe("Alarm ini memang tidak berbunyi pada tanggal itu.");
  });

  it("melewati satu-satunya tanggal alarm sekali ditolak (pakai matikan)", async () => {
    const A = await buatPengguna(u);
    const { buatAlarm, lewatiBerikutnya } = await L();
    const a = await buatAlarm(A, { jam: "05:00" }, "web", { sekarang: SIANG });
    expect((await galat(lewatiBerikutnya(A, a.id, "web", { sekarang: SIANG }))).kode).toBe("masukan");
  });
});

describe("Mode Komitmen ditegakkan layanan", () => {
  const MALAM = wib("2026-10-07T23:00:00");
  async function terkunci() {
    const A = await buatPengguna(u);
    const a = await (await L()).buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" }, komitmen: true }, "web", { sekarang: SIANG });
    return { A, a };
  }

  it("terkunci terlihat di data alarm", async () => {
    const { A, a } = await terkunci();
    const x = await (await L()).ambilAlarm(A, a.id, { sekarang: MALAM });
    expect(x.terkunciSampai?.toISOString()).toBe("2026-10-07T22:00:00.000Z");
    const y = await (await L()).ambilAlarm(A, a.id, { sekarang: SIANG });
    expect(y.terkunciSampai).toBeNull();
  });

  it("hapus, matikan, lewati, mundurkan, dan melemahkan ditolak dengan jam buka", async () => {
    const { A, a } = await terkunci();
    const { hapusAlarm, aturAktifAlarm, lewatiBerikutnya, ubahAlarm } = await L();
    const o = { sekarang: MALAM };
    const g = await galat(hapusAlarm(A, a.id, "agen", o));
    expect(g.kode).toBe("komitmen_terkunci");
    expect(g.message).toBe("Mode Komitmen aktif sampai 05.00. Alarm ini tidak bisa dihapus sebelum berbunyi.");
    expect(g.tambahan).toMatchObject({ alasan: "hapus", terkunciSampai: "2026-10-07T22:00:00.000Z" });
    expect((await galat(aturAktifAlarm(A, a.id, false, "web", o))).tambahan.alasan).toBe("matikan");
    expect((await galat(lewatiBerikutnya(A, a.id, "web", o))).tambahan.alasan).toBe("lewati");
    expect((await galat(ubahAlarm(A, a.id, { jam: "05:30" }, "web", o))).tambahan.alasan).toBe("mundur");
    expect((await galat(ubahAlarm(A, a.id, { komitmen: false }, "web", o))).tambahan.alasan).toBe("komitmen_mati");
    expect((await galat(ubahAlarm(A, a.id, { soal: { tingkat: "ringan" } }, "web", o))).tambahan.alasan).toBe("lemahkan");
    expect((await galat(ubahAlarm(A, a.id, { tunda: { jatah: 5 } }, "web", o))).tambahan.alasan).toBe("lemahkan");
    expect(await menunggu(a.id)).toHaveLength(1);
  });

  it("memajukan jam dan menambah alarm tetap boleh; sebelum jam tidur semua boleh", async () => {
    const { A, a } = await terkunci();
    const { ubahAlarm, buatAlarm, hapusAlarm } = await L();
    const b = await ubahAlarm(A, a.id, { jam: "04:30", soal: { tingkat: "berat" } }, "web", { sekarang: MALAM });
    expect(b.berikutnya?.utc.toISOString()).toBe("2026-10-07T21:30:00.000Z");
    await buatAlarm(A, { jam: "04:45" }, "web", { sekarang: MALAM });
    await hapusAlarm(A, a.id, "web", { sekarang: wib("2026-10-07T21:00:00") });
  });

  it("jam tidur dan zona tidak bisa dipakai membuka kunci", async () => {
    const { A } = await terkunci();
    const { ubahPreferensi } = await P();
    const g = await galat(ubahPreferensi(A, { jamTidur: "23:30" }, "web", { sekarang: MALAM }));
    expect(g.kode).toBe("komitmen_terkunci");
    expect(g.message).toContain("Jam tidur dan zona waktu bisa diubah sesudah alarm berbunyi");
    // Pindah ke London membuat 05.00 jatuh lebih lambat: ditolak.
    expect((await galat(ubahPreferensi(A, { zonaWaktu: "Europe/London" }, "web", { sekarang: MALAM }))).kode).toBe("komitmen_terkunci");
    // Jam tidur lebih awal tetap mengunci: boleh.
    await ubahPreferensi(A, { jamTidur: "21:00" }, "web", { sekarang: MALAM });
  });
});

describe("alarm yang sedang berbunyi tidak bisa diubah dari mana pun", () => {
  it.each(["berbunyi", "ditunda", "cek_bangun"])("status %s", async (status) => {
    const A = await buatPengguna(u);
    const { buatAlarm, ubahAlarm, hapusAlarm, aturAktifAlarm, lewatiBerikutnya, ambilAlarm } = await L();
    const a = await buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" } }, "web", { sekarang: SIANG });
    await u.pekerja((tx) =>
      tx
        .insert(schema.kejadianAlarm)
        .values({ penggunaId: A, alarmId: a.id, jadwalUtc: wib("2026-10-07T05:00:00"), tanggalLokal: "2026-10-07", jamLokal: "05:00", judul: "Bangun", status }),
    );
    for (const p of [
      ubahAlarm(A, a.id, { jam: "06:00" }, "agen", { sekarang: SIANG }),
      hapusAlarm(A, a.id, "agen", { sekarang: SIANG }),
      aturAktifAlarm(A, a.id, false, "agen", { sekarang: SIANG }),
      lewatiBerikutnya(A, a.id, "agen", { sekarang: SIANG }),
    ]) {
      const g = await galat(p);
      expect(g.kode).toBe("sedang_berbunyi");
      expect(g.message).toBe("Alarm ini sedang berbunyi. Jawab soalnya dulu di layar alarm.");
    }
    expect((await ambilAlarm(A, a.id, { sekarang: SIANG })).berbunyi).toBe(true);
  });
});

describe("isolasi pemilik", () => {
  it("pengguna lain tidak bisa melihat, mengubah, menghapus, atau melewati alarm milik A", async () => {
    const A = await buatPengguna(u);
    const B = await buatPengguna(u);
    const { buatAlarm, ambilAlarm, ubahAlarm, hapusAlarm, lewatiBerikutnya, daftarAlarm, alarmBerikutnya } = await L();
    const a = await buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" } }, "web", { sekarang: SIANG });
    for (const p of [ambilAlarm(B, a.id), ubahAlarm(B, a.id, { jam: "06:00" }, "web"), hapusAlarm(B, a.id, "web"), lewatiBerikutnya(B, a.id, "web")]) {
      expect((await galat(p)).kode).toBe("tidak_ditemukan");
    }
    expect(await daftarAlarm(B)).toEqual([]);
    expect(await alarmBerikutnya(B)).toBeNull();
    expect((await alarmBerikutnya(A, { sekarang: SIANG }))?.id).toBe(a.id);
    expect((await galat(ambilAlarm(A, "bukan-uuid"))).kode).toBe("tidak_ditemukan");
  });
});

describe("invarian: tepat satu kejadian menunggu per alarm aktif", () => {
  it("bertahan pada urutan tindakan acak", async () => {
    const { buatAlarm, ubahAlarm, aturAktifAlarm, lewatiBerikutnya, batalLewati, hapusAlarm, gandakanAlarm, daftarAlarm } = await L();
    const tindakan = fc.array(
      fc.oneof(
        fc.record({ j: fc.constant("buat"), jam: fc.constantFrom("04:30", "05:00", "06:15", "21:00"), harian: fc.boolean() }),
        fc.record({ j: fc.constant("ubah"), i: fc.nat(), jam: fc.constantFrom("04:00", "05:30", "23:59") }),
        fc.record({ j: fc.constant("aktif"), i: fc.nat(), aktif: fc.boolean() }),
        fc.record({ j: fc.constantFrom("lewati", "batal", "hapus", "gandakan"), i: fc.nat() }),
      ),
      { minLength: 4, maxLength: 10 },
    );
    await fc.assert(
      fc.asyncProperty(tindakan, fc.integer({ min: 0, max: 72 }), async (daftar, jamKe) => {
        const A = await buatPengguna(u);
        const o = { sekarang: new Date(SIANG.getTime() + jamKe * 3_600_000) };
        for (const t of daftar) {
          const ada = await daftarAlarm(A, o);
          const pilih = "i" in t && ada.length ? ada[t.i % ada.length] : null;
          try {
            if (t.j === "buat") await buatAlarm(A, { jam: t.jam, pengulangan: t.harian ? { jenis: "harian" } : { jenis: "sekali" } }, "web", o);
            else if (!pilih) continue;
            else if (t.j === "ubah") await ubahAlarm(A, pilih.id, { jam: t.jam }, "web", o);
            else if (t.j === "aktif") await aturAktifAlarm(A, pilih.id, t.aktif, "web", o);
            else if (t.j === "lewati") await lewatiBerikutnya(A, pilih.id, "web", o);
            else if (t.j === "batal" && pilih.lewati[0]) await batalLewati(A, pilih.id, pilih.lewati[0], "web", o);
            else if (t.j === "hapus") await hapusAlarm(A, pilih.id, "web", o);
            else if (t.j === "gandakan") await gandakanAlarm(A, pilih.id, "web", o);
          } catch (e) {
            if (!(e instanceof GalatLayanan)) throw e;
          }
        }
        const akhir = await daftarAlarm(A, o);
        const baris = await u.pekerja((tx) =>
          tx.execute(sql`select alarm_id, count(*)::int as n from kejadian_alarm where pengguna_id = ${A} and status = 'menunggu' group by alarm_id`),
        );
        const hitung = new Map((baris as unknown as { rows: Array<{ alarm_id: string; n: number }> }).rows.map((r) => [r.alarm_id, r.n]));
        for (const a of akhir) {
          if ((hitung.get(a.id) ?? 0) !== (a.aktif ? 1 : 0)) return false;
          if (a.aktif && (!a.berikutnya || a.berikutnya.utc <= o.sekarang)) return false;
        }
        // Tidak ada kejadian menunggu milik alarm yang sudah dihapus.
        return [...hitung.keys()].every((id) => akhir.some((a) => a.id === id));
      }),
      { numRuns: 12 },
    );
  }, 120_000);
});

describe("template", () => {
  it("lima template bawaan + buatan pengguna, nama unik, bawaan tidak bisa diubah", async () => {
    const A = await buatPengguna(u);
    const { daftarTemplate, buatTemplate, ubahTemplate, hapusTemplate, simpanAlarmSebagaiTemplate } = await T();
    const awal = await daftarTemplate(A);
    expect(awal.map((t) => t.id)).toEqual(["bawaan:bangun_kerja", "bawaan:kuliah_pagi", "bawaan:sholat_subuh", "bawaan:pengingat_siang", "bawaan:nuklir"]);
    expect(awal.map((t) => t.nama)).toEqual(["Bangun kerja", "Kuliah pagi", "Sholat Subuh", "Pengingat penting siang", "Nuklir"]);
    const t1 = await buatTemplate(A, { nama: "Gym", isi: { jam: "05:15", pengulangan: { jenis: "hari", hari: [1, 3, 5] }, agendaJudul: "Gym" } }, "web");
    expect((await galat(buatTemplate(A, { nama: "gym", isi: {} }, "web"))).message).toBe("Sudah ada template bernama itu.");
    expect((await galat(ubahTemplate(A, "bawaan:nuklir", { nama: "X" }, "web"))).message).toContain("Template bawaan tidak bisa diubah");
    const t2 = await ubahTemplate(A, t1.id, { nama: "Gym pagi" }, "web");
    expect(t2).toMatchObject({ id: t1.id, nama: "Gym pagi", bawaan: false });
    const a = await (await L()).buatAlarm(A, {}, "web", { sekarang: SIANG, template: t1.id });
    expect(a).toMatchObject({ jam: "05:15", agendaJudul: "Gym", pengulangan: { jenis: "hari", hari: [1, 3, 5] } });
    const t3 = await simpanAlarmSebagaiTemplate(A, a.id, "Salinan gym", "web");
    expect(t3.isi).toMatchObject({ jam: "05:15", agendaJudul: "Gym" });
    expect(t3.isi).not.toHaveProperty("aktif");
    await hapusTemplate(A, t1.id, "web");
    expect((await daftarTemplate(A)).length).toBe(6);
    expect((await galat((await L()).buatAlarm(A, {}, "web", { template: t1.id }))).kode).toBe("tidak_ditemukan");
  });

  it("template milik orang lain tidak terlihat", async () => {
    const A = await buatPengguna(u);
    const B = await buatPengguna(u);
    const { buatTemplate, ambilTemplate } = await T();
    const t = await buatTemplate(A, { nama: "Rahasia", isi: { jam: "03:00" } }, "web");
    expect((await galat(ambilTemplate(B, t.id))).kode).toBe("tidak_ditemukan");
  });

  it("paling banyak 20 template", async () => {
    const A = await buatPengguna(u);
    const { buatTemplate } = await T();
    for (let i = 0; i < 20; i++) await buatTemplate(A, { nama: `T${i}`, isi: {} }, "web");
    expect((await galat(buatTemplate(A, { nama: "T20", isi: {} }, "web"))).message).toBe("Paling banyak 20 template. Hapus yang tidak dipakai dulu.");
  });
});

describe("preferensi", () => {
  it("bawaan, ubah sebagian, bawaan alarm digabung, zona dicek", async () => {
    const A = await buatPengguna(u);
    const { ambilPreferensi, ubahPreferensi } = await P();
    const p0 = await ambilPreferensi(A);
    expect(p0).toMatchObject({ zonaWaktu: "Asia/Jakarta", jamTidur: "22:00", bahasa: "id", pengingatMalam: true, orientasiSelesai: false, namaPanggilan: null });
    expect(p0.bawaan.soal).toEqual({ jenis: "hitungan", tingkat: "sedang", benar: 2, kodeQr: [] });
    const p1 = await ubahPreferensi(A, { namaPanggilan: "Nugi", jamTidur: "23:00", bawaan: { komitmen: true } }, "web");
    const p2 = await ubahPreferensi(A, { bawaan: { bunyi: "sirene" }, orientasiSelesai: true }, "web");
    expect(p1.namaPanggilan).toBe("Nugi");
    expect(p2).toMatchObject({ jamTidur: "23:00", orientasiSelesai: true });
    expect(p2.bawaan).toMatchObject({ komitmen: true, bunyi: "sirene" });
    expect((await galat(ubahPreferensi(A, { zonaWaktu: "Mars/Olympus" }, "web"))).message).toBe("Ada isian yang belum benar: zona waktu tidak dikenal.");
  });

  it("pindah zona memindahkan jadwal alarm (jam lokal tetap)", async () => {
    const A = await buatPengguna(u);
    const a = await (await L()).buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" } }, "web", { sekarang: SIANG });
    await (await P()).ubahPreferensi(A, { zonaWaktu: "Asia/Makassar" }, "web", { sekarang: SIANG });
    const b = await (await L()).ambilAlarm(A, a.id, { sekarang: SIANG });
    expect(b.zona).toBe("Asia/Makassar");
    expect(b.berikutnya?.utc.toISOString()).toBe("2026-10-07T21:00:00.000Z");
    const [m] = await menunggu(a.id);
    expect(m.jadwalUtc.toISOString()).toBe("2026-10-07T21:00:00.000Z");
  });

  it("tindakan tercatat di audit tanpa isi pribadi", async () => {
    const A = await buatPengguna(u);
    await (await L()).buatAlarm(A, { jam: "05:00", agendaDetail: "rahasia pribadi" }, "agen", { sekarang: SIANG });
    const rows = await u.jalan(A, (tx) => tx.select().from(schema.audit).where(eq(schema.audit.penggunaId, A)));
    expect(rows.map((r) => [r.sumber, r.jenis])).toContainEqual(["agen", "alarm"]);
    expect(JSON.stringify(rows)).not.toContain("rahasia pribadi");
  });
});
