import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { mulaiTuyaTiruan, type TuyaTiruan } from "../tiruan/tuya";
import type { AgentBuffTiruan } from "../tiruan/agentbuff";
import { arahkanDbAplikasi, buatPengguna, siapkanBasisData, type Ujian } from "./harness";
import { siapkanTiruan } from "./lingkungan";

// P7 rumah pintar terhadap migrasi ASLI (PGlite, peran tanpa BYPASSRLS) + server Tuya tiruan:
// sambung kunci (diuji dulu, tersandi), daftar per ruangan, uji perangkat dengan konfirmasi,
// validasi aturan alarm, dan aksi alarm lewat penjadwal dengan jam terkendali: naik bertahap
// sebelum alarm, bareng, kedip, saat tunda, sesudah bangun (kembalikan potret, biarkan), perangkat
// offline dilewati, kunci ditolak = bermasalah, lapisan darurat (batas harian).

process.env.LOG_LEVEL ??= "silent";

let u: Ujian;
let ab: AgentBuffTiruan;
let tuya: TuyaTiruan;
let jam = new Date("2026-12-01T00:00:00Z");
const wib = (s: string) => new Date(`${s}+07:00`);
const KUNCI = "sk-SGabcdef123456";

const T = () => import("@/lib/layanan/tuya");
const L = () => import("@/lib/layanan/alarm");
const M = () => import("@/lib/penjadwal/mesin");

beforeAll(async () => {
  ab = await siapkanTiruan();
  tuya = await mulaiTuyaTiruan();
  process.env.TUYA_BASIS_UJI = tuya.url;
  u = await siapkanBasisData();
  arahkanDbAplikasi(u);
  const { pasangSaluran, saluranBatas } = await M();
  const { saluranTuya } = await import("@/lib/penjadwal/saluran-tuya");
  pasangSaluran([...saluranTuya({ db: dbPekerja, jedaKonfirmasi: [5, 5, 5] }), saluranBatas]);
}, 60_000);

afterAll(async () => {
  (await M()).pasangSaluran(null);
  await tuya?.tutup();
  await ab?.tutup();
});

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

let penjadwal: import("@/lib/penjadwal/penjadwal").Penjadwal | null = null;
async function putar(pada?: Date) {
  if (pada) jam = pada;
  if (!penjadwal) {
    const { Penjadwal } = await import("@/lib/penjadwal/penjadwal");
    penjadwal = new Penjadwal({ db: dbPekerja, jam: () => jam });
  }
  await penjadwal.putar();
  await penjadwal.tenang();
}
const maju = (ms: number) => putar(new Date(jam.getTime() + ms));
const alat = (id: string) => tuya.alat.find((a) => a.id === id)!;
const perintahUntuk = (id: string) => tuya.perintah.filter((p) => p.id === id).map((p) => p.properti);

async function penggunaTersambung() {
  tuya.setelUlang();
  const P = await buatPengguna(u, "Nugi Pratama");
  await (await T()).simpanKunci(P, KUNCI, "web");
  return P;
}

async function mesin<R>(fn: (m: Awaited<ReturnType<typeof M>>, tx: Parameters<Parameters<Db["transaction"]>[0]>[0]) => Promise<R>): Promise<R> {
  const m = await M();
  return dbPekerja().transaction((tx) => fn(m, tx));
}

async function kejadianDari(alarmId: string) {
  const [k] = await u.pekerja((tx) => tx.select().from(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.alarmId, alarmId)));
  return k;
}

