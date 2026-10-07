import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { decrypt } from "http_ece";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import type { IsiNotif } from "@/lib/pesan";
import type { KirimPermintaan } from "@/lib/push";
import type { AgentBuffTiruan } from "../tiruan/agentbuff";
import { arahkanDbAplikasi, buatPengguna, siapkanBasisData, type Ujian } from "./harness";
import { ASAL_APP, siapkanTiruan } from "./lingkungan";

// Aturan beku K-07 terhadap migrasi ASLI (PGlite, peran tanpa BYPASSRLS) + server tiruan AgentBuff:
// awal beku tercatat sekali, alarm tetap berbunyi selama tenggang 3 hari lalu ditahan (server dan
// jadwal perangkat), kabar sekali saat beku, pengingat malam terang-terangan sebelum alarm ditahan.

process.env.LOG_LEVEL ??= "silent";

let u: Ujian;
let t: AgentBuffTiruan;
/** Jam server tiruan (jeda antarpesan per kanal dihitung dari jam ini). */
let jam = new Date("2026-12-01T00:00:00Z");
const wib = (s: string) => new Date(`${s}+07:00`);
const JAM = 3_600_000;

const L = () => import("@/lib/layanan/alarm");
const M = () => import("@/lib/penjadwal/mesin");
const Kn = () => import("@/lib/layanan/kanal");

const penerima = new Map<string, { ecdh: ReturnType<typeof createECDH>; auth: Buffer }>();
const diterima: Array<{ endpoint: string; isi: IsiNotif }> = [];
const kirimPermintaanPush: KirimPermintaan = async (endpoint, init) => {
  const p = penerima.get(endpoint)!;
  diterima.push({ endpoint, isi: JSON.parse(decrypt(init.body!, { version: "aes128gcm", privateKey: p.ecdh, authSecret: p.auth }).toString("utf8")) as IsiNotif });
  return 201;
};
function langgananBaru() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  const endpoint = `http://127.0.0.1:9/push/${randomUUID()}`;
  penerima.set(endpoint, { ecdh, auth });
  return { endpoint, keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: auth.toString("base64url") } };
}

