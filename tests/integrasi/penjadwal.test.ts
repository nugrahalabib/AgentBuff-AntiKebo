import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { GalatLayanan } from "@/lib/layanan/dasar";
import type { Saluran } from "@/lib/penjadwal/saluran";
import { arahkanDbAplikasi, buatPengguna, siapkanBasisData, type Ujian } from "./harness";

// Penjadwal (P3) terhadap migrasi ASLI di PGlite: klaim, terlewat, tunda, batas, langkah berulang,
// restart di tengah alarm, NOTIFY, SSE, perangkat siaga, uji alarm. Konkurensi sungguhan (dua
// worker, SKIP LOCKED) dan ketepatan waktu dengan LISTEN diuji di tests/pg terhadap Postgres 16.

process.env.LOG_LEVEL ??= "silent";

let u: Ujian;
const L = () => import("@/lib/layanan/alarm");
const M = () => import("@/lib/penjadwal/mesin");
const J = () => import("@/lib/penjadwal/penjadwal");
const Pr = () => import("@/lib/layanan/perangkat");
const K = () => import("@/lib/layanan/kejadian");
const E = () => import("@/lib/peristiwa");

const wib = (s: string) => new Date(`${s}+07:00`);
const SIANG = wib("2026-10-07T12:00:00");
const T = wib("2026-10-08T05:00:00"); // jadwal alarm 05:00 besok

beforeAll(async () => {
  u = await siapkanBasisData();
  arahkanDbAplikasi(u);
}, 60_000);

afterEach(async () => {
  (await M()).pasangSaluran(null);
});

/** Db yang setiap transaksinya berjalan sebagai antikebo_worker (seperti proses worker). */
function dbPekerja(): Db {
  const asli = u.superuser.transaction.bind(u.superuser);
  const d = Object.create(u.superuser) as Db;
  (d as unknown as { transaction: unknown }).transaction = (fn: (tx: unknown) => Promise<unknown>) =>
    asli(async (tx) => {
      await tx.execute(sql.raw("set local role antikebo_worker"));
      return fn(tx);
    });
  return d;
}

async function kejadianAlarm(alarmId: string) {
  return u.pekerja((tx) => tx.select().from(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.alarmId, alarmId)).orderBy(schema.kejadianAlarm.jadwalUtc));
}
async function langkah(kejadianId: string) {
  return u.pekerja((tx) => tx.select().from(schema.langkahKejadian).where(eq(schema.langkahKejadian.kejadianId, kejadianId)).orderBy(schema.langkahKejadian.id));
}

async function alarmHarian(A: string, isi: Record<string, unknown> = {}) {
  return (await L()).buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" }, ...isi }, "web", { sekarang: SIANG });
}

async function klaim(sekarang: Date) {
  const { klaimJatuhTempo } = await M();
  return dbPekerja().transaction((tx) => klaimJatuhTempo(tx, sekarang));
}

/** Saluran pencatat: menggantikan tiruan supaya urutan panggilan bisa diperiksa. */
function pencatat(): { daftar: Array<{ jenis: string; kejadian: string; pada: Date }>; saluran: Saluran[] } {
  const daftar: Array<{ jenis: string; kejadian: string; pada: Date }> = [];
  const buat = (jenis: string, saatTunda: "lanjut" | "berhenti", ulangMs?: number): Saluran => ({
    jenis,
    saatTunda,
    rencana: (_isi, mulai) => [{ jatuhTempo: mulai }],
    async jalankan({ kejadian, sekarang }) {
      daftar.push({ jenis, kejadian: kejadian.id, pada: sekarang });
      return { hasil: { ok: true }, ulangiPada: ulangMs ? new Date(sekarang.getTime() + ulangMs) : undefined };
    },
  });
  return { daftar, saluran: [buat("notifikasi", "berhenti", 30_000), buat("tuya", "lanjut")] };
}