describe("sambung rumah (PRD I1, I2)", () => {
  it("kunci diuji ke Tuya dulu, tersandi, tidak pernah dikembalikan; perangkat per ruangan", async () => {
    tuya.setelUlang();
    const P = await buatPengguna(u, "Nugi Pratama");
    const S = await T();
    const pesan = async (k: unknown) => ((await S.simpanKunci(P, k, "web").catch((e: GalatLayanan) => e)) as GalatLayanan).message;
    expect(await pesan("")).toBe("Tempel kuncinya dulu.");
    expect(await pesan("bukan kunci")).toMatch(/belum terlihat seperti kunci Tuya/);
    expect(await pesan("sk-ZZabcdefgh12")).toMatch(/wilayah yang belum dikenali/);
    tuya.kunciDitolak.add("sk-SGditolak12345");
    expect(await pesan("sk-SGditolak12345")).toMatch(/^Tuya menolak kunci ini/);
    expect(await S.statusRumah(P)).toEqual({ tersambung: false });

    const r = await S.simpanKunci(P, `  "${KUNCI}"  `, "web");
    expect(r).toEqual({ rumah: 1, ruangan: 2, perangkat: 6, online: 5, wilayah: { kode: "SG", nama: "Singapura" } });
    const [s] = await u.pekerja((tx) => tx.select().from(schema.sambunganTuya).where(eq(schema.sambunganTuya.penggunaId, P)));
    expect(s.kunciSandi).not.toContain("abcdef123456");
    expect(await S.statusRumah(P)).toMatchObject({ tersambung: true, bermasalah: false, kunciSamar: "sk-SG••••3456", wilayah: { kode: "SG", nama: "Singapura" }, perangkat: 6 });

    const d = await S.daftarPerangkatRumah(P);
    expect(d.ruangan.map((x) => [x.nama, x.perangkat.map((p) => `${p.nama}${p.online ? "" : " (offline)"}`)])).toEqual([
      ["Kamar", ["AC Kamar", "Lampu Kamar", "Lampu Plafon"]],
      ["Ruang Tamu", ["Colokan Kipas", "Sensor Pintu"]],
      ["Tanpa ruangan", ["Dispenser (offline)"]],
    ]);
    const lampu = d.ruangan[0].perangkat.find((p) => p.id === "lampu1")!;
    expect(lampu.bisa).toMatchObject({ nyala: true, terang: true, warna: true, suhuPutih: true, suhuAc: null });
    const ac = d.ruangan[0].perangkat.find((p) => p.id === "ac1")!;
    expect(ac.bisa.suhuAc).toEqual({ min: 16, max: 30 });
    expect(ac.bisa.modeAc).toEqual(expect.arrayContaining(["cold", "hot"]));
    expect(d.ruangan[1].perangkat.find((p) => p.id === "pintu1")!.bisa.nyala).toBe(false);

    // Pengguna lain tidak melihat rumah ini.
    const lain = await buatPengguna(u);
    await expect(S.daftarPerangkatRumah(lain)).rejects.toMatchObject({ kode: "belum_tersambung" });
  });

  it("uji perangkat: benar-benar melapor; menerima tapi tidak menjalankan = belum terkonfirmasi; offline ditolak; keadaan dikembalikan", async () => {
    const P = await penggunaTersambung();
    const S = await T();
    const h = await S.ujiPerangkat(P, "lampu1", { jeda: [5, 5, 5], jedaKembali: 5 });
    expect(h).toEqual({ status: "terkonfirmasi", pesan: "Lampu Kamar merespons." });
    expect(alat("lampu1").properti).toMatchObject({ switch_led: false, bright_value_v2: 500 });
    expect(perintahUntuk("lampu1")[0]).toMatchObject({ switch_led: true, bright_value_v2: 1000 });
    tuya.abaikan.add("ac1");
    expect(await S.ujiPerangkat(P, "ac1", { jeda: [5, 5, 5], jedaKembali: 5 })).toEqual({
      status: "belum_terkonfirmasi",
      pesan: "Perintah diterima Tuya, tapi AC Kamar belum melaporkan perubahan. Cek perangkatnya.",
    });
    await expect(S.ujiPerangkat(P, "plug2")).rejects.toMatchObject({ kode: "offline", message: "Dispenser sedang offline. Periksa listrik dan Wi-Fi perangkatnya." });
    // Sensor hanya dipantau: tidak ada perintah yang dikirim.
    const sebelum = tuya.perintah.length;
    await expect(S.ujiPerangkat(P, "pintu1")).rejects.toMatchObject({ kode: "tidak_didukung", message: "Sensor Pintu tidak bisa melakukan itu." });
    expect(tuya.perintah.length).toBe(sebelum);
  });

  it("aturan rumah pintar di alarm: perangkat harus milik pengguna dan sanggup melakukan aksinya", async () => {
    const P = await penggunaTersambung();
    const { buatAlarm, ubahAlarm } = await L();
    const aturan = (perangkatId: string, ubah: Record<string, unknown> = {}) => ({
      perangkatId,
      kapan: "bareng",
      menitSebelum: null,
      aksi: { nyala: true },
      kedip: false,
      sesudahBangun: "kembalikan",
      ...ubah,
    });
    const sekarang = wib("2026-12-01T12:00:00");
    await expect(buatAlarm(P, { jam: "05:00", tuya: [aturan("tidak-ada")] }, "web", { sekarang })).rejects.toThrow("muat ulang daftar perangkat");
    await expect(buatAlarm(P, { jam: "05:00", tuya: [aturan("plug1", { kedip: true })] }, "web", { sekarang })).rejects.toThrow("tidak bisa melakukan aksi itu");
    await expect(buatAlarm(P, { jam: "05:00", tuya: [aturan("pintu1")] }, "web", { sekarang })).rejects.toThrow("tidak bisa melakukan aksi itu");
    const a = await buatAlarm(
      P,
      { jam: "05:00", tuya: [aturan("lampu1", { aksi: { nyala: true, terang: 80, warna: "#ff8800" }, kedip: true }), aturan("ac1", { aksi: { suhuAc: 24, modeAc: "dingin" } })] },
      "web",
      { sekarang },
    );
    expect(a.tuya).toHaveLength(2);
    // Rumah diputus: alarm tetap bisa diubah jamnya (aturan lama tidak menghalangi).
    await (await T()).putuskan(P, "web");
    await ubahAlarm(P, a.id, { jam: "05:30" }, "web", { sekarang });
  });
});

