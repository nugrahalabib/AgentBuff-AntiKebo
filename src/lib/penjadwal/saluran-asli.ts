import { and, count, eq } from "drizzle-orm";
import { daftarKanal as daftarKanalAsli, kirimKabar as kirimKabarAsli, type PlatformKanal } from "@/lib/agentbuff/pintu";
import { schema, type Db, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { ALASAN_BERHENTI, jedaKanalMs, jedaTerlaluCepatMs } from "@/lib/kanal/aturan";
import { catatKiriman, type JenisKiriman } from "@/lib/layanan/kanal";
import { jamTampil, konteksPengguna, type KonteksPengguna } from "@/lib/layanan/konteks";
import { kalimatAlarm } from "@/lib/layanan/suara";
import { benihDari, notifBunyi, notifCek, notifSelesai, notifTerlewat, pesanCek, pesanPenutup, pesanSpam, pesanTerlewat, pilihKe } from "@/lib/pesan";
import { kirimPush, type KirimPermintaan } from "@/lib/push";
import { saluranBatas, saluranCekBatas } from "./mesin";
import { saluranTuyaTiruan, type BarisKejadian, type HasilLangkah, type IsiKejadian, type Saluran } from "./saluran";

/**
 * Saluran asli worker (P6, arsitektur §4.4 dan §7): spam kanal per kanal dengan jeda platform dan
 * batas waktu, notifikasi web berulang 30 dtk, "Masih bangun?" (notifikasi + satu pesan kanal),
 * kabar terlewat, pesan penutup sesudah bangun, dan notifikasi diganti "sudah mati". Semua pesan
 * tercatat di `kiriman_kanal` (tanpa isi). Tuya masih tiruan sampai P7.
 */

export type DepSaluran = {
  db: () => Db;
  kirimKabar?: typeof kirimKabarAsli;
  daftarKanal?: typeof daftarKanalAsli;
  /** Pengirim permintaan push (uji: server push palsu). */
  kirimPermintaanPush?: KirimPermintaan;
  /** Asal aplikasi untuk tautan di pesan (bawaan APP_ORIGIN). */
  asal?: string;
};

export const NOTIFIKASI_ULANG_MS = 30_000; // PRD G5

type Ctx = { k: KonteksPengguna; sub: string };

function bantu(dep: DepSaluran) {
  const kirimKabar = dep.kirimKabar ?? kirimKabarAsli;
  const daftarKanal = dep.daftarKanal ?? daftarKanalAsli;
  const asal = () => (dep.asal ?? env("APP_ORIGIN")).replace(/\/+$/, "");
  const jalankan = <T>(fn: (tx: Tx) => Promise<T>) => dep.db().transaction(fn);

  const konteks = (penggunaId: string): Promise<Ctx> =>
    jalankan(async (tx) => {
      const k = await konteksPengguna(tx, penggunaId);
      const [p] = await tx.select({ sub: schema.pengguna.agentbuffSub }).from(schema.pengguna).where(eq(schema.pengguna.id, penggunaId));
      return { k, sub: p.sub };
    });

  const jalur = (kej: BarisKejadian) => `/app/bunyi/${kej.id}`;
  const jam = (k: KonteksPengguna, kej: BarisKejadian) => (k.bahasa === "id" ? kej.jamLokal.replace(":", ".") : kej.jamLokal);
  const agenda = (k: KonteksPengguna, isi: IsiKejadian | null) => {
    const a = isi?.agendaJudul?.trim();
    return a && a !== k.t.alarmBaru.judulBawaan ? a : null;
  };
  const kalimat = (k: KonteksPengguna, isi: IsiKejadian | null) => (isi ? kalimatAlarm(isi, k) : []);
  const push = (penggunaId: string, n: Parameters<typeof kirimPush>[2]) => kirimPush(jalankan, penggunaId, n, { kirim: dep.kirimPermintaanPush });
  const catat = (b: Parameters<typeof catatKiriman>[1]) => jalankan((tx) => catatKiriman(tx, b));

  /** Satu pesan ke satu kanal + jejaknya. Mengembalikan hasil pintu. */
  async function kirimSatu(c: Ctx, kej: BarisKejadian, jenis: JenisKiriman, kanal: string, platform: string | null, teks: string, kunci: string, ke: number | null = null) {
    const r = await kirimKabar(c.sub, { kanal, teks, kunci });
    await catat({
      penggunaId: kej.penggunaId,
      kejadianId: kej.id,
      kanalId: kanal,
      platform,
      jenis,
      ke,
      status: r.ok ? "terkirim" : r.alasan === "terlalu_cepat" ? "ditunda" : "gagal",
      alasan: r.ok ? null : r.alasan,
      idKiriman: r.ok ? r.id : null,
      kunci,
    });
    return r;
  }

  async function jumlahTerkirim(kej: BarisKejadian, kanal: string, jenis: JenisKiriman): Promise<number> {
    const [r] = await jalankan((tx) =>
      tx
        .select({ n: count() })
        .from(schema.kirimanKanal)
        .where(
          and(eq(schema.kirimanKanal.kejadianId, kej.id), eq(schema.kirimanKanal.kanalId, kanal), eq(schema.kirimanKanal.jenis, jenis), eq(schema.kirimanKanal.status, "terkirim")),
        ),
    );
    return Number(r?.n ?? 0);
  }

  return { kirimKabar, daftarKanal, asal, konteks, jalur, jam, agenda, kalimat, push, catat, kirimSatu, jumlahTerkirim };
}

export function saluranAsli(dep: DepSaluran): Saluran[] {
  const b = bantu(dep);

  /** Spam kanal (PRD G2, G3, G6): satu deret langkah per kanal, urutan = indeks kanal * 100000 + ulangan. */
  const spam: Saluran = {
    jenis: "spam",
    saatTunda: "berhenti",
    rencana: (isi, mulai) => isi.spam.kanal.map((kanal, i) => ({ jatuhTempo: mulai, urutan: i * 100_000, parameter: { kanal } })),
    async jalankan({ kejadian, isi, langkah, sekarang }): Promise<HasilLangkah> {
      const p = (langkah.parameter ?? {}) as { kanal?: string; platform?: PlatformKanal | null };
      if (!p.kanal || !isi) return { hasil: { lewat: "tanpa_kanal" } };
      const mulai = kejadian.berbunyiPada ?? sekarang;
      if (isi.spam.batasMenit && sekarang.getTime() - mulai.getTime() >= isi.spam.batasMenit * 60_000) return { hasil: { batas: true } };
      const c = await b.konteks(kejadian.penggunaId);

      // Platform (untuk jeda) diketahui dari daftar kanal sekali per kejadian, lalu dibawa parameter.
      let platform: PlatformKanal | null = p.platform ?? null;
      if (p.platform === undefined) {
        const d = await b.daftarKanal(c.sub);
        if (d.ok) {
          const kn = d.kanal.find((x) => x.id === p.kanal);
          if (!kn || !kn.siap) {
            await b.catat({
              penggunaId: kejadian.penggunaId,
              kejadianId: kejadian.id,
              kanalId: p.kanal,
              platform: kn?.platform ?? null,
              jenis: "spam",
              status: "gagal",
              alasan: "kanal_tidak_siap",
              kunci: `${kejadian.id}:s:${langkah.urutan}`,
            });
            return { hasil: { berhenti: "kanal_tidak_siap" } };
          }
          platform = kn.platform;
        } else if (ALASAN_BERHENTI.has(d.alasan)) {
          await b.catat({
            penggunaId: kejadian.penggunaId,
            kejadianId: kejadian.id,
            kanalId: p.kanal,
            platform: null,
            jenis: "spam",
            status: "gagal",
            alasan: d.alasan,
            kunci: `${kejadian.id}:s:${langkah.urutan}`,
          });
          return { hasil: { berhenti: d.alasan } };
        }
      }
      const parameterBaru = { kanal: p.kanal, platform };
      const jeda = jedaKanalMs(platform, isi.spam.jedaDtk);
      const ke = (await b.jumlahTerkirim(kejadian, p.kanal, "spam")) + 1;
      const omelan = b
        .kalimat(c.k, isi)
        .filter((x) => x.jenis === "umum" || x.jenis === "agenda" || x.jenis === "pribadi")
        .map((x) => x.teks);
      const teks = pesanSpam({
        bahasa: c.k.bahasa,
        nama: c.k.namaSapaan,
        ke,
        menit: Math.floor((sekarang.getTime() - mulai.getTime()) / 60_000),
        jam: b.jam(c.k, kejadian),
        agenda: b.agenda(c.k, isi),
        omelan,
        tautan: `${b.asal()}${b.jalur(kejadian)}`,
        benih: benihDari(`${kejadian.id}|${p.kanal}`),
      });
      const r = await b.kirimSatu(c, kejadian, "spam", p.kanal, platform, teks, `${kejadian.id}:s:${langkah.urutan}`, ke);
      if (r.ok) return { hasil: { terkirim: ke }, ulangiPada: new Date(sekarang.getTime() + jeda), parameterBaru };
      if (r.alasan === "terlalu_cepat")
        return { hasil: { ditunda: r.ulangiSetelahMs ?? null }, ulangiPada: new Date(sekarang.getTime() + jedaTerlaluCepatMs(r.ulangiSetelahMs)), parameterBaru };
      if (ALASAN_BERHENTI.has(r.alasan)) return { hasil: { berhenti: r.alasan } };
      return { hasil: { gagal: r.alasan }, ulangiPada: new Date(sekarang.getTime() + jeda), parameterBaru };
    },
  };

  /** Satu pesan penutup per kanal yang sempat dikirimi spam, sesudah bangun (PRD G3). */
  const penutup: Saluran = {
    jenis: "penutup",
    fase: "selesai",
    saatTunda: "lanjut",
    rencana: () => [],
    rencanaSelesai: (isi, sekarang, _k, status) =>
      status === "bangun" && isi ? isi.spam.kanal.map((kanal, i) => ({ jatuhTempo: sekarang, urutan: i * 100_000, parameter: { kanal } })) : [],
    async jalankan({ kejadian, isi, langkah, sekarang }): Promise<HasilLangkah> {
      const p = (langkah.parameter ?? {}) as { kanal?: string };
      if (!p.kanal || kejadian.status !== "bangun") return { hasil: { lewat: true } };
      if (!(await b.jumlahTerkirim(kejadian, p.kanal, "spam"))) return { hasil: { lewat: "tanpa_spam" } };
      if (await b.jumlahTerkirim(kejadian, p.kanal, "penutup")) return { hasil: { lewat: "sudah" } };
      const c = await b.konteks(kejadian.penggunaId);
      const bangun = kejadian.bangunPada ?? sekarang;
      const mulai = kejadian.berbunyiPada ?? bangun;
      const teks = pesanPenutup({
        bahasa: c.k.bahasa,
        nama: c.k.namaSapaan,
        penutup: b.kalimat(c.k, isi).find((x) => x.jenis === "penutup")?.teks ?? null,
        jamBangun: jamTampil(bangun, isi?.zona ?? c.k.zona, c.k.bahasa),
        menit: Math.max(0, Math.round((bangun.getTime() - mulai.getTime()) / 60_000)),
        tunda: kejadian.jumlahTunda,
      });
      const r = await b.kirimSatu(c, kejadian, "penutup", p.kanal, null, teks, `${kejadian.id}:p:${langkah.urutan}`);
      // Spam terakhir baru saja terkirim: AgentBuff minta tunggu, penutup dicoba lagi sekali jedanya habis.
      if (!r.ok && r.alasan === "terlalu_cepat") return { hasil: { ditunda: true }, ulangiPada: new Date(sekarang.getTime() + jedaTerlaluCepatMs(r.ulangiSetelahMs)) };
      return { hasil: r.ok ? { terkirim: true } : { gagal: r.alasan } };
    },
  };

  /** Notifikasi web berulang tiap 30 dtk selama berbunyi (PRD G5). */
  const notifikasi: Saluran = {
    jenis: "notifikasi",
    saatTunda: "berhenti",
    rencana: (_isi, mulai) => [{ jatuhTempo: mulai }],
    async jalankan({ kejadian, isi, langkah, sekarang }): Promise<HasilLangkah> {
      const c = await b.konteks(kejadian.penggunaId);
      const omelan = b.kalimat(c.k, isi).filter((x) => x.jenis === "umum" || x.jenis === "agenda" || x.jenis === "pribadi");
      const pilih = omelan.length ? omelan[pilihKe(langkah.urutan + 1, omelan.length, benihDari(kejadian.id))].teks : kejadian.judul;
      const h = await b.push(kejadian.penggunaId, notifBunyi({ bahasa: c.k.bahasa, judul: kejadian.judul, omelan: pilih, tag: kejadian.id, url: b.jalur(kejadian) }));
      // Tanpa langganan sama sekali: tidak perlu diulang.
      if (!h.terkirim && !h.gagal) return { hasil: { tanpaLangganan: true } };
      return { hasil: { ...h }, ulangiPada: new Date(sekarang.getTime() + NOTIFIKASI_ULANG_MS) };
    },
  };

  /** Notifikasi berbunyi diganti "sudah mati" begitu kejadian berhenti (tanpa bunyi). */
  const notifikasiSelesai: Saluran = {
    jenis: "notifikasi_selesai",
    fase: "selesai",
    saatTunda: "lanjut",
    rencana: () => [],
    rencanaSelesai: (_isi, sekarang) => [{ jatuhTempo: sekarang }],
    async jalankan({ kejadian }): Promise<HasilLangkah> {
      const c = await b.konteks(kejadian.penggunaId);
      const h = await b.push(kejadian.penggunaId, notifSelesai({ bahasa: c.k.bahasa, nama: c.k.namaSapaan, tag: kejadian.id, url: "/app" }));
      return { hasil: { ...h } };
    },
  };

  /** "Masih bangun?" tampil: notifikasi + satu pesan ke tiap kanal spam (PRD E2). */
  const cekTampil: Saluran = {
    jenis: "cek_tampil",
    fase: "cek",
    saatTunda: "lanjut",
    rencana: () => [],
    async jalankan({ kejadian, isi, langkah }): Promise<HasilLangkah> {
      const c = await b.konteks(kejadian.penggunaId);
      const tautan = `${b.asal()}${b.jalur(kejadian)}`;
      const teks = pesanCek({ bahasa: c.k.bahasa, nama: c.k.namaSapaan, cek: b.kalimat(c.k, isi).find((x) => x.jenis === "cek")?.teks ?? null, tautan });
      const [h, ...pesan] = await Promise.all([
        b.push(kejadian.penggunaId, notifCek({ bahasa: c.k.bahasa, nama: c.k.namaSapaan, tag: kejadian.id, url: b.jalur(kejadian) })),
        ...(isi?.spam.kanal ?? []).map((kanal, i) => b.kirimSatu(c, kejadian, "cek", kanal, null, teks, `${kejadian.id}:c:${langkah.urutan}:${i}`)),
      ]);
      return { hasil: { push: h, kanal: pesan.filter((r) => r.ok).length } };
    },
  };

  /** Kejadian terlewat karena server sempat mati (PRD C6): kabari lewat notifikasi dan kanal. */
  const kabarTerlewat: Saluran = {
    jenis: "kabar_terlewat",
    fase: "terlewat",
    saatTunda: "lanjut",
    rencana: () => [],
    rencanaTerlewat: (_isi, sekarang) => [{ jatuhTempo: sekarang }],
    async jalankan({ kejadian, isi }): Promise<HasilLangkah> {
      const c = await b.konteks(kejadian.penggunaId);
      const m = { bahasa: c.k.bahasa, nama: c.k.namaSapaan, jam: b.jam(c.k, kejadian), agenda: b.agenda(c.k, isi) };
      const teks = pesanTerlewat({ ...m, tautan: `${b.asal()}/app` });
      const [h, ...pesan] = await Promise.all([
        b.push(kejadian.penggunaId, notifTerlewat({ ...m, tag: kejadian.id, url: "/app" })),
        ...(isi?.spam.kanal ?? []).map((kanal, i) => b.kirimSatu(c, kejadian, "terlewat", kanal, null, teks, `${kejadian.id}:t:${i}`)),
      ]);
      return { hasil: { push: h, kanal: pesan.filter((r) => r.ok).length } };
    },
  };

  return [notifikasi, spam, saluranTuyaTiruan, kabarTerlewat, cekTampil, penutup, notifikasiSelesai, saluranBatas, saluranCekBatas];
}