describe("klaim kejadian", () => {
  it("belum waktunya: tidak diklaim", async () => {
    const A = await buatPengguna(u);
    const a = await alarmHarian(A);
    expect(await klaim(new Date(T.getTime() - 1_000))).toEqual([]);
    expect((await kejadianAlarm(a.id))[0].status).toBe("menunggu");
  });

  it("tepat waktu: berbunyi, isi disalin, langkah direncanakan, kejadian besok dimaterialisasi", async () => {
    const A = await buatPengguna(u);
    const a = await alarmHarian(A, { spam: { kanal: ["tg-1", "wa-1"] }, batasMenit: 10 });
    const h = await klaim(new Date(T.getTime() + 400));
    const milik = h.filter((x) => x.kejadian.alarmId === a.id);
    expect(milik).toHaveLength(1);
    expect(milik[0].hasil).toBe("berbunyi");
    const [kini, besok] = await kejadianAlarm(a.id);
    expect(kini).toMatchObject({ status: "berbunyi", terlambatDtk: 0 });
    expect(kini.berbunyiPada?.getTime()).toBe(T.getTime() + 400);
    expect((kini.isi as { agendaJudul: string; zona: string }).zona).toBe("Asia/Jakarta");
    expect(besok).toMatchObject({ status: "menunggu", tanggalLokal: "2026-10-09" });
    const l = await langkah(kini.id);
    expect(l.map((x) => `${x.jenis}:${x.urutan}`).sort()).toEqual(["batas:0", "notifikasi:0", "spam:0", "spam:100000"]);
    expect(l.find((x) => x.jenis === "batas")?.jatuhTempoUtc.getTime()).toBe(T.getTime() + 400 + 10 * 60_000);
  });

  it("terlambat 10 menit: tetap berbunyi dengan label terlambat", async () => {
    const A = await buatPengguna(u);
    const a = await alarmHarian(A);
    await klaim(new Date(T.getTime() + 10 * 60_000));
    expect((await kejadianAlarm(a.id))[0]).toMatchObject({ status: "berbunyi", terlambatDtk: 600 });
  });

  it("server mati 3 hari: terlewat dicatat + dikabari, kejadian berikutnya sesudah SEKARANG (tidak menumpuk)", async () => {
    const A = await buatPengguna(u);
    const a = await alarmHarian(A);
    const sekarang = wib("2026-10-11T12:00:00");
    await klaim(sekarang);
    const [lama, berikut] = await kejadianAlarm(a.id);
    expect(lama.status).toBe("terlewat");
    expect((await langkah(lama.id)).map((x) => x.jenis)).toEqual(["kabar_terlewat"]);
    expect(berikut).toMatchObject({ status: "menunggu", tanggalLokal: "2026-10-12" });
  });

  it("alarm sekali: dimatikan sesudah berbunyi, tanpa kejadian menunggu baru", async () => {
    const A = await buatPengguna(u);
    const a = await (await L()).buatAlarm(A, { jam: "05:00" }, "web", { sekarang: SIANG });
    await klaim(new Date(T.getTime() + 100));
    const kej = await kejadianAlarm(a.id);
    expect(kej.map((x) => x.status)).toEqual(["berbunyi"]);
    const b = await (await L()).ambilAlarm(A, a.id, { sekarang: new Date(T.getTime() + 200) });
    expect(b).toMatchObject({ aktif: false, berbunyi: true, berikutnya: null });
  });

  it("dua klaim bersamaan tidak membunyikan kejadian yang sama dua kali", async () => {
    const A = await buatPengguna(u);
    const a = await alarmHarian(A);
    const [x, y] = await Promise.all([klaim(new Date(T.getTime() + 100)), klaim(new Date(T.getTime() + 100))]);
    const semua = [...x, ...y].filter((h) => h.kejadian.alarmId === a.id);
    expect(semua).toHaveLength(1);
    expect((await kejadianAlarm(a.id)).filter((k) => k.status === "menunggu")).toHaveLength(1);
  });

  it("alarm yang sedang berbunyi menolak diubah dari layanan", async () => {
    const A = await buatPengguna(u);
    const a = await alarmHarian(A);
    await klaim(new Date(T.getTime() + 100));
    await expect((await L()).ubahAlarm(A, a.id, { jam: "06:00" }, "agen", { sekarang: new Date(T.getTime() + 200) })).rejects.toBeInstanceOf(GalatLayanan);
  });
});