describe("aksi alarm lewat penjadwal (PRD I3, I4, I5)", () => {
  it("naik bertahap sebelum alarm, bareng, kedip, saat tunda, sesudah bangun: kembalikan dan biarkan; offline dilewati", async () => {
    const P = await penggunaTersambung();
    const { buatAlarm } = await L();
    const tanggal = "2026-12-02";
    const a = await buatAlarm(
      P,
      {
        jam: "05:00",
        pengulangan: { jenis: "sekali", tanggal },
        masihBangun: { aktif: false, menit: 5, batasDtk: 60 },
        tuya: [
          { perangkatId: "lampu1", kapan: "sebelum", menitSebelum: 5, aksi: { nyala: true, terang: 80, suhuPutih: 30 }, kedip: false, sesudahBangun: "kembalikan" },
          { perangkatId: "ac1", kapan: "bareng", menitSebelum: null, aksi: { nyala: true, suhuAc: 24, modeAc: "dingin" }, kedip: false, sesudahBangun: "kembalikan" },
          { perangkatId: "lampu2", kapan: "bareng", menitSebelum: null, aksi: { nyala: true, terang: 100 }, kedip: true, sesudahBangun: "biarkan" },
          { perangkatId: "plug1", kapan: "tunda", menitSebelum: null, aksi: { nyala: true }, kedip: false, sesudahBangun: "biarkan" },
          { perangkatId: "plug2", kapan: "bareng", menitSebelum: null, aksi: { nyala: false }, kedip: false, sesudahBangun: "biarkan" },
        ],
      },
      "web",
      { sekarang: wib(`${tanggal}T00:00:00`) },
    );
    const Tj = wib(`${tanggal}T05:00:00`);
    tuya.alat.find((x) => x.id === "plug2")!.online = false;

    // 6 menit sebelum: belum ada perintah; langkah pra direncanakan.
    await putar(new Date(Tj.getTime() - 6 * 60_000));
    expect(perintahUntuk("lampu1")).toEqual([]);
    // 5 menit sebelum sampai jam alarm: lampu naik bertahap tiap menit.
    for (let i = 5; i >= 0; i--) await putar(new Date(Tj.getTime() - i * 60_000));
    const terang = perintahUntuk("lampu1").map((p) => Number(p.bright_value_v2));
    expect(terang).toHaveLength(6);
    for (let i = 1; i < terang.length; i++) expect(terang[i]).toBeGreaterThan(terang[i - 1]);
    expect(terang[0]).toBeLessThan(50);
    expect(terang.at(-1)).toBe(802);
    expect(perintahUntuk("lampu1")[0]).toMatchObject({ switch_led: true });
    // Potret keadaan sebelum alarm (untuk dikembalikan).
    const kej = await kejadianDari(a.id);
    const potret = await u.pekerja((tx) => tx.select().from(schema.potretTuya).where(eq(schema.potretTuya.kejadianId, kej.id)));
    expect(potret.find((x) => x.deviceId === "lampu1")?.properti).toMatchObject({ switch_led: false, bright_value_v2: 500 });

    // Jam alarm: AC dingin 24 derajat, lampu plafon mulai berkedip, dispenser offline dilewati.
    expect(kej.status).toBe("berbunyi");
    expect(alat("ac1").properti).toMatchObject({ switch: true, temp_set: 240, mode: "cold" });
    expect(perintahUntuk("lampu2")[0]).toMatchObject({ switch_led: true, bright_value_v2: 1000 });
    const lewat = await u.pekerja((tx) =>
      tx
        .select()
        .from(schema.langkahKejadian)
        .where(and(eq(schema.langkahKejadian.kejadianId, kej.id), eq(schema.langkahKejadian.jenis, "tuya"))),
    );
    expect(lewat.map((l) => l.hasil)).toEqual(
      expect.arrayContaining([expect.objectContaining({ perangkat: "plug2", lewat: "offline" }), expect.objectContaining({ perangkat: "ac1", status: "terkonfirmasi" })]),
    );
    // Kedip: sesudah aksi "bareng" (100%) dan langkah kedip pertama (nyala 100%), 10% dan 100%
    // bergantian tiap 3 detik.
    await maju(3_000);
    await maju(3_000);
    await maju(3_000);
    expect(perintahUntuk("lampu2").map((p) => p.bright_value_v2)).toEqual([1000, 1000, 109, 1000, 109]);

    // Tunda: kedip berhenti dengan lampu terang tetap (bukan redup 10%), colokan kipas menyala (aturan "saat tunda").
    expect(alat("lampu2").properti.bright_value_v2).toBe(109);
    const sampai = new Date(jam.getTime() + 5 * 60_000);
    await mesin((m, tx) => m.tundaKejadian(tx, kej.id, sampai, jam));
    await maju(1_000);
    expect(alat("plug1").properti.switch_1).toBe(true);
    expect(alat("lampu2").properti.bright_value_v2).toBe(1000);
    const kedipSaatTunda = perintahUntuk("lampu2").length;
    await maju(6_000);
    expect(perintahUntuk("lampu2").length).toBe(kedipSaatTunda);
    // Tunda habis: kedip lanjut.
    await putar(new Date(sampai.getTime() + 1_000));
    await maju(3_000);
    expect(perintahUntuk("lampu2").length).toBeGreaterThan(kedipSaatTunda);

    // Bangun: lampu kamar dan AC kembali seperti sebelum alarm; lampu plafon dibiarkan menyala terang penuh.
    await mesin((m, tx) => m.lolosKejadian(tx, kej.id, jam, { oleh: "sesi" }));
    await maju(1_000);
    expect(alat("lampu1").properti).toMatchObject({ switch_led: false, bright_value_v2: 500 });
    expect(alat("ac1").properti).toMatchObject({ switch: false, temp_set: 260, mode: "auto" });
    expect(alat("lampu2").properti).toMatchObject({ switch_led: true, bright_value_v2: 1000 });
    const sesudah = tuya.perintah.length;
    await maju(10_000);
    expect(tuya.perintah.length).toBe(sesudah);
  });

  it("kedip berhenti terang tetap saat menunggu 'Masih bangun?'; suasana pagi dan aturan 'sesudah' hanya bila benar-benar bangun", async () => {
    const P = await penggunaTersambung();
    const { buatAlarm } = await L();
    const aturan = (kedip: boolean) => [
      { perangkatId: "lampu1", kapan: "bareng" as const, menitSebelum: null, aksi: { nyala: true, terang: 30 }, kedip, sesudahBangun: "suasana_pagi" as const },
      { perangkatId: "plug1", kapan: "sesudah" as const, menitSebelum: null, aksi: { nyala: true }, kedip: false, sesudahBangun: "biarkan" as const },
    ];
    const bunyikan = async (tanggal: string, kedip: boolean, masihBangun: boolean) => {
      tuya.setelUlang();
      const a = await buatAlarm(
        P,
        { jam: "05:00", pengulangan: { jenis: "sekali", tanggal }, masihBangun: { aktif: masihBangun, menit: 5, batasDtk: 60 }, tuya: aturan(kedip) },
        "web",
        { sekarang: wib(`${tanggal}T00:00:00`) },
      );
      await putar(wib(`${tanggal}T05:00:00`));
      return kejadianDari(a.id);
    };

    // Soal terjawab, "Masih bangun?" menunggu: kedip berhenti, lampu terang tetap (bukan redup 10%),
    // aturan "sesudah" dan suasana pagi belum jalan.
    const kej = await bunyikan("2026-12-05", true, true);
    await maju(3_000);
    expect(alat("lampu1").properti.bright_value_v2).toBe(109);
    await mesin((m, tx) => m.lolosKejadian(tx, kej.id, jam, { oleh: "sesi" }));
    await maju(1_000);
    expect(alat("lampu1").properti).toMatchObject({ switch_led: true, bright_value_v2: 307 });
    expect(alat("plug1").properti.switch_1).toBe(false);
    const n = tuya.perintah.length;
    await maju(6_000);
    expect(tuya.perintah.length).toBe(n);
    // "Masih!" diketuk: benar-benar bangun = suasana pagi (terang penuh, putih netral) + colokan kipas menyala.
    await putar(new Date(jam.getTime() + 5 * 60_000));
    expect(await mesin((m, tx) => m.konfirmasiBangun(tx, kej.id, jam))).not.toBeNull();
    await maju(1_000);
    expect(alat("lampu1").properti).toMatchObject({ switch_led: true, bright_value_v2: 1000, temp_value_v2: 600 });
    expect(alat("plug1").properti.switch_1).toBe(true);

    // Dibatalkan (bukan bangun): tidak ada suasana pagi, aturan "sesudah" tidak dijalankan.
    const batal = await bunyikan("2026-12-06", false, false);
    expect(alat("lampu1").properti).toMatchObject({ switch_led: true, bright_value_v2: 307 });
    await mesin((m, tx) => m.hentikanKejadian(tx, batal.id, "dibatalkan", jam));
    await maju(1_000);
    expect(alat("lampu1").properti).toMatchObject({ bright_value_v2: 307 });
    expect(alat("plug1").properti.switch_1).toBe(false);
  });

  it("kunci ditolak saat alarm: sambungan ditandai bermasalah (spanduk perbaikan), aksi berhenti", async () => {
    const P = await penggunaTersambung();
    const tanggal = "2026-12-03";
    const a = await (
      await L()
    ).buatAlarm(
      P,
      {
        jam: "05:00",
        pengulangan: { jenis: "sekali", tanggal },
        tuya: [{ perangkatId: "ac1", kapan: "bareng", menitSebelum: null, aksi: { nyala: true }, kedip: false, sesudahBangun: "biarkan" }],
      },
      "web",
      { sekarang: wib(`${tanggal}T00:00:00`) },
    );
    tuya.kunciDitolak.add(KUNCI);
    await putar(wib(`${tanggal}T05:00:00`));
    const kej = await kejadianDari(a.id);
    const [l] = await u.pekerja((tx) =>
      tx
        .select()
        .from(schema.langkahKejadian)
        .where(and(eq(schema.langkahKejadian.kejadianId, kej.id), eq(schema.langkahKejadian.jenis, "tuya"))),
    );
    expect(l.hasil).toMatchObject({ lewat: "kunci_bermasalah" });
    expect(await (await T()).statusRumah(P)).toMatchObject({ tersambung: true, bermasalah: true, pesan: expect.stringContaining("Tuya menolak kunci rumahmu") });
    await mesin((m, tx) => m.hentikanKejadian(tx, kej.id, "dibatalkan", jam));
    tuya.kunciDitolak.clear();
  });
});

