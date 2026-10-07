import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { and, eq, sql } from "drizzle-orm";
import { decrypt } from "http_ece";
import { importJWK, jwtVerify } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { GalatLayanan } from "@/lib/layanan/dasar";
import type { IsiNotif } from "@/lib/pesan";
import type { KirimPermintaan } from "@/lib/push";
import type { AgentBuffTiruan } from "../tiruan/agentbuff";
import { arahkanDbAplikasi, buatPengguna, siapkanBasisData, type Ujian } from "./harness";
import { ASAL_APP, siapkanTiruan } from "./lingkungan";

// P6 terhadap migrasi ASLI (PGlite, peran tanpa BYPASSRLS) + server tiruan AgentBuff dengan jam
// yang dikendalikan uji: spam per kanal (jeda platform, terlalu_cepat menggeser jadwal, kanal tidak
// siap berhenti, batas waktu, tunda), pesan penutup, "Masih bangun?", kabar terlewat, Web Push
// terenkripsi (dibuka seperti peramban), pengingat malam, uji kanal, dan jejak kiriman.

process.env.LOG_LEVEL ??= "silent";

let u: Ujian;
let t: AgentBuffTiruan;
let jam = new Date("2026-11-01T05:00:00Z");
const wib = (s: string) => new Date(`${s}+07:00`);

const L = () => import("@/lib/layanan/alarm");
const M = () => import("@/lib/penjadwal/mesin");
const Kn = () => import("@/lib/layanan/kanal");

// ------------------------------------------------------------------ penerima push palsu

type Diterima = { endpoint: string; headers: Record<string, string>; isi: IsiNotif };
const penerima = new Map<string, { ecdh: ReturnType<typeof createECDH>; auth: Buffer }>();
const diterima: Diterima[] = [];
const statusPush = 201;

/** Buka isi Web Push persis seperti peramban (kunci privat langganan + rahasia auth). */
function buka(endpoint: string, body: Buffer): IsiNotif {
  const p = penerima.get(endpoint)!;
  return JSON.parse(decrypt(body, { version: "aes128gcm", privateKey: p.ecdh, authSecret: p.auth }).toString("utf8")) as IsiNotif;
}

const kirimPermintaanPush: KirimPermintaan = async (endpoint, init) => {
  diterima.push({ endpoint, headers: init.headers, isi: buka(endpoint, init.body!) });
  return statusPush;
};

function langgananBaru(dasar = "http://127.0.0.1:9/push") {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  const endpoint = `${dasar}/${randomUUID()}`;
  penerima.set(endpoint, { ecdh, auth });
  return { endpoint, keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: auth.toString("base64url") } };
}

// ------------------------------------------------------------------ penyiapan

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
  const { pasangSaluran } = await M();
  const { saluranAsli } = await import("@/lib/penjadwal/saluran-asli");
  pasangSaluran(saluranAsli({ db: dbPekerja, asal: ASAL_APP, kirimPermintaanPush }));
}, 60_000);