describe("transisi", () => {
  it("hentikan: bangun, langkah yang belum jalan dibatalkan, tidak bisa dihentikan dua kali", async () => {
    const A = await buatPengguna(u);
    const a = await alarmHarian(A);
    await klaim(new Date(T.getTime() + 100));
    const [k] = await kejadianAlarm(a.id);
    const { hentikanKejadian } = await M();
    const h = await dbPekerja().transaction((tx) => hentikanKejadian(tx, k.id, "bangun", new Date(T.getTime() + 60_000)));
    expect(h).toMatchObject({ status: "bangun" });
    expect(h?.bangunPada?.getTime()).toBe(T.getTime() + 60_000);
    expect((await langkah(k.id)).every((l) => l.status === "dibatalkan")).toBe(true);
    expect(await dbPekerja().transaction((tx) => hentikanKejadian(tx, k.id, "tidak_bangun", new Date()))).toBeNull();
  });

  it("tunda: saluran yang berhenti dibatalkan, Tuya tetap; tunda habis = berbunyi lagi + rencana ulang", async () => {
    const { saluran } = pencatat();
    (await M()).pasangSaluran(saluran);
    const A = await buatPengguna(u);
    const a = await alarmHarian(A);
    await klaim(new Date(T.getTime() + 100));
    const [k] = await kejadianAlarm(a.id);
    const { tundaKejadian, bangunkanTundaHabis } = await M();
    const sampai = new Date(T.getTime() + 5 * 60_000);
    const d = await dbPekerja().transaction((tx) => tundaKejadian(tx, k.id, sampai, new Date(T.getTime() + 30_000)));
    expect(d).toMatchObject({ status: "ditunda", jumlahTunda: 1 });
    const l1 = await langkah(k.id);
    expect(l1.find((x) => x.jenis === "notifikasi")?.status).toBe("dibatalkan");
    expect(l1.find((x) => x.jenis === "tuya")?.status).toBe("menunggu");
    expect(await dbPekerja().transaction((tx) => bangunkanTundaHabis(tx, new Date(sampai.getTime() - 1)))).toEqual([]);
    const b = await dbPekerja().transaction((tx) => bangunkanTundaHabis(tx, sampai));
    expect(b.map((x) => x.id)).toContain(k.id);
    const l2 = await langkah(k.id);
    expect(l2.filter((x) => x.jenis === "notifikasi" && x.status === "menunggu")).toHaveLength(1);
    expect((await kejadianAlarm(a.id))[0]).toMatchObject({ status: "berbunyi", tundaSampai: null });
  });
});

