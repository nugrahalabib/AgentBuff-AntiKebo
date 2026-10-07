import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import type { BuatSuara } from "@/lib/suara/antrean";
import { GalatLayanan } from "@/lib/layanan/dasar";
import type { AgentBuffTiruan } from "../tiruan/agentbuff";
import { arahkanDbAplikasi, buatPengguna, siapkanBasisData, type Ujian } from "./harness";
import { siapkanTiruan } from "./lingkungan";

// P5: naskah per alarm, antrean pembuat suara (ulang, galat tetap, pakai ulang klip, 1 per
// pengguna), status suara, klip ke perangkat, dan kontrak dengan pintu suara server tiruan.

let u: Ujian;
let t: AgentBuffTiruan;
const L = () => import("@/lib/layanan/alarm");
const S = () => import("@/lib/layanan/suara");
const A = () => import("@/lib/suara/antrean");

// Waktu uji di masa depan (naskah baru boleh dicoba sejak `now()` basis data), dibulatkan ke menit.
const SIANG = new Date(Math.ceil((Date.now() + 3_600_000) / 60_000) * 60_000);

beforeAll(async () => {
  t = await siapkanTiruan();
  u = await siapkanBasisData();
  arahkanDbAplikasi(u);
}, 60_000);
afterAll(async () => {
  await t?.tutup();
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

async function penggunaBernama(nama = "Nugi Pratama") {
  const id = await buatPengguna(u, nama);
  return id;
}

async function naskah(penggunaId: string) {
  return u.pekerja((tx) => tx.select().from(schema.naskahSuara).where(eq(schema.naskahSuara.penggunaId, penggunaId)));
}

/** Pembuat suara palsu yang mencatat panggilan. */
function palsu(jawab: (n: number) => Awaited<ReturnType<BuatSuara>>) {
  const panggilan: Array<{ sub: string; teks: string }> = [];
  const f: BuatSuara = async (sub, isi) => {
    panggilan.push({ sub, teks: isi.teks });
    return jawab(panggilan.length);
  };
  return { f, panggilan };
}
const OK = (): Awaited<ReturnType<BuatSuara>> => ({ ok: true, audio: Buffer.from("ID3-palsu"), mime: "audio/mpeg", penyedia: "uji", suara: "v1", durasiMs: 1200 });

async function habiskan(f: BuatSuara | undefined, jam: () => Date, putaran = 500) {
  const { prosesAntreanSuara } = await A();
  for (let i = 0; i < putaran; i++) {
    const h = await prosesAntreanSuara(dbPekerja, { buatSuara: f, sekarang: jam });
    if (!h.diproses) break;
  }
}

describe("naskah dan status suara per alarm", () => {
  it("menyimpan alarm merencanakan kalimat karakter dengan nama panggilan; status dibuat lalu siap", async () => {
    const P = await penggunaBernama();
    const a = await (
      await L()
    ).buatAlarm(P, { jam: "05:00", pengulangan: { jenis: "harian" }, karakter: "pelatih_tentara", agendaJudul: "Presentasi klien" }, "web", { sekarang: SIANG });
    const n = await naskah(P);
    expect(n).toHaveLength(12 + 5 + 3 + 2);
    expect(n.some((x) => x.teks === "BANGUN, Nugi! Ini bukan hari libur!")).toBe(true);
    expect(n.some((x) => x.teks.includes("Presentasi klien"))).toBe(true);
    expect(a.suara).toEqual({ status: "dibuat", n: 0, total: 22 });
    const p = palsu(OK);
    await habiskan(p.f, () => SIANG);
    expect(p.panggilan).toHaveLength(22);
    expect((await (await L()).ambilAlarm(P, a.id)).suara).toEqual({ status: "siap" });
  });

  it("alarm kedua dengan karakter sama memakai ulang klip (tanpa memanggil AgentBuff lagi)", async () => {
    const P = await penggunaBernama();
    await (await L()).buatAlarm(P, { jam: "05:00", pengulangan: { jenis: "harian" }, karakter: "ibu_galak" }, "web", { sekarang: SIANG });
    const p1 = palsu(OK);
    await habiskan(p1.f, () => SIANG);
    const b = await (await L()).buatAlarm(P, { jam: "06:00", pengulangan: { jenis: "hari_kerja" }, karakter: "ibu_galak" }, "web", { sekarang: SIANG });
    expect(b.suara).toEqual({ status: "siap" });
    // Baris naskah hilang tetapi klip ada: dipakai ulang tanpa panggilan.
    await u.pekerja((tx) => tx.delete(schema.naskahSuara).where(eq(schema.naskahSuara.penggunaId, P)));
    await (await L()).ubahAlarm(P, b.id, { agendaDetail: "x" }, "web", { sekarang: SIANG });
    const p2 = palsu(OK);
    await habiskan(p2.f, () => SIANG);
    expect(p2.panggilan).toEqual([]);
    expect((await naskah(P)).every((x) => x.status === "siap")).toBe(true);
  });

  it("ganti nama panggilan = kalimat baru direncanakan", async () => {
    const P = await penggunaBernama();
    await (await L()).buatAlarm(P, { jam: "05:00", pengulangan: { jenis: "harian" }, karakter: "teman_nyolot" }, "web", { sekarang: SIANG });
    await (await import("@/lib/layanan/preferensi")).ubahPreferensi(P, { namaPanggilan: "Bos" }, "web");
    expect((await naskah(P)).some((x) => x.teks.includes("Woy Bos"))).toBe(true);
  });

  it("salinan isi kejadian lama tanpa kalimat pribadi tetap menghasilkan naskah (tidak galat)", async () => {
    const { kamusUntuk } = await import("@/lib/i18n/kamus-server");
    const k = { bahasa: "id", namaSapaan: "Nugi", t: kamusUntuk("id") } as Parameters<Awaited<ReturnType<typeof S>>["kalimatAlarm"]>[1];
    const lama = { karakter: "ibu_galak", agendaJudul: "Uji", suaraId: null } as unknown as Parameters<Awaited<ReturnType<typeof S>>["kalimatAlarm"]>[0];
    const k1 = (await S()).kalimatAlarm(lama, k);
    expect(k1.length).toBeGreaterThan(12);
    expect(k1.some((x) => x.jenis === "pribadi")).toBe(false);
  });

  it("kalimat pribadi kasar ditolak; Kustom tanpa kalimat pribadi ditolak; Kustom = hanya kalimat pribadi", async () => {
    const P = await penggunaBernama();
    const { buatAlarm } = await L();
    await expect(buatAlarm(P, { jam: "05:00", kalimatPribadi: ["bangun dasar kontol"] }, "web", { sekarang: SIANG })).rejects.toThrow("ada kalimat pribadi yang terlalu kasar");
    await expect(buatAlarm(P, { jam: "05:00", karakter: "kustom" }, "web", { sekarang: SIANG })).rejects.toThrow("karakter Kustom butuh paling sedikit satu kalimat pribadi");
    await buatAlarm(P, { jam: "05:00", karakter: "kustom", kalimatPribadi: ["Ingat cicilan motor!", "Kopi sudah dingin!"] }, "web", { sekarang: SIANG });
    expect((await naskah(P)).map((x) => x.teks).sort()).toEqual(["Ingat cicilan motor!", "Kopi sudah dingin!"]);
  });
});

describe("antrean pembuat suara", () => {
  it("galat sementara diulang dengan jeda berlipat (paling lama 6 jam), menghormati ulangiSetelahMs", async () => {
    const { jedaUlang } = await A();
    expect([1, 2, 3, 4].map((n) => jedaUlang(n))).toEqual([60_000, 120_000, 240_000, 480_000]);
    expect(jedaUlang(20)).toBe(6 * 3_600_000);
    expect(jedaUlang(1, 900_000)).toBe(900_000);
    await habiskan(palsu(OK).f, () => SIANG);
    const P = await penggunaBernama();
    await (await L()).buatAlarm(P, { jam: "05:00", karakter: "kustom", kalimatPribadi: ["Bangun, Nugi!"] }, "web", { sekarang: SIANG });
    const { prosesAntreanSuara } = await A();
    const gagal = palsu(() => ({ ok: false, status: 409, alasan: "agen_tidak_aktif" }));
    let jam = SIANG;
    await prosesAntreanSuara(dbPekerja, { buatSuara: gagal.f, sekarang: () => jam });
    let [n] = await naskah(P);
    expect(n).toMatchObject({ status: "menunggu", alasan: "agen_tidak_aktif", percobaan: 1 });
    expect(n.cobaLagiSetelah.getTime()).toBe(SIANG.getTime() + 60_000);
    // Belum waktunya: tidak dicoba.
    await prosesAntreanSuara(dbPekerja, { buatSuara: gagal.f, sekarang: () => new Date(SIANG.getTime() + 30_000) });
    expect(gagal.panggilan).toHaveLength(1);
    jam = new Date(SIANG.getTime() + 61_000);
    await prosesAntreanSuara(dbPekerja, { buatSuara: gagal.f, sekarang: () => jam });
    [n] = await naskah(P);
    expect(n.percobaan).toBe(2);
    expect(n.cobaLagiSetelah.getTime()).toBe(jam.getTime() + 120_000);
    jam = new Date(jam.getTime() + 121_000);
    await prosesAntreanSuara(dbPekerja, { buatSuara: palsu(OK).f, sekarang: () => jam });
    expect((await naskah(P))[0]).toMatchObject({ status: "siap", alasan: null });
  });

  it("galat tetap berhenti dan tampil sebagai alasan; izin diberi = dicoba lagi", async () => {
    await habiskan(palsu(OK).f, () => SIANG);
    const P = await penggunaBernama();
    const a = await (await L()).buatAlarm(P, { jam: "05:00", karakter: "kustom", kalimatPribadi: ["Bangun!"] }, "web", { sekarang: SIANG });
    const g = palsu(() => ({ ok: false, status: 403, alasan: "belum_diizinkan" }));
    await habiskan(g.f, () => SIANG, 5);
    expect(g.panggilan).toHaveLength(1);
    expect((await (await L()).ambilAlarm(P, a.id)).suara).toEqual({ status: "belum", alasan: "Beri izin suara di AgentBuff dulu." });
    expect(await (await S()).antreUlangSesudahIzin(P)).toBe(1);
    await habiskan(palsu(OK).f, () => SIANG);
    expect((await (await L()).ambilAlarm(P, a.id)).suara).toEqual({ status: "siap" });
  });

  it("klip siap dikabarkan ke pelanggan peristiwa pengguna itu (perangkat mengunduh klip baru)", async () => {
    const { pasangSumberPeristiwa, langganan } = await import("@/lib/peristiwa");
    pasangSumberPeristiwa((cb) => u.pg.listen("antikebo_peristiwa", cb));
    await habiskan(palsu(OK).f, () => SIANG);
    const P = await penggunaBernama();
    const lain = await penggunaBernama();
    const diterima: string[] = [];
    const diterimaLain: string[] = [];
    const lepas = await langganan(P, (e) => diterima.push(e.j));
    const lepasLain = await langganan(lain, (e) => diterimaLain.push(e.j));
    await (await L()).buatAlarm(P, { jam: "05:00", karakter: "kustom", kalimatPribadi: ["Kabari aku!"] }, "web", { sekarang: SIANG });
    await habiskan(palsu(OK).f, () => SIANG);
    await expect.poll(() => diterima.includes("klip_siap"), { timeout: 3_000 }).toBe(true);
    expect(diterimaLain).not.toContain("klip_siap");
    lepas();
    lepasLain();
  });

  it("paralel paling banyak 1 per pengguna; naskah yang ditinggal worker mati diulang", async () => {
    const P1 = await penggunaBernama();
    const P2 = await penggunaBernama();
    // Hanya pengguna uji ini: pastikan antrean lain kosong dulu.
    await habiskan(palsu(OK).f, () => SIANG);
    for (const P of [P1, P2]) await (await L()).buatAlarm(P, { jam: "05:00", karakter: "kustom", kalimatPribadi: ["Satu!", "Dua!", "Tiga!"] }, "web", { sekarang: SIANG });
    const { prosesAntreanSuara } = await A();
    const p = palsu(OK);
    const h = await prosesAntreanSuara(dbPekerja, { buatSuara: p.f, sekarang: () => SIANG, maks: 4 });
    const milik = await u.pekerja((tx) =>
      tx
        .select()
        .from(schema.naskahSuara)
        .where(sql`pengguna_id in (${P1}, ${P2}) and status = 'siap'`),
    );
    expect(h.diproses).toBeLessThanOrEqual(4);
    expect(milik.filter((x) => x.penggunaId === P1).length).toBeLessThanOrEqual(1);
    expect(milik.filter((x) => x.penggunaId === P2).length).toBeLessThanOrEqual(1);
    // Macet: satu naskah ditandai `dibuat` 10 menit lalu.
    const [m] = await u.pekerja((tx) =>
      tx
        .update(schema.naskahSuara)
        .set({ status: "dibuat", diubah: new Date(SIANG.getTime() - 10 * 60_000) })
        .where(and(eq(schema.naskahSuara.penggunaId, P1), eq(schema.naskahSuara.status, "menunggu")))
        .returning(),
    );
    await habiskan(palsu(OK).f, () => SIANG);
    const [ulang] = await u.pekerja((tx) => tx.select().from(schema.naskahSuara).where(eq(schema.naskahSuara.id, m.id)));
    expect(ulang.status).toBe("siap");
  });
});

describe("kontrak dengan pintu suara (server tiruan) dan klip ke perangkat", () => {
  it("klip MP3 dari AgentBuff tiruan tersimpan, masuk jadwal perangkat, dan bisa diunduh dengan token", async () => {
    const P = await penggunaBernama();
    const [pg] = await u.superuser.select().from(schema.pengguna).where(eq(schema.pengguna.id, P));
    t.atur(pg.agentbuffSub, { hak: "ok", nama: "Nugi Pratama", email: "nugi.suara@contoh.id", izin: { kabar: true, suara: true } });
    await (
      await L()
    ).buatAlarm(P, { jam: "05:00", pengulangan: { jenis: "harian" }, karakter: "kustom", kalimatPribadi: ["Bangun, Nugi! Presentasi jam sembilan!"] }, "web", { sekarang: SIANG });
    await habiskan(undefined, () => new Date());
    const [k] = await u.pekerja((tx) => tx.select().from(schema.klipSuara).where(eq(schema.klipSuara.penggunaId, P)));
    expect(k.mime).toBe("audio/mpeg");
    expect(k.audio.length).toBeGreaterThan(200);
    expect(k.durasiMs).toBeGreaterThan(0);

    const Pr = await import("@/lib/layanan/perangkat");
    const kode = await Pr.mintaKodeSambung({ nama: "PC" });
    await Pr.setujuiKodeSambung(P, kode.kode, "web");
    const h = await Pr.ambilTokenSambung({ kode: kode.kode, rahasia: kode.rahasia });
    if (h.status !== "tersambung") throw new Error("sambung gagal");
    const j = await Pr.jadwalPerangkat(P, SIANG);
    const om = j[0].omelan;
    expect(om).toEqual([{ jenis: "pribadi", teks: "Bangun, Nugi! Presentasi jam sembilan!", klip: k.hash }]);
    const { GET } = await import("@/app/api/perangkat/klip/[hash]/route");
    const r = await GET(new Request(`http://localhost:3100/api/perangkat/klip/${k.hash}`, { headers: { Authorization: `Bearer ${h.token}` } }), {
      params: Promise.resolve({ hash: k.hash }),
    });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("audio/mpeg");
    expect(r.headers.get("cache-control")).toContain("immutable");
    expect(Buffer.from(await r.arrayBuffer()).equals(k.audio)).toBe(true);
    // Pengguna lain tidak bisa mengunduh klip ini.
    const lain = await penggunaBernama();
    expect(await (await S()).ambilKlip(lain, k.hash)).toBeNull();
  });

  it("pilihan suara dari AgentBuff dan contoh dengar lewat antrean", async () => {
    const P = await penggunaBernama();
    const [pg] = await u.superuser.select().from(schema.pengguna).where(eq(schema.pengguna.id, P));
    t.atur(pg.agentbuffSub, { hak: "ok", nama: "Nugi Pratama", email: "nugi.pilih@contoh.id", izin: { kabar: true, suara: true } });
    const { pilihanSuara, contohSuara } = await S();
    const d = await pilihanSuara(P);
    expect(d.suara.length).toBeGreaterThan(0);
    const c1 = await contohSuara(P, d.suara[0].id);
    expect(c1.status).toBe("menunggu");
    await habiskan(undefined, () => new Date());
    expect((await contohSuara(P, d.suara[0].id)).status).toBe("siap");
    t.atur(pg.agentbuffSub, { izin: { kabar: true, suara: false } });
    const g = await pilihanSuara(P).catch((e) => e);
    expect(g).toBeInstanceOf(GalatLayanan);
    expect((g as GalatLayanan).kode).toBe("perlu_izin");
  });

  it("bersih-bersih menghapus klip yang tidak dibutuhkan alarm mana pun sesudah 30 hari", async () => {
    const P = await penggunaBernama();
    const a = await (await L()).buatAlarm(P, { jam: "05:00", karakter: "kustom", kalimatPribadi: ["Lama!", "Tetap!"] }, "web", { sekarang: SIANG });
    await habiskan(palsu(OK).f, () => SIANG);
    await (await L()).ubahAlarm(P, a.id, { kalimatPribadi: ["Tetap!"] }, "web", { sekarang: SIANG });
    const lama = new Date(Date.now() - 40 * 86_400_000);
    await u.pekerja((tx) => tx.update(schema.naskahSuara).set({ diubah: lama }).where(eq(schema.naskahSuara.penggunaId, P)));
    await u.pekerja((tx) => tx.update(schema.klipSuara).set({ dipakaiTerakhir: lama }).where(eq(schema.klipSuara.penggunaId, P)));
    const { bersihkanSuara } = await S();
    const n = await dbPekerja().transaction((tx) => bersihkanSuara(tx, new Date()));
    expect(n).toBeGreaterThanOrEqual(1);
    expect((await naskah(P)).map((x) => x.teks)).toEqual(["Tetap!"]);
  });
});