describe("lapisan darurat tersembunyi (PRD I6)", () => {
  it("mati bawaannya; aktif = telepon ke nomor akun sendiri sesudah X menit, diulang tiap 5 menit, maks 15 sehari, tidak untuk uji alarm", async () => {
    const P = await penggunaTersambung();
    const S = await T();
    expect((await S.statusRumah(P)) as { darurat: unknown }).toMatchObject({ darurat: { aktif: false } });
    await expect(S.aturDarurat(P, { aktif: true, menit: 2, cara: "telepon" }, "web")).rejects.toBeInstanceOf(GalatLayanan);
    await S.aturDarurat(P, { aktif: true, menit: 5, cara: "telepon" }, "web");
    const tanggal = "2026-12-04";
    const a = await (
      await L()
    ).buatAlarm(P, { jam: "05:00", pengulangan: { jenis: "sekali", tanggal }, agendaJudul: "Ujian akhir" }, "web", { sekarang: wib(`${tanggal}T00:00:00`) });
    const Tj = wib(`${tanggal}T05:00:00`);
    await putar(Tj);
    await putar(new Date(Tj.getTime() + 4 * 60_000));
    expect(tuya.pesan).toEqual([]);
    await putar(new Date(Tj.getTime() + 5 * 60_000));
    expect(tuya.pesan).toEqual([{ jalur: "/v1.0/end-user/services/voice/self-send", badan: { message: "AntiKebo: alarm 05.00 Ujian akhir masih berbunyi. Bangun sekarang!" } }]);
    await putar(new Date(Tj.getTime() + 10 * 60_000));
    expect(tuya.pesan).toHaveLength(2);

    // Batas harian: sudah 15 hari ini = berhenti.
    const kej = await kejadianDari(a.id);
    await u.superuser.insert(schema.langkahKejadian).values(
      Array.from({ length: 14 }, (_, i) => ({
        penggunaId: P,
        kejadianId: kej.id,
        jenis: "tuya_darurat",
        urutan: 900 + i,
        jatuhTempoUtc: jam,
        status: "selesai",
        hasil: { terkirim: true },
        diubah: jam,
      })),
    );
    await putar(new Date(Tj.getTime() + 15 * 60_000));
    expect(tuya.pesan).toHaveLength(2);
    await mesin((m, tx) => m.hentikanKejadian(tx, kej.id, "dibatalkan", jam));

    // Uji alarm tidak pernah menelepon (walau lapisan darurat aktif dan sudah lewat 5 menit).
    await u.superuser.delete(schema.langkahKejadian).where(and(eq(schema.langkahKejadian.penggunaId, P), eq(schema.langkahKejadian.jenis, "tuya_darurat")));
    const { ujiAlarm } = await import("@/lib/layanan/kejadian");
    const uji = await ujiAlarm(P, { alarmId: a.id }, "web", { sekarang: jam });
    await putar(new Date(uji.jadwalUtc.getTime() + 1_000));
    const [ku] = await u.pekerja((tx) => tx.select().from(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.id, uji.kejadianId)));
    expect(ku.status).toBe("berbunyi");
    await putar(new Date(uji.jadwalUtc.getTime() + 10 * 60_000));
    expect(tuya.pesan).toHaveLength(2);
  });
});