describe("penjadwal: langkah berulang, batas, restart", () => {
  it("langkah berulang tiap 30 dtk selama berbunyi, berhenti saat bangun", async () => {
    const rek = pencatat();
    (await M()).pasangSaluran(rek.saluran);
    const A = await buatPengguna(u);
    const a = await alarmHarian(A);
    let jam = new Date(T.getTime() + 100);
    const { Penjadwal } = await J();
    const p = new Penjadwal({ db: dbPekerja, jam: () => jam });
    await p.putar();
    await p.tenang();
    const [k] = await kejadianAlarm(a.id);
    expect(
      rek.daftar
        .filter((x) => x.kejadian === k.id)
        .map((x) => x.jenis)
        .sort(),
    ).toEqual(["notifikasi", "tuya"]);
    jam = new Date(T.getTime() + 30_200);
    await p.putar();
    await p.tenang();
    expect(rek.daftar.filter((x) => x.kejadian === k.id && x.jenis === "notifikasi")).toHaveLength(2);
    const { hentikanKejadian } = await M();
    await dbPekerja().transaction((tx) => hentikanKejadian(tx, k.id, "bangun", jam));
    jam = new Date(T.getTime() + 61_000);
    await p.putar();
    await p.tenang();
    expect(rek.daftar.filter((x) => x.kejadian === k.id && x.jenis === "notifikasi")).toHaveLength(2);
    expect((await langkah(k.id)).map((x) => `${x.jenis}:${x.urutan}:${x.status}`)).toEqual([
      "notifikasi:0:selesai",
      "tuya:0:selesai",
      "notifikasi:1:selesai",
      "notifikasi:2:dibatalkan",
    ]);
  });

  it("batas berhenti sendiri: sesudah X menit tanpa jawaban = tidak bangun (PRD C4)", async () => {
    const A = await buatPengguna(u);
    const a = await alarmHarian(A, { batasMenit: 5 });
    let jam = new Date(T.getTime());
    const { Penjadwal } = await J();
    const p = new Penjadwal({ db: dbPekerja, jam: () => jam });
    await p.putar();
    await p.tenang();
    jam = new Date(T.getTime() + 5 * 60_000);
    await p.putar();
    await p.tenang();
    const [k] = await kejadianAlarm(a.id);
    expect(k.status).toBe("tidak_bangun");
    expect((await langkah(k.id)).filter((x) => x.status === "menunggu")).toEqual([]);
  });

  it("restart di tengah alarm: worker baru melanjutkan kejadian yang sama dan langkah yang ditinggal", async () => {
    const rek = pencatat();
    (await M()).pasangSaluran(rek.saluran);
    const A = await buatPengguna(u);
    const a = await alarmHarian(A);
    // Worker pertama mengklaim lalu "mati" sebelum langkahnya selesai: langkah tertinggal `jalan`.
    await klaim(new Date(T.getTime() + 100));
    const [k] = await kejadianAlarm(a.id);
    const { klaimLangkah } = await M();
    await dbPekerja().transaction((tx) => klaimLangkah(tx, new Date(T.getTime() + 200)));
    expect((await langkah(k.id)).every((l) => l.status === "jalan")).toBe(true);
    // Worker kedua menyala 3 menit kemudian.
    const { Penjadwal } = await J();
    const jam = new Date(T.getTime() + 3 * 60_000);
    const p = new Penjadwal({ db: dbPekerja, jam: () => jam });
    const r = await p.putar();
    await p.tenang();
    expect(r.pulih).toBe(2);
    expect((await kejadianAlarm(a.id))[0].status).toBe("berbunyi");
    expect(
      rek.daftar
        .filter((x) => x.kejadian === k.id)
        .map((x) => x.jenis)
        .sort(),
    ).toEqual(["notifikasi", "tuya"]);
    expect((await langkah(k.id)).find((x) => x.jenis === "notifikasi" && x.urutan === 0)).toMatchObject({ status: "selesai", percobaan: 2 });
  });

  it("jaring pengaman: alarm aktif tanpa kejadian menunggu dimaterialisasi ulang", async () => {
    const A = await buatPengguna(u);
    const a = await alarmHarian(A);
    await u.pekerja((tx) => tx.delete(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.alarmId, a.id)));
    const { lengkapiMaterialisasi } = await M();
    expect(await dbPekerja().transaction((tx) => lengkapiMaterialisasi(tx, SIANG))).toBeGreaterThanOrEqual(1);
    expect((await kejadianAlarm(a.id)).map((x) => x.status)).toEqual(["menunggu"]);
  });

  it("pewaktu tepat: penjadwal yang menyala membunyikan kejadian pada jadwalnya (jam sungguhan)", async () => {
    const A = await buatPengguna(u);
    const a = await alarmHarian(A);
    const jadwal = new Date(Date.now() + 1_200);
    await u.pekerja((tx) =>
      tx
        .update(schema.kejadianAlarm)
        .set({ jadwalUtc: jadwal })
        .where(and(eq(schema.kejadianAlarm.alarmId, a.id), eq(schema.kejadianAlarm.status, "menunggu"))),
    );
    const { Penjadwal } = await J();
    const p = new Penjadwal({ db: dbPekerja, ketukanMs: 60_000 });
    await p.mulai();
    await new Promise((r) => setTimeout(r, 2_500));
    await p.berhenti();
    const k = (await kejadianAlarm(a.id)).find((x) => x.jadwalUtc.getTime() === jadwal.getTime());
    expect(k?.status).toBe("berbunyi");
    const selisih = k!.berbunyiPada!.getTime() - jadwal.getTime();
    expect(selisih).toBeGreaterThanOrEqual(0);
    expect(selisih).toBeLessThan(1_000);
  }, 15_000);
});