beforeAll(async () => {
  t = await siapkanTiruan({ sekarang: () => jam.getTime() });
  const v = createECDH("prime256v1");
  v.generateKeys();
  Object.assign(process.env, {
    VAPID_PUBLIC_KEY: v.getPublicKey().toString("base64url"),
    VAPID_PRIVATE_KEY: v.getPrivateKey().toString("base64url"),
    VAPID_SUBJECT: "mailto:uji@antikebo.invalid",
  });
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

async function pengguna() {
  const P = await buatPengguna(u, "Nugi Pratama");
  const [p] = await u.superuser.select().from(schema.pengguna).where(eq(schema.pengguna.id, P));
  const tp = t.atur(p.agentbuffSub, { hak: "ok", nama: "Nugi Pratama", email: `${P}@contoh.id`, izin: { kabar: true, suara: true } });
  return { P, sub: p.agentbuffSub, tg: tp.kanal[0].id };
}

async function aturHak(P: string, isi: { aktif: boolean; bekuSejak: Date | null; diperiksaPada?: Date; bekuDikabari?: Date | null; alasan?: string }) {
  const nilai = {
    aktif: isi.aktif,
    alasan: isi.alasan ?? (isi.aktif ? "ok" : "akses_berakhir"),
    bekuSejak: isi.bekuSejak,
    bekuDikabari: isi.bekuDikabari ?? null,
    diperiksaPada: isi.diperiksaPada ?? new Date(),
    terakhirBaikPada: isi.diperiksaPada ?? new Date(),
  };
  await u.superuser
    .insert(schema.statusHak)
    .values({ penggunaId: P, ...nilai })
    .onConflictDoUpdate({ target: schema.statusHak.penggunaId, set: nilai });
}

async function statusHak(P: string) {
  const [h] = await u.superuser.select().from(schema.statusHak).where(eq(schema.statusHak.penggunaId, P));
  return h;
}

async function kejadianDari(alarmId: string) {
  return u.pekerja((tx) => tx.select().from(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.alarmId, alarmId)).orderBy(schema.kejadianAlarm.jadwalUtc));
}

async function klaim(sekarang: Date) {
  const { klaimJatuhTempo } = await M();
  return dbPekerja().transaction((tx) => klaimJatuhTempo(tx, sekarang));
}

describe("awal beku tercatat dari jawaban AgentBuff (K-07)", () => {
  it("beku_sejak terisi sekali, tetap selama beku, kosong lagi saat pulih; tak terjangkau tidak membekukan", async () => {
    const { P, sub } = await pengguna();
    const { cekHak } = await import("@/lib/agentbuff/status");
    expect((await cekHak({ id: P, agentbuffSub: sub }, { ketat: true })).aktif).toBe(true);
    expect((await statusHak(P)).bekuSejak).toBeNull();

    t.atur(sub, { hak: "akses_berakhir" });
    expect((await cekHak({ id: P, agentbuffSub: sub }, { ketat: true })).aktif).toBe(false);
    const awal = (await statusHak(P)).bekuSejak;
    expect(awal).toBeInstanceOf(Date);
    await new Promise((r) => setTimeout(r, 20));
    await cekHak({ id: P, agentbuffSub: sub }, { ketat: true });
    expect((await statusHak(P)).bekuSejak?.getTime()).toBe(awal!.getTime());

    t.atur(sub, { hak: "ok" });
    expect((await cekHak({ id: P, agentbuffSub: sub }, { ketat: true })).aktif).toBe(true);
    expect(await statusHak(P)).toMatchObject({ aktif: true, bekuSejak: null, bekuDikabari: null });
  });
});

describe("penjadwal dan jadwal perangkat", () => {
  it("dalam tenggang tetap berbunyi; sesudah tenggang ditahan (dibatalkan, tanpa langkah), kejadian berikutnya tetap disiapkan", async () => {
    const { P } = await pengguna();
    const a = await (
      await L()
    ).buatAlarm(P, { jam: "05:00", pengulangan: { jenis: "harian" }, masihBangun: { aktif: false, menit: 5, batasDtk: 60 } }, "web", {
      sekarang: wib("2026-12-01T12:00:00"),
    });
    const [k1] = await kejadianDari(a.id);
    // Beku 1 hari sebelum jadwal: masih tenggang.
    await aturHak(P, { aktif: false, bekuSejak: new Date(k1.jadwalUtc.getTime() - 24 * JAM) });
    expect((await klaim(k1.jadwalUtc)).map((x) => x.hasil)).toEqual(["berbunyi"]);
    await dbPekerja().transaction(async (tx) => (await M()).hentikanKejadian(tx, k1.id, "bangun", new Date(k1.jadwalUtc.getTime() + 60_000)));

    // Kejadian berikutnya jatuh sesudah akhir tenggang: ditahan.
    const k2 = (await kejadianDari(a.id)).find((x) => x.status === "menunggu")!;
    expect(k2.jadwalUtc.getTime()).toBe(k1.jadwalUtc.getTime() + 24 * JAM);
    await aturHak(P, { aktif: false, bekuSejak: new Date(k2.jadwalUtc.getTime() - 72 * JAM) });
    const h = await klaim(k2.jadwalUtc);
    expect(h.map((x) => x.hasil)).toEqual(["ditahan"]);
    const semua = await kejadianDari(a.id);
    expect(semua.find((x) => x.id === k2.id)!.status).toBe("dibatalkan");
    expect(await u.pekerja((tx) => tx.select().from(schema.langkahKejadian).where(eq(schema.langkahKejadian.kejadianId, k2.id)))).toHaveLength(0);
    // Hari berikutnya tetap disiapkan: begitu pulih, alarm berbunyi lagi.
    const k3 = semua.find((x) => x.status === "menunggu")!;
    expect(k3.jadwalUtc.getTime()).toBe(k2.jadwalUtc.getTime() + 24 * JAM);
    await aturHak(P, { aktif: true, bekuSejak: null });
    expect((await klaim(k3.jadwalUtc)).map((x) => x.hasil)).toEqual(["berbunyi"]);
    // Kejadian yang ditahan tidak masuk Riwayat.
    const r = await (await import("@/lib/layanan/riwayat")).riwayatPengguna(P, new Date(k3.jadwalUtc.getTime() + JAM));
    expect(r.kejadian.map((x) => x.id)).not.toContain(k2.id);
  });

  it("jadwal perangkat siaga tidak memuat alarm yang akan ditahan", async () => {
    const { P } = await pengguna();
    const sekarang = wib("2026-12-10T12:00:00");
    const pagi = await (await L()).buatAlarm(P, { jam: "05:00", pengulangan: { jenis: "harian" } }, "web", { sekarang });
    const siang = await (await L()).buatAlarm(P, { jam: "11:00", pengulangan: { jenis: "harian" } }, "web", { sekarang });
    const { salinanJadwal } = await import("@/lib/layanan/perangkat");
    const alarmDi = async () => (await salinanJadwal(P, sekarang)).kejadian.map((x) => x.alarmId);
    expect(await alarmDi()).toEqual([pagi.id, siang.id]);
    // Tenggang berakhir 08.00 besok: 05.00 masih berbunyi, 11.00 ditahan.
    await aturHak(P, { aktif: false, bekuSejak: new Date(wib("2026-12-11T08:00:00").getTime() - 72 * JAM) });
    expect(await alarmDi()).toEqual([pagi.id]);
    await aturHak(P, { aktif: true, bekuSejak: null });
    expect(await alarmDi()).toEqual([pagi.id, siang.id]);
  });
});

describe("sapuan hak dan kabar beku di worker", () => {
  it("memeriksa ulang pemilik dengan alarm dalam 48 jam yang pemeriksaannya basi, lalu mengabari beku SEKALI", async () => {
    const { P, sub, tg } = await pengguna();
    const sekarang = wib("2026-12-20T10:00:00");
    const l = langgananBaru();
    await (await Kn()).daftarkanPush(P, { langganan: l }, "web");
    await (await import("@/lib/layanan/preferensi")).ubahPreferensi(P, { bawaan: { spam: { kanal: [tg], jedaDtk: null, batasMenit: null } } }, "web");
    await (await L()).buatAlarm(P, { jam: "05:00", pengulangan: { jenis: "harian" } }, "web", { sekarang });
    const { sapuHak } = await import("@/lib/layanan/beku");
    const diperiksa: string[] = [];
    const cekHak = (async (p: { id: string }) => {
      diperiksa.push(p.id);
      return { aktif: true, alasan: "ok", pesan: null, tidakTerjangkau: false };
    }) as unknown as typeof import("@/lib/agentbuff/status").cekHak;
    jam = sekarang;
    const sapu = () => sapuHak(dbPekerja, { sekarang, cekHak, kirimPermintaanPush, asal: ASAL_APP, batas: 500 });

    // Baru diperiksa: tidak ditanya lagi. Basi (aktif > 6 jam): ditanya.
    await aturHak(P, { aktif: true, bekuSejak: null, diperiksaPada: new Date(sekarang.getTime() - 5 * JAM) });
    await sapu();
    expect(diperiksa).not.toContain(P);
    await aturHak(P, { aktif: true, bekuSejak: null, diperiksaPada: new Date(sekarang.getTime() - 7 * JAM) });
    await sapu();
    expect(diperiksa).toContain(P);

    // Beku terdeteksi: kabar sekali (notifikasi + kanal bawaan) dengan akhir tenggang di zona pengguna.
    const bekuSejak = wib("2026-12-20T09:00:00");
    await aturHak(P, { aktif: false, bekuSejak, diperiksaPada: new Date(sekarang.getTime() - 10 * 60_000) });
    const h = await sapu();
    expect(h.dikabari).toBe(1);
    const pesan = t.kiriman.filter((k) => k.sub === sub && k.kanal === tg);
    expect(pesan).toHaveLength(1);
    expect(pesan[0].teks).toBe(
      `⚠️ Nugi, akses AntiKebo-mu berakhir. Alarm yang sudah terpasang masih berbunyi sampai Rabu, 23 Desember pukul 09.00, sesudah itu berhenti sampai aksesmu aktif lagi. Perpanjang: ${t.url}/checkout`,
    );
    expect(diterima.filter((d) => d.endpoint === l.endpoint).at(-1)?.isi).toMatchObject({ jenis: "beku", judul: "Akses AntiKebo berakhir", url: `${t.url}/checkout` });
    const [jejak] = await u.pekerja((tx) =>
      tx
        .select()
        .from(schema.kirimanKanal)
        .where(and(eq(schema.kirimanKanal.penggunaId, P), eq(schema.kirimanKanal.jenis, "beku"))),
    );
    expect(jejak.status).toBe("terkirim");
    // Putaran berikutnya: tidak dikabari lagi.
    expect((await sapu()).dikabari).toBe(0);
    expect(t.kiriman.filter((k) => k.sub === sub && k.kanal === tg)).toHaveLength(1);
  });
});

describe("pengingat malam saat beku (PRD A4)", () => {
  it("alarm besok ditahan: peringatan tegas walau pengingat malam dimatikan; masih tenggang: baris tambahan", async () => {
    const { P, sub, tg } = await pengguna();
    const l = langgananBaru();
    await (await Kn()).daftarkanPush(P, { langganan: l }, "web");
    await (await import("@/lib/layanan/preferensi")).ubahPreferensi(P, { bawaan: { spam: { kanal: [tg], jedaDtk: null, batasMenit: null } } }, "web");
    const { prosesPengingatMalam } = await import("@/lib/layanan/pengingat");
    const jalan = (sekarang: Date) => {
      jam = sekarang;
      return prosesPengingatMalam(dbPekerja, { sekarang, kirimPermintaanPush, asal: ASAL_APP });
    };
    const L_ = await L();
    const sekali = (tanggal: string) =>
      L_.buatAlarm(P, { jam: "05:00", pengulangan: { jenis: "sekali", tanggal }, masihBangun: { aktif: false, menit: 5, batasDtk: 60 } }, "web", {
        sekarang: wib(`${tanggal}T00:00:00`),
      });

    // Masih tenggang (berakhir 30 Des 09.00), alarm 29 Des berbunyi: pengingat + baris tenggang.
    await aturHak(P, { aktif: false, bekuSejak: wib("2026-12-27T09:00:00") });
    await sekali("2026-12-29");
    await jalan(wib("2026-12-28T22:00:30"));
    let pesan = t.kiriman.filter((k) => k.sub === sub && k.kanal === tg);
    expect(pesan).toHaveLength(1);
    expect(pesan[0].teks).toBe(
      `🌙 Selamat malam, Nugi!\nAlarm berikutnya: 05.00.\nBelum ada perangkat siaga! Nyalakan PC atau buka Mode Jam Meja di HP sebelum tidur.\n⚠️ Akses AntiKebo-mu berakhir: alarm berhenti berbunyi mulai Rabu, 30 Desember pukul 09.00. Perpanjang: ${t.url}/checkout\nAtur alarm: ${ASAL_APP}/app`,
    );

    // Pengingat malam dimatikan, alarm 31 Des ditahan: tetap diberi tahu terang-terangan.
    await (await import("@/lib/layanan/preferensi")).ubahPreferensi(P, { pengingatMalam: false }, "web");
    await sekali("2026-12-31");
    await jalan(wib("2026-12-30T22:00:30"));
    pesan = t.kiriman.filter((k) => k.sub === sub && k.kanal === tg);
    expect(pesan).toHaveLength(2);
    expect(pesan[1].teks).toBe(
      `🌙 Selamat malam, Nugi!\n⚠️ Alarm 05.00 TIDAK akan berbunyi karena akses AntiKebo-mu berakhir. Perpanjang supaya alarm berbunyi lagi: ${t.url}/checkout`,
    );
    expect(diterima.filter((d) => d.endpoint === l.endpoint).at(-1)?.isi).toMatchObject({ jenis: "beku", judul: "Akses AntiKebo berakhir" });

    // Pengingat dimatikan dan tidak beku: tidak ada pesan.
    await aturHak(P, { aktif: true, bekuSejak: null });
    await sekali("2027-01-02");
    await jalan(wib("2027-01-01T22:00:30"));
    expect(t.kiriman.filter((k) => k.sub === sub && k.kanal === tg)).toHaveLength(2);
  });
});