describe("alat agen rumah pintar (connect_home, list_home_devices, disconnect_home)", () => {
  it("agen menyambungkan rumah dari kunci yang ditempel di chat, melihat perangkat, lalu memutus", async () => {
    tuya.setelUlang();
    const P = await buatPengguna(u, "Nugi Pratama");
    const [p] = await u.superuser.select().from(schema.pengguna).where(eq(schema.pengguna.id, P));
    ab.atur(p.agentbuffSub, { hak: "ok", izin: { kabar: true, suara: true } });
    const { cariAlat } = await import("@/lib/mcp/alat");
    const k = { penggunaId: P, agentbuffSub: p.agentbuffSub, token: {} as never, zona: "Asia/Jakarta", asal: "http://localhost:3100" };

    const s0 = await cariAlat("get_setup_status")!.jalankan(k, {});
    expect(s0.data.smart_home).toEqual({ connected: false, connect_url: "http://localhost:3100/app/rumah" });
    expect(s0.teks).toContain("connect_home");

    const c = await cariAlat("connect_home")!.jalankan(k, { key: KUNCI });
    expect(c.data).toMatchObject({ connected: true, region: "Singapura", devices: 6, online: 5 });
    expect(JSON.stringify(c)).not.toContain("abcdef123456");

    const d = await cariAlat("list_home_devices")!.jalankan(k, {});
    expect(d.teks).toContain("Kamar (AC Kamar; Lampu Kamar; Lampu Plafon)");
    expect(d.teks).toContain("Dispenser, offline");

    const s1 = await cariAlat("get_setup_status")!.jalankan(k, {});
    expect(s1.data.smart_home).toMatchObject({ connected: true, devices: 6 });

    await cariAlat("disconnect_home")!.jalankan(k, { confirm: true });
    expect(await (await T()).statusRumah(P)).toEqual({ tersambung: false });
    await expect(cariAlat("list_home_devices")!.jalankan(k, {})).rejects.toMatchObject({ kode: "belum_tersambung" });
  });
});