describe("peristiwa dan SSE", () => {
  async function pasangPglite() {
    const { pasangSumberPeristiwa } = await E();
    pasangSumberPeristiwa((cb) => u.pg.listen("antikebo_peristiwa", cb));
  }

  async function bacaSampai(res: Response, jenis: string, batasMs = 3_000): Promise<{ teks: string; ms: number }> {
    const r = res.body!.getReader();
    const dec = new TextDecoder();
    const mulai = Date.now();
    let teks = "";
    const habis = setTimeout(() => void r.cancel(), batasMs);
    try {
      while (!teks.includes(`event: ${jenis}\n`)) {
        const { value, done } = await r.read();
        if (done) break;
        teks += dec.decode(value);
      }
    } finally {
      clearTimeout(habis);
    }
    return { teks, ms: Date.now() - mulai };
  }

  it("pemicu DB mengabarkan berbunyi, berhenti, jadwal ke pelanggan pengguna itu saja", async () => {
    await pasangPglite();
    const A = await buatPengguna(u);
    const B = await buatPengguna(u);
    const { langganan } = await E();
    const diterimaA: string[] = [];
    const diterimaB: string[] = [];
    const lepasA = await langganan(A, (e) => diterimaA.push(`${e.j}`));
    const lepasB = await langganan(B, (e) => diterimaB.push(`${e.j}`));
    const a = await alarmHarian(A);
    await klaim(new Date(T.getTime() + 100));
    const [k] = await kejadianAlarm(a.id);
    const { hentikanKejadian } = await M();
    await dbPekerja().transaction((tx) => hentikanKejadian(tx, k.id, "bangun", new Date(T.getTime() + 1_000)));
    await new Promise((r) => setTimeout(r, 100));
    lepasA();
    lepasB();
    expect(diterimaA).toContain("jadwal");
    expect(diterimaA).toContain("berbunyi");
    expect(diterimaA).toContain("berhenti");
    expect(diterimaB).toEqual([]);
  });

  it("SSE: perangkat (token) dan sesi web sama-sama menerima `berhenti` < 2 dtk; perangkat dicabut = alirannya ditutup", async () => {
    await pasangPglite();
    const A = await buatPengguna(u);
    const { mintaKodeSambung, setujuiKodeSambung, ambilTokenSambung, cabutPerangkat } = await Pr();
    const kode = await mintaKodeSambung({ nama: "PC Kamar" });
    await setujuiKodeSambung(A, kode.kode, "web");
    const h = await ambilTokenSambung({ kode: kode.kode, rahasia: kode.rahasia });
    if (h.status !== "tersambung") throw new Error("gagal sambung");
    const a = await alarmHarian(A);
    await klaim(new Date(T.getTime() + 100));
    const [k] = await kejadianAlarm(a.id);

    const { GET } = await import("@/app/api/peristiwa/route");
    const pc = await GET(new Request("http://localhost:3100/api/peristiwa", { headers: { Authorization: `Bearer ${h.token}` } }));
    expect(pc.status).toBe(200);
    expect(pc.headers.get("content-type")).toBe("text/event-stream");
    const { aliranPeristiwa } = await E();
    const web = aliranPeristiwa(new Request("http://localhost:3100/api/peristiwa"), A);
    await new Promise((r) => setTimeout(r, 50));
    const tunggu = Promise.all([bacaSampai(pc, "berhenti"), bacaSampai(web, "berhenti")]);
    const { hentikanKejadian } = await M();
    await dbPekerja().transaction((tx) => hentikanKejadian(tx, k.id, "bangun", new Date()));
    const [hp, hw] = await tunggu;
    expect(hp.teks).toContain("event: halo");
    expect(hp.teks).toContain(`"k":"${k.id}"`);
    expect(hp.ms).toBeLessThan(2_000);
    expect(hw.teks).toContain("event: berhenti");
    expect(hw.ms).toBeLessThan(2_000);

    const pc2 = await GET(new Request("http://localhost:3100/api/peristiwa", { headers: { Authorization: `Bearer ${h.token}` } }));
    const tutup = bacaSampai(pc2, "cabut");
    await cabutPerangkat(A, h.perangkat.id, "web");
    expect((await tutup).teks).toContain("event: cabut");
    const pc3 = await GET(new Request("http://localhost:3100/api/peristiwa", { headers: { Authorization: `Bearer ${h.token}` } }));
    expect(pc3.status).toBe(401);
  });
});