afterAll(async () => {
  (await M()).pasangSaluran(null);
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

/** Pengguna baru yang dikenal server tiruan; kanal: [0] Telegram siap, [1] WhatsApp belum siap, [2] Discord siap. */
async function pengguna(ubah: Parameters<AgentBuffTiruan["atur"]>[1] = {}) {
  const P = await buatPengguna(u, "Nugi Pratama");
  const [p] = await u.superuser.select().from(schema.pengguna).where(eq(schema.pengguna.id, P));
  const tp = t.atur(p.agentbuffSub, { hak: "ok", nama: "Nugi Pratama", email: `${P}@contoh.id`, izin: { kabar: true, suara: true }, ...ubah });
  const [tg, wa, dc] = tp.kanal.map((k) => k.id);
  return { P, sub: p.agentbuffSub, tg, wa, dc };
}

async function alarmSekali(P: string, tanggal: string, isi: Record<string, unknown>) {
  return (await L()).buatAlarm(P, { jam: "05:00", pengulangan: { jenis: "sekali", tanggal }, masihBangun: { aktif: false, menit: 5, batasDtk: 60 }, ...isi }, "web", {
    sekarang: wib(`${tanggal}T00:00:00`),
  });
}

async function kejadianDari(alarmId: string) {
  const [k] = await u.pekerja((tx) => tx.select().from(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.alarmId, alarmId)));
  return k;
}
async function kiriman(kejadianId: string) {
  return u.pekerja((tx) => tx.select().from(schema.kirimanKanal).where(eq(schema.kirimanKanal.kejadianId, kejadianId)).orderBy(schema.kirimanKanal.dibuat));
}
const pesanKe = (sub: string, kanal?: string) => t.kiriman.filter((k) => k.sub === sub && (!kanal || k.kanal === kanal));
const pushUntuk = (endpoint: string) => diterima.filter((d) => d.endpoint === endpoint).map((d) => d.isi);

async function mesin<T>(fn: (m: Awaited<ReturnType<typeof M>>, tx: Parameters<Parameters<Db["transaction"]>[0]>[0]) => Promise<T>): Promise<T> {
  const m = await M();
  return dbPekerja().transaction((tx) => fn(m, tx));
}

// ------------------------------------------------------------------ uji

describe("spam kanal saat berbunyi (PRD G2, G3, G6)", () => {
  it("per kanal dengan jeda platform; kanal belum siap berhenti; terlalu_cepat menggeser; tunda menghentikan; penutup sesudah bangun", async () => {
    const { P, sub, tg, wa, dc } = await pengguna();
    const l = langgananBaru();
    await (await Kn()).daftarkanPush(P, { langganan: l }, "web");
    const a = await alarmSekali(P, "2026-11-02", { agendaJudul: "Presentasi klien", spam: { kanal: [tg, wa, dc], jedaDtk: null, batasMenit: null } });
    const T = wib("2026-11-02T05:00:00");

    await putar(T);
    const kej = await kejadianDari(a.id);
    expect(kej.status).toBe("berbunyi");
    // Telegram dan Discord pesan #1; WhatsApp belum siap = berhenti dan tercatat.
    expect(pesanKe(sub, tg)).toHaveLength(1);
    expect(pesanKe(sub, dc)).toHaveLength(1);
    expect(pesanKe(sub, wa)).toHaveLength(0);
    const teks = pesanKe(sub, tg)[0].teks;
    expect(teks).toContain("Nugi");
    expect(teks).toContain("📌 Presentasi klien");
    expect(teks).toContain(`${ASAL_APP}/app/bunyi/${kej.id}`);
    expect(teks).toMatch(/#1\b|ke-1\b/);
    expect((await kiriman(kej.id)).map((x) => [x.kanalId, x.status, x.alasan, x.ke])).toEqual(
      expect.arrayContaining([
        [tg, "terkirim", null, 1],
        [dc, "terkirim", null, 1],
        [wa, "gagal", "kanal_tidak_siap", null],
      ]),
    );
    // Notifikasi web berbunyi: tag kejadian, diulang, ditahan, membuka layar alarm.
    expect(pushUntuk(l.endpoint)).toEqual([expect.objectContaining({ jenis: "bunyi", tag: kej.id, url: `/app/bunyi/${kej.id}`, ulang: true, tahan: true })]);

    // Telegram 15 dtk, Discord 20 dtk (bawaan PRD G2).
    await maju(14_000);
    expect(pesanKe(sub, tg)).toHaveLength(1);
    await maju(1_000);
    expect(pesanKe(sub, tg)).toHaveLength(2);
    expect(pesanKe(sub, dc)).toHaveLength(1);
    await maju(5_000);
    expect(pesanKe(sub, dc)).toHaveLength(2);
    expect(pesanKe(sub, tg)[1].teks).toMatch(/#2\b|ke-2\b/);
    expect(pesanKe(sub, tg)[0].teks).not.toBe(pesanKe(sub, tg)[1].teks);

    // Pesan uji 1 dtk sebelum giliran Telegram: AgentBuff menjawab terlalu_cepat (min 5 dtk),
    // spam dicatat "ditunda" lalu dicoba lagi tepat sesudah jeda dari AgentBuff habis.
    jam = new Date(T.getTime() + 29_000);
    await (await Kn()).ujiKanal(P, { kanal: tg }, "web");
    await putar(new Date(T.getTime() + 30_000));
    expect((await kiriman(kej.id)).filter((x) => x.kanalId === tg && x.status === "ditunda")).toHaveLength(1);
    expect(pushUntuk(l.endpoint)).toHaveLength(2); // notifikasi diulang tiap 30 dtk
    await maju(3_000);
    expect(pesanKe(sub, tg).filter((k) => k.kunci.startsWith(kej.id))).toHaveLength(2);
    await maju(1_000);
    expect(pesanKe(sub, tg).filter((k) => k.kunci.startsWith(kej.id))).toHaveLength(3);
    expect(pesanKe(sub, tg).at(-1)!.teks).toMatch(/#3\b|ke-3\b/);

    // Tunda 5 menit: spam dan notifikasi berhenti; sesudah tunda habis lanjut dengan penghitung berlanjut.
    const sampai = new Date(jam.getTime() + 5 * 60_000);
    await mesin((m, tx) => m.tundaKejadian(tx, kej.id, sampai, jam));
    const sebelumTunda = pesanKe(sub).length;
    const pushSebelum = pushUntuk(l.endpoint).length;
    await maju(60_000);
    await maju(60_000);
    expect(pesanKe(sub).length).toBe(sebelumTunda);
    expect(pushUntuk(l.endpoint).length).toBe(pushSebelum);
    await putar(new Date(sampai.getTime() + 1_000));
    expect(pesanKe(sub, tg).at(-1)!.teks).toMatch(/#4\b|ke-4\b/);
    expect(pushUntuk(l.endpoint).length).toBe(pushSebelum + 1);

    // Bangun: tidak ada spam lagi; satu penutup per kanal yang sempat dikirimi spam (WhatsApp tidak).
    await mesin((m, tx) => m.lolosKejadian(tx, kej.id, jam, { oleh: "sesi" }));
    await maju(1_000);
    await maju(5_000); // Telegram: penutup menunggu jeda minimal 5 dtk
    await maju(15_000); // Discord: 15 dtk
    const penutup = pesanKe(sub).filter((k) => k.kunci.startsWith(`${kej.id}:p:`));
    expect(penutup.map((k) => k.kanal).sort()).toEqual([dc, tg].sort());
    // Jejak penutup: Telegram dan Discord terkirim (sempat ditunda menunggu jeda); WhatsApp tidak dicoba.
    const jejakPenutup = (await kiriman(kej.id)).filter((x) => x.jenis === "penutup");
    expect(
      jejakPenutup
        .filter((x) => x.status === "terkirim")
        .map((x) => x.kanalId)
        .sort(),
    ).toEqual([dc, tg].sort());
    expect(jejakPenutup.some((x) => x.kanalId === wa)).toBe(false);
    expect(penutup[0].teks).toContain("Kamu bangun");
    expect(penutup[0].teks).toContain("tunda 1 kali");
    const sesudah = pesanKe(sub).length;
    await maju(60_000);
    expect(pesanKe(sub).length).toBe(sesudah);
    // Notifikasi diganti "sudah mati" (tag sama, tanpa bunyi).
    expect(pushUntuk(l.endpoint).at(-1)).toMatchObject({ jenis: "selesai", tag: kej.id, ulang: false, tahan: false });

    // Jejak kiriman untuk riwayat (web, berkonteks pemilik): tanpa isi pesan.
    const jejak = await (await Kn()).kirimanKejadian(P, kej.id);
    expect(jejak.filter((x) => x.jenis === "spam" && x.status === "terkirim").length).toBeGreaterThanOrEqual(6);
    expect(jejak.some((x) => x.jenis === "penutup")).toBe(true);
    expect(JSON.stringify(jejak)).not.toContain("Presentasi");
    // Pengguna lain tidak melihat jejak ini.
    const lain = await buatPengguna(u);
    expect(await (await Kn()).kirimanKejadian(lain, kej.id)).toEqual([]);
  }, 30_000);

  it("berhenti sendiri sesudah batas waktu spam; jeda pilihan pengguna dipakai", async () => {
    const { sub, tg } = await pengguna();
    const { P } = { P: (await u.superuser.select().from(schema.pengguna).where(eq(schema.pengguna.agentbuffSub, sub)))[0].id };
    const a = await alarmSekali(P, "2026-11-03", { spam: { kanal: [tg], jedaDtk: 20, batasMenit: 1 } });
    const T = wib("2026-11-03T05:00:00");
    await putar(T);
    for (let i = 1; i <= 4; i++) await maju(20_000);
    // 0, 20, 40 dtk; di 60 dtk batas tercapai.
    expect(pesanKe(sub, tg)).toHaveLength(3);
    await maju(60_000);
    expect(pesanKe(sub, tg)).toHaveLength(3);
    const kej = await kejadianDari(a.id);
    await mesin((m, tx) => m.hentikanKejadian(tx, kej.id, "dibatalkan", jam));
  });

  it("izin kirim pesan dicabut = berhenti tercatat; agen mati = dicoba lagi pada jeda berikutnya", async () => {
    const x = await pengguna({ izin: { kabar: false, suara: true } });
    const y = await pengguna({ agenAktif: false });
    const ax = await alarmSekali(x.P, "2026-11-04", { spam: { kanal: [x.tg], jedaDtk: null, batasMenit: null } });
    const ay = await alarmSekali(y.P, "2026-11-04", { spam: { kanal: [y.tg], jedaDtk: null, batasMenit: null } });
    await putar(wib("2026-11-04T05:00:00"));
    const kx = await kejadianDari(ax.id);
    const ky = await kejadianDari(ay.id);
    expect((await kiriman(kx.id)).map((r) => [r.status, r.alasan])).toEqual([["gagal", "belum_diizinkan"]]);
    expect((await kiriman(ky.id)).map((r) => [r.status, r.alasan])).toEqual([["gagal", "agen_tidak_aktif"]]);
    t.atur(y.sub, { agenAktif: true });
    await maju(15_000);
    await maju(15_000);
    expect((await kiriman(kx.id)).length).toBe(1);
    expect((await kiriman(ky.id)).filter((r) => r.status === "terkirim").length).toBe(2);
    for (const k of [kx, ky]) await mesin((m, tx) => m.hentikanKejadian(tx, k.id, "dibatalkan", jam));
  });
});

describe("Masih bangun, terlewat, notifikasi web", () => {
  it('"Masih bangun?" tampil: notifikasi + satu pesan kanal; penutup baru sesudah "Masih!"', async () => {
    const { P, sub, tg } = await pengguna();
    const l = langgananBaru();
    await (await Kn()).daftarkanPush(P, { langganan: l }, "web");
    const a = await alarmSekali(P, "2026-11-05", { spam: { kanal: [tg], jedaDtk: null, batasMenit: null }, masihBangun: { aktif: true, menit: 3, batasDtk: 60 } });
    await putar(wib("2026-11-05T05:00:00"));
    const kej = await kejadianDari(a.id);
    await maju(10_000);
    await mesin((m, tx) => m.lolosKejadian(tx, kej.id, jam, { oleh: "sesi" }));
    await maju(60_000);
    expect(pesanKe(sub).filter((k) => k.kunci.includes(":p:"))).toHaveLength(0);
    await putar(new Date(jam.getTime() + 2 * 60_000 + 10_000));
    const cek = pesanKe(sub).filter((k) => k.kunci.startsWith(`${kej.id}:c:`));
    expect(cek).toHaveLength(1);
    expect(cek[0].teks).toContain("ketuk Masih!");
    expect(pushUntuk(l.endpoint).at(-1)).toMatchObject({ jenis: "cek", tag: kej.id, ulang: true, tahan: true });
    await mesin((m, tx) => m.konfirmasiBangun(tx, kej.id, jam));
    await maju(1_000);
    await maju(5_000);
    expect(pesanKe(sub).filter((k) => k.kunci.startsWith(`${kej.id}:p:`))).toHaveLength(1);
  });

  it("kejadian terlewat (server mati > 30 menit): dikabari lewat notifikasi dan kanal", async () => {
    const { P, sub, tg } = await pengguna();
    const l = langgananBaru();
    await (await Kn()).daftarkanPush(P, { langganan: l }, "web");
    const a = await alarmSekali(P, "2026-11-06", { agendaJudul: "Ujian", spam: { kanal: [tg], jedaDtk: null, batasMenit: null } });
    await putar(wib("2026-11-06T05:40:00"));
    const kej = await kejadianDari(a.id);
    expect(kej.status).toBe("terlewat");
    const p = pesanKe(sub, tg);
    expect(p).toHaveLength(1);
    expect(p[0].teks).toContain("Alarm 05.00 (Ujian) terlewat");
    expect(pushUntuk(l.endpoint)).toEqual([expect.objectContaining({ jenis: "terlewat", judul: "Alarm 05.00 terlewat" })]);
  });

  it("langganan push: endpoint asing ditolak, data tersandi, 410 dilepas, maks 10 peramban", async () => {
    const { P } = await pengguna();
    const Kl = await Kn();
    await expect(Kl.daftarkanPush(P, { langganan: { ...langgananBaru(), endpoint: "https://evil.example/push" } }, "web")).rejects.toBeInstanceOf(GalatLayanan);
    const fcm = langgananBaru("https://fcm.googleapis.com/fcm/send");
    await Kl.daftarkanPush(P, { langganan: fcm }, "web");
    const [baris] = await u.pekerja((tx) => tx.select().from(schema.langgananPush).where(eq(schema.langgananPush.penggunaId, P)));
    expect(baris.data).not.toContain("fcm.googleapis.com");
    expect(baris.data).not.toContain(fcm.keys.auth);
    // Peramban mencabut langganannya: layanan push menjawab 410, langganan dilepas.
    const { kirimPush } = await import("@/lib/push");
    const h = await kirimPush(
      (fn) => dbPekerja().transaction(fn),
      P,
      { jenis: "uji", judul: "x", isi: "y", tag: "uji", url: "/app", ulang: false, tahan: false },
      { kirim: async () => 410 },
    );
    expect(h).toEqual({ terkirim: 0, gagal: 0, dilepas: 1 });
    for (let i = 0; i < 12; i++) await Kl.daftarkanPush(P, { langganan: langgananBaru() }, "web");
    expect((await u.pekerja((tx) => tx.select().from(schema.langgananPush).where(eq(schema.langgananPush.penggunaId, P)))).length).toBe(10);
    // Lepas satu.
    const satu = langgananBaru();
    await Kl.daftarkanPush(P, { langganan: satu }, "web");
    expect(await Kl.lepasPush(P, { endpoint: satu.endpoint }, "web")).toEqual({ dilepas: true });
  });

  it("notifikasi uji lewat HTTP sungguhan: aes128gcm + VAPID sah (dibuka dan diverifikasi seperti layanan push)", async () => {
    const { P } = await pengguna();
    const masuk: Array<{ jalur: string; headers: IncomingHttpHeaders; body: Buffer }> = [];
    const srv = createServer((req, res) => {
      const bagian: Buffer[] = [];
      req.on("data", (b: Buffer) => bagian.push(b));
      req.on("end", () => {
        masuk.push({ jalur: req.url ?? "", headers: req.headers, body: Buffer.concat(bagian) });
        res.writeHead(201).end();
      });
    });
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    try {
      const asal = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
      const l = langgananBaru(`${asal}/push`);
      await (await Kn()).daftarkanPush(P, { langganan: l }, "web");
      const h = await (await Kn()).ujiPush(P);
      expect(h).toMatchObject({ terkirim: 1, pesan: "Notifikasi uji dikirim." });
      expect(masuk).toHaveLength(1);
      const r = masuk[0];
      expect(r.headers["content-encoding"]).toBe("aes128gcm");
      expect(r.headers.ttl).toBe("60");
      expect(r.headers.urgency).toBe("high");
      const isi = JSON.parse(
        decrypt(r.body, { version: "aes128gcm", privateKey: penerima.get(l.endpoint)!.ecdh, authSecret: penerima.get(l.endpoint)!.auth }).toString(),
      ) as IsiNotif;
      expect(isi).toMatchObject({ jenis: "uji", judul: "Notifikasi AntiKebo menyala", url: "/app/pengaturan" });
      // Authorization: vapid t=<JWT ES256 aud=asal endpoint>, k=<kunci publik VAPID>.
      const m = /^vapid t=([^,]+), k=(.+)$/.exec(String(r.headers.authorization));
      expect(m?.[2]).toBe(process.env.VAPID_PUBLIC_KEY);
      const pub = Buffer.from(process.env.VAPID_PUBLIC_KEY!, "base64url");
      const kunci = await importJWK({ kty: "EC", crv: "P-256", x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33).toString("base64url") }, "ES256");
      const { payload } = await jwtVerify(m![1], kunci);
      expect(payload.aud).toBe(asal);
      expect(payload.sub).toBe("mailto:uji@antikebo.invalid");
    } finally {
      srv.close();
    }
  });
});

describe("daftar kanal dan uji kanal (PRD G1, G7)", () => {
  it("daftar dari AgentBuff; uji terkirim; terlalu cepat, belum siap, dan izin dicabut = pesan ramah", async () => {
    const { P, sub, tg, wa } = await pengguna();
    const Kl = await Kn();
    const d = await Kl.daftarKanalPengguna(P);
    expect(d.kanal.map((k) => [k.platform, k.siap])).toEqual([
      ["telegram", true],
      ["whatsapp", false],
      ["discord", true],
    ]);
    expect(await Kl.ujiKanal(P, { kanal: tg }, "web")).toEqual({ terkirim: true, pesan: "Pesan uji terkirim. Cek chat-mu!" });
    expect(pesanKe(sub, tg).at(-1)!.teks).toBe("✅ Tes dari AntiKebo, Nugi. Kanal ini siap membangunkanmu!");
    const cepat = await Kl.ujiKanal(P, { kanal: tg }, "web").catch((e: GalatLayanan) => e);
    expect(cepat).toBeInstanceOf(GalatLayanan);
    expect((cepat as GalatLayanan).kode).toBe("batas_laju");
    expect((cepat as GalatLayanan).message).toMatch(/^Kanal ini baru saja dipakai\. Tunggu \d+ detik lalu coba lagi\.$/);
    const belum = await Kl.ujiKanal(P, { kanal: wa }, "web").catch((e: GalatLayanan) => e);
    expect([(belum as GalatLayanan).kode, (belum as GalatLayanan).message]).toEqual(["kanal_gagal", "Kanal ini belum siap. Kirim satu pesan ke agenmu di kanal itu dulu."]);
    const jejak = await u.pekerja((tx) =>
      tx
        .select()
        .from(schema.kirimanKanal)
        .where(and(eq(schema.kirimanKanal.penggunaId, P), eq(schema.kirimanKanal.jenis, "uji"))),
    );
    expect(jejak.map((x) => x.status).sort()).toEqual(["ditunda", "gagal", "terkirim"]);
    t.atur(sub, { izin: { kabar: false, suara: true } });
    await expect(Kl.daftarKanalPengguna(P)).rejects.toMatchObject({ kode: "perlu_izin", message: "Beri izin kirim pesan di AgentBuff dulu." });
    await expect(Kl.ujiKanal(P, { kanal: tg }, "web")).rejects.toMatchObject({ kode: "perlu_izin" });
  });
});

describe("pengingat malam (PRD G4)", () => {
  it("sekali per malam pada jam tidur ke kanal bawaan + notifikasi: alarm besok, agenda, perangkat siaga", async () => {
    const { P, sub, tg } = await pengguna();
    const l = langgananBaru();
    await (await Kn()).daftarkanPush(P, { langganan: l }, "web");
    await (await import("@/lib/layanan/preferensi")).ubahPreferensi(P, { bawaan: { spam: { kanal: [tg], jedaDtk: null, batasMenit: null } } }, "web");
    await alarmSekali(P, "2026-11-11", { agendaJudul: "Wawancara kerja" });
    const malam = wib("2026-11-10T22:00:30");
    await u.superuser.insert(schema.perangkatSiaga).values({ penggunaId: P, jenis: "pc", nama: "PC Kamar", terakhirTerlihat: new Date(malam.getTime() - 30_000) });
    const { prosesPengingatMalam } = await import("@/lib/layanan/pengingat");
    const jalan = (sekarang: Date) => {
      jam = sekarang;
      return prosesPengingatMalam(dbPekerja, { sekarang, kirimPermintaanPush, asal: ASAL_APP });
    };

    // Sebelum jam tidur: belum.
    await jalan(wib("2026-11-10T21:59:00"));
    expect(pesanKe(sub, tg)).toHaveLength(0);
    await jalan(malam);
    const p = pesanKe(sub, tg);
    expect(p).toHaveLength(1);
    expect(p[0].teks).toBe(`🌙 Selamat malam, Nugi!\nAlarm berikutnya: 05.00, Wawancara kerja.\nPerangkat siaga: PC Kamar. Aman, tidur sana!\nAtur alarm: ${ASAL_APP}/app`);
    expect(pushUntuk(l.endpoint).at(-1)).toMatchObject({ jenis: "pengingat", judul: "Alarm berikutnya 05.00" });
    // Malam yang sama: tidak dikirim lagi.
    await jalan(wib("2026-11-10T23:30:00"));
    await jalan(wib("2026-11-11T00:30:00"));
    expect(pesanKe(sub, tg)).toHaveLength(1);

    // Malam berikutnya tanpa alarm dalam 24 jam: tidak ada yang perlu diingatkan.
    await jalan(wib("2026-11-11T22:00:30"));
    expect(pesanKe(sub, tg)).toHaveLength(1);

    // Malam berikutnya lagi dengan alarm, perangkat tidak siaga: diperingatkan.
    await alarmSekali(P, "2026-11-13", {});
    await jalan(wib("2026-11-12T22:05:00"));
    expect(pesanKe(sub, tg)).toHaveLength(2);
    expect(pesanKe(sub, tg)[1].teks).toContain("Belum ada perangkat siaga!");

    // Worker baru menyala 3 jam sesudah jam tidur: pengingat basi tidak dikirim.
    await alarmSekali(P, "2026-11-14", {});
    await jalan(wib("2026-11-14T01:00:00"));
    expect(pesanKe(sub, tg)).toHaveLength(2);

    // Pengingat dimatikan.
    await (await import("@/lib/layanan/preferensi")).ubahPreferensi(P, { pengingatMalam: false }, "web");
    await alarmSekali(P, "2026-11-15", {});
    await jalan(wib("2026-11-14T22:00:30"));
    expect(pesanKe(sub, tg)).toHaveLength(2);
  });
});