describe("perangkat siaga", () => {
  it("sambung PC: kode, setujui, ambil token sekali pakai dengan rahasia tunggu", async () => {
    const A = await buatPengguna(u);
    const { mintaKodeSambung, lihatKodeSambung, setujuiKodeSambung, ambilTokenSambung, perangkatDariToken, daftarPerangkat, rapikanKode } = await Pr();
    const k = await mintaKodeSambung({ nama: "PC Kamar", versi: "1.0.0" });
    expect(k.kode).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(rapikanKode(k.kode.toLowerCase().replace("-", " "))).toBe(k.kode);
    expect(await lihatKodeSambung(k.kode)).toMatchObject({ namaPerangkat: "PC Kamar", status: "menunggu" });
    expect(await ambilTokenSambung({ kode: k.kode, rahasia: k.rahasia })).toEqual({ status: "menunggu" });
    await setujuiKodeSambung(A, k.kode, "web");
    expect(await ambilTokenSambung({ kode: k.kode, rahasia: "x".repeat(43) })).toEqual({ status: "kedaluwarsa" });
    const h = await ambilTokenSambung({ kode: k.kode, rahasia: k.rahasia });
    expect(h.status).toBe("tersambung");
    if (h.status !== "tersambung") return;
    expect(h.token).toMatch(/^antikebo_pc_[A-Za-z0-9_-]{43}$/);
    expect(await ambilTokenSambung({ kode: k.kode, rahasia: k.rahasia })).toEqual({ status: "kedaluwarsa" });
    expect((await perangkatDariToken(h.token))?.penggunaId).toBe(A);
    expect(await daftarPerangkat(A)).toMatchObject([{ jenis: "pc", nama: "PC Kamar", versi: "1.0.0", siaga: true }]);
    // Token tidak pernah tersimpan mentah.
    const isiDb = JSON.stringify(await u.pekerja((tx) => tx.select().from(schema.perangkatSiaga)));
    expect(isiDb).not.toContain(h.token);
  });

  it("kode kedaluwarsa sesudah 10 menit; pengguna lain tidak bisa menyetujui kode yang sudah disetujui", async () => {
    const A = await buatPengguna(u);
    const B = await buatPengguna(u);
    const { mintaKodeSambung, setujuiKodeSambung } = await Pr();
    const k1 = await mintaKodeSambung({ nama: "PC" }, SIANG);
    await expect(setujuiKodeSambung(A, k1.kode, "web", new Date(SIANG.getTime() + 11 * 60_000))).rejects.toThrow("Kodenya sudah tidak berlaku");
    const k2 = await mintaKodeSambung({ nama: "PC" });
    await setujuiKodeSambung(A, k2.kode, "web");
    await expect(setujuiKodeSambung(B, k2.kode, "web")).rejects.toThrow("Kodenya sudah tidak berlaku");
    expect((await setujuiKodeSambung(A, k2.kode, "web")).status).toBe("disetujui");
  });

  it("detak, Jam Meja web, ganti nama, cabut; pemilik lain tidak bisa menyentuh", async () => {
    const A = await buatPengguna(u);
    const B = await buatPengguna(u);
    const { daftarkanPerangkatWeb, detakPerangkat, daftarPerangkat, ubahNamaPerangkat, cabutPerangkat } = await Pr();
    const w = await daftarkanPerangkatWeb(A, "HP Nugi", "web", SIANG);
    expect((await daftarPerangkat(A, new Date(SIANG.getTime() + 3 * 60_000)))[0].siaga).toBe(false);
    await detakPerangkat(A, w.id, { kemampuan: { dicas: false, baterai: 40 } }, new Date(SIANG.getTime() + 3 * 60_000));
    const [d] = await daftarPerangkat(A, new Date(SIANG.getTime() + 3 * 60_000 + 1_000));
    expect(d).toMatchObject({ jenis: "web", siaga: true, kemampuan: { dicas: false, baterai: 40 } });
    await expect(detakPerangkat(A, w.id, { rahasia: 1 })).rejects.toThrow();
    await expect(cabutPerangkat(B, w.id, "web")).rejects.toThrow("Perangkat tidak ditemukan.");
    await expect(ubahNamaPerangkat(B, w.id, "x", "web")).rejects.toThrow();
    expect((await ubahNamaPerangkat(A, w.id, "Tablet dapur", "web")).nama).toBe("Tablet dapur");
    await cabutPerangkat(A, w.id, "web");
    expect(await daftarPerangkat(A)).toEqual([]);
    await expect(detakPerangkat(A, w.id, {})).rejects.toThrow();
  });

  it("jadwal 24 jam: kejadian aktif + kejadian ke depan termasuk yang belum dimaterialisasi, tanpa jawaban", async () => {
    const A = await buatPengguna(u);
    const { buatAlarm } = await L();
    const a1 = await buatAlarm(A, { jam: "05:00", pengulangan: { jenis: "harian" }, agendaJudul: "Presentasi" }, "web", { sekarang: SIANG });
    const a2 = await buatAlarm(A, { jam: "13:00", pengulangan: { jenis: "harian" } }, "web", { sekarang: SIANG });
    await buatAlarm(A, { jam: "06:00", pengulangan: { jenis: "harian" }, aktif: false }, "web", { sekarang: SIANG });
    const { jadwalPerangkat } = await Pr();
    // Jam 12.00: 13.00 hari ini dan 05.00 besok (13.00 besok di luar 24 jam).
    const j = await jadwalPerangkat(A, SIANG);
    expect(j.map((x) => `${x.jam} ${x.tanggal}`)).toEqual(["13:00 2026-10-07", "05:00 2026-10-08"]);
    expect(j[1]).toMatchObject({ kunci: `${a1.id}:2026-10-08`, judul: "Presentasi", status: "menunggu", soal: { jenis: "hitungan", tingkat: "sedang", benar: 2 } });
    expect(j[0].kejadianId).not.toBeNull();
    expect(JSON.stringify(j)).not.toMatch(/jawaban|hash/i);
    // Sesudah 13.00 berbunyi: kejadian aktif tetap ada, 13.00 besok masuk jendela.
    await klaim(wib("2026-10-07T13:00:01"));
    const j2 = await jadwalPerangkat(A, wib("2026-10-07T13:00:05"));
    expect(j2.find((x) => x.kunci === `${a2.id}:2026-10-07`)?.status).toBe("berbunyi");
    expect(j2.some((x) => x.kunci === `${a2.id}:2026-10-08`)).toBe(true);
  });
});

describe("uji alarm (PRD B9)", () => {
  it("1 menit lagi, soal ringan, tanpa tunda; tidak menggeser jadwal asli; berhenti sendiri sesudah 5 menit", async () => {
    const A = await buatPengguna(u);
    const a = await alarmHarian(A, { soal: { tingkat: "berat", benar: 3 }, tunda: { jatah: 3 }, spam: { kanal: ["tg-1"] } });
    const { ujiAlarm, kejadianAktif } = await K();
    const u1 = await ujiAlarm(A, { alarmId: a.id }, "web", { sekarang: SIANG });
    const u2 = await ujiAlarm(A, {}, "web", { sekarang: SIANG });
    expect(u2.kejadianId).toBe(u1.kejadianId);
    expect(u1.jadwalUtc.getTime()).toBe(SIANG.getTime() + 60_000);
    const [k] = await u.pekerja((tx) => tx.select().from(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.id, u1.kejadianId)));
    expect(k).toMatchObject({ uji: true, status: "menunggu", jamLokal: "12:01" });
    expect(k.isi).toMatchObject({ soal: { tingkat: "ringan", benar: 1 }, tunda: { jatah: 0 }, batasMenit: 5, spam: { kanal: [] }, komitmen: false });

    let jam = new Date(SIANG.getTime() + 60_000);
    const { Penjadwal } = await J();
    const p = new Penjadwal({ db: dbPekerja, jam: () => jam });
    await p.putar();
    await p.tenang();
    expect((await kejadianAktif(A)).map((x) => [x.id, x.uji, x.status])).toEqual([[u1.kejadianId, true, "berbunyi"]]);
    // Jadwal asli alarm tetap 05.00 besok.
    expect((await (await L()).ambilAlarm(A, a.id, { sekarang: jam })).berikutnya?.utc.getTime()).toBe(T.getTime());
    jam = new Date(SIANG.getTime() + 6 * 60_000);
    await p.putar();
    await p.tenang();
    expect(await kejadianAktif(A)).toEqual([]);
  });
});
