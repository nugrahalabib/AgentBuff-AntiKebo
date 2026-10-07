import { and, eq, gt, sql } from "drizzle-orm";
import { isiDariBaris } from "@/lib/alarm/baris";
import type { AturanTuya } from "@/lib/alarm/isi";
import { schema, type Db, type Tx } from "@/lib/db";
import { isi as isiTeks } from "@/lib/i18n";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { konteksPengguna, type KonteksPengguna } from "@/lib/layanan/konteks";
import { bacaSambungan, kemampuanDari, keadaanTerkini, kirimPerintah, klienUntuk, kodePotret, perintahDari, tanganiGalatTuya, type Jalankan } from "@/lib/layanan/tuya";
import type { PerintahRamah } from "@/lib/tuya/kemampuan";
import type { KlienTuya } from "@/lib/tuya/klien";
import type { BarisKejadian, HasilLangkah, IsiKejadian, RencanaLangkah, Saluran } from "./saluran";

/**
 * Saluran rumah pintar Tuya (P7, PRD I3 sampai I6, arsitektur §8). Aksi Tuya adalah langkah
 * kejadian (bukan penjadwal Tuya template):
 *
 *  - `tuya_pra`     : aturan "sebelum X menit": naik bertahap tiap menit sampai terang tujuan
 *                     (perangkat tanpa terang: sekali saat X menit sebelum). Direncanakan saat
 *                     kejadian masih menunggu (`rencanaPra`).
 *  - `tuya`         : aturan "bareng": saat mulai berbunyi.
 *  - `tuya_kedip`   : efek kedip terang 100% dan 10% bergantian tiap 3 dtk sampai bangun (berhenti
 *                     saat tunda).
 *  - `tuya_kedip_tunda`, `tuya_kedip_cek`: kedip berhenti (tunda, atau soal terjawab dan
 *                     "Masih bangun?" menunggu): lampu dibuat terang tetap, tidak tertinggal redup.
 *  - `tuya_tunda`   : aturan "saat tunda".
 *  - `tuya_selesai` : aturan "sesudah bangun", lalu tiap perangkat: kembalikan keadaan sebelum
 *                     alarm (potret), suasana pagi, atau biarkan.
 *  - `tuya_darurat` : lapisan darurat tersembunyi: telepon/SMS Tuya ke nomor akun sendiri bila
 *                     belum bangun sesudah X menit, maks 15 per hari.
 *
 * Sebelum aksi pertama sebuah kejadian, keadaan perangkat dipotret ke `potret_tuya`. Perangkat
 * offline dilewati dan dicatat di hasil langkah (PRD I4); kunci ditolak = sambungan ditandai
 * bermasalah dan aksi berhenti (PRD I5).
 */

export type DepTuya = { db: () => Db; jedaKonfirmasi?: readonly number[] };

export const LANGKAH_PRA_MS = 60_000;
export const KEDIP_MS = 3_000;
export const DARURAT_ULANG_MS = 5 * 60_000;
export const DARURAT_MAKS_SEHARI = 15;
/** Suasana pagi untuk lampu: nyala terang penuh, putih netral. Perangkat lain dibiarkan. */
export const SUASANA_PAGI: PerintahRamah = { nyala: true, terangPersen: 100, suhuPutihPersen: 60 };
const KEDIP_RENDAH = 10;

type Param = { aturan?: number; perangkat?: string; langkah?: number; jadwal?: string; tinggi?: boolean; status?: string };

function bantu(dep: DepTuya) {
  const j: Jalankan = (fn) => dep.db().transaction(fn);

  async function konteks(penggunaId: string): Promise<{ k: KonteksPengguna; klien: KlienTuya } | { lewat: string }> {
    const k = await j((tx) => konteksPengguna(tx, penggunaId));
    try {
      return { k, klien: await klienUntuk(j, k) };
    } catch (e) {
      if (e instanceof GalatLayanan) return { lewat: e.kode };
      throw e;
    }
  }

  /** Aturan alarm untuk kejadian ini (isi kejadian; kejadian menunggu belum punya isi = dari alarm). */
  async function aturanKejadian(kej: BarisKejadian, isi: IsiKejadian | null): Promise<readonly AturanTuya[]> {
    if (isi) return isi.tuya;
    if (!kej.alarmId) return [];
    const [a] = await j((tx) => tx.select().from(schema.alarm).where(eq(schema.alarm.id, kej.alarmId!)));
    return a ? isiDariBaris(a).tuya : [];
  }

  /** Potret keadaan perangkat sekali per kejadian (sebelum aksi alarm pertama). */
  async function potret(k: KonteksPengguna, klien: KlienTuya, kej: BarisKejadian, deviceId: string): Promise<void> {
    const [ada] = await j((tx) =>
      tx
        .select({ id: schema.potretTuya.id })
        .from(schema.potretTuya)
        .where(and(eq(schema.potretTuya.kejadianId, kej.id), eq(schema.potretTuya.deviceId, deviceId))),
    );
    if (ada) return;
    const { baris, properti } = await keadaanTerkini(j, k, klien, deviceId);
    const simpan = Object.fromEntries(
      kodePotret(kemampuanDari(baris))
        .filter((x) => x in properti)
        .map((x) => [x, properti[x]]),
    );
    await j((tx) => tx.insert(schema.potretTuya).values({ penggunaId: kej.penggunaId, kejadianId: kej.id, deviceId, properti: simpan }).onConflictDoNothing());
  }

  /** Satu aksi ke satu perangkat; galat perangkat (offline, tidak bisa) dicatat, bukan dilempar. */
  async function aksi(
    k: KonteksPengguna,
    klien: KlienTuya,
    kej: BarisKejadian,
    deviceId: string,
    cmd: PerintahRamah | { properti: Record<string, unknown> },
    opsi: { konfirmasi: boolean; potret: boolean },
  ): Promise<Record<string, unknown>> {
    try {
      if (opsi.potret) await potret(k, klien, kej, deviceId);
      const h = await kirimPerintah(j, k, klien, deviceId, cmd, { konfirmasi: opsi.konfirmasi, jeda: dep.jedaKonfirmasi });
      return { perangkat: deviceId, status: h.status };
    } catch (e) {
      if (e instanceof GalatLayanan) {
        if (e.kode === "kunci_bermasalah") throw e;
        return { perangkat: deviceId, lewat: e.kode };
      }
      return tanganiGalatTuya(j, k, e).catch((g: GalatLayanan) => {
        if (g.kode === "kunci_bermasalah") throw g;
        return { perangkat: deviceId, lewat: g.kode };
      });
    }
  }

  return { j, konteks, aturanKejadian, potret, aksi };
}

/** Bungkus jalankan: kunci bermasalah atau belum tersambung = berhenti dengan catatan, tanpa ulangan. */
async function lindungi(fn: () => Promise<HasilLangkah>): Promise<HasilLangkah> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof GalatLayanan) return { hasil: { lewat: e.kode } };
    throw e;
  }
}

export function saluranTuya(dep: DepTuya): Saluran[] {
  const b = bantu(dep);

  const pra: Saluran = {
    jenis: "tuya_pra",
    fase: "pra",
    saatTunda: "lanjut",
    rencana: () => [],
    rencanaPra: (isi, kej, sekarang) =>
      isi.tuya.flatMap((a, i): RencanaLangkah[] => {
        if (a.kapan !== "sebelum" || !a.menitSebelum) return [];
        const mulai = new Date(kej.jadwalUtc.getTime() - a.menitSebelum * 60_000);
        return [
          {
            jatuhTempo: mulai < sekarang ? sekarang : mulai,
            urutan: i * 100_000,
            parameter: { aturan: i, perangkat: a.perangkatId, langkah: 0, jadwal: kej.jadwalUtc.toISOString() },
          },
        ];
      }),
    jalankan: ({ kejadian, isi, langkah, sekarang }) =>
      lindungi(async () => {
        const p = (langkah.parameter ?? {}) as Param;
        if (p.jadwal !== kejadian.jadwalUtc.toISOString()) return { hasil: { lewat: "jadwal_berubah" } };
        const a = (await b.aturanKejadian(kejadian, isi))[p.aturan ?? -1];
        if (!a || a.perangkatId !== p.perangkat || a.kapan !== "sebelum" || !a.menitSebelum) return { hasil: { lewat: "aturan_berubah" } };
        const c = await b.konteks(kejadian.penggunaId);
        if ("lewat" in c) return { hasil: { lewat: c.lewat } };
        const [baris] = await b.j((tx) =>
          tx
            .select()
            .from(schema.perangkatTuya)
            .where(and(eq(schema.perangkatTuya.penggunaId, kejadian.penggunaId), eq(schema.perangkatTuya.deviceId, a.perangkatId))),
        );
        const naik = !!baris && !!kemampuanDari(baris).terang && a.aksi.nyala !== false;
        const ke = p.langkah ?? 0;
        if (!naik) {
          return { hasil: await b.aksi(c.k, c.klien, kejadian, a.perangkatId, perintahDari(a.aksi), { konfirmasi: true, potret: true }) };
        }
        // Naik bertahap: 1% di awal sampai terang tujuan tepat di jam alarm, satu langkah per menit.
        const n = a.menitSebelum;
        const tujuan = a.aksi.terang ?? 100;
        const persen = Math.max(1, Math.round(1 + ((tujuan - 1) * ke) / n));
        const cmd: PerintahRamah = ke === 0 ? { ...perintahDari(a.aksi), nyala: true, terangPersen: persen } : { terangPersen: persen };
        const h = await b.aksi(c.k, c.klien, kejadian, a.perangkatId, cmd, { konfirmasi: ke === 0 || ke === n, potret: ke === 0 });
        if (ke >= n) return { hasil: { ...h, persen } };
        const berikut = new Date(kejadian.jadwalUtc.getTime() - (n - ke - 1) * LANGKAH_PRA_MS);
        return { hasil: { ...h, persen }, ulangiPada: berikut < sekarang ? new Date(sekarang.getTime() + 1_000) : berikut, parameterBaru: { ...p, langkah: ke + 1 } };
      }),
  };

  const bareng: Saluran = {
    jenis: "tuya",
    saatTunda: "lanjut",
    rencana: (isi, mulai) =>
      isi.tuya.flatMap((a, i) => (a.kapan === "bareng" ? [{ jatuhTempo: mulai, urutan: i * 100_000, parameter: { aturan: i, perangkat: a.perangkatId } }] : [])),
    jalankan: ({ kejadian, isi, langkah }) =>
      lindungi(async () => {
        const p = (langkah.parameter ?? {}) as Param;
        const a = isi?.tuya[p.aturan ?? -1];
        if (!a || a.perangkatId !== p.perangkat) return { hasil: { lewat: "aturan_berubah" } };
        const c = await b.konteks(kejadian.penggunaId);
        if ("lewat" in c) return { hasil: { lewat: c.lewat } };
        return { hasil: await b.aksi(c.k, c.klien, kejadian, a.perangkatId, perintahDari(a.aksi), { konfirmasi: true, potret: true }) };
      }),
  };

  const kedip: Saluran = {
    jenis: "tuya_kedip",
    saatTunda: "berhenti",
    rencana: (isi, mulai) =>
      isi.tuya.flatMap((a, i) => (a.kedip ? [{ jatuhTempo: mulai, urutan: i * 100_000, parameter: { aturan: i, perangkat: a.perangkatId, tinggi: false } }] : [])),
    jalankan: ({ kejadian, isi, langkah, sekarang }) =>
      lindungi(async () => {
        const p = (langkah.parameter ?? {}) as Param;
        const a = isi?.tuya[p.aturan ?? -1];
        if (!a || a.perangkatId !== p.perangkat || !a.kedip) return { hasil: { lewat: "aturan_berubah" } };
        const c = await b.konteks(kejadian.penggunaId);
        if ("lewat" in c) return { hasil: { lewat: c.lewat } };
        const tinggi = !p.tinggi;
        // Langkah pertama (dan sesudah tunda) memastikan lampu menyala dulu.
        const pertama = langkah.urutan % 100_000 === 0;
        const cmd: PerintahRamah = pertama ? { nyala: true, terangPersen: 100 } : { terangPersen: tinggi ? 100 : KEDIP_RENDAH };
        const h = await b.aksi(c.k, c.klien, kejadian, a.perangkatId, cmd, { konfirmasi: false, potret: pertama });
        return {
          hasil: { ...h, terang: tinggi ? 100 : KEDIP_RENDAH },
          ulangiPada: new Date(sekarang.getTime() + KEDIP_MS),
          parameterBaru: { ...p, tinggi: pertama ? true : tinggi },
        };
      }),
  };

  /**
   * Kedip berhenti saat tunda atau saat soal terjawab dan "Masih bangun?" menunggu: lampu dibuat
   * terang tetap supaya tidak tertinggal redup 10% (memudahkan tidur lagi).
   */
  const tenang = (jenis: string, fase: "tunda" | "cek"): Saluran => {
    const rencanakan = (isi: IsiKejadian | null, sekarang: Date): RencanaLangkah[] =>
      (isi?.tuya ?? []).flatMap((a, i) => (a.kedip ? [{ jatuhTempo: sekarang, urutan: i * 100_000, parameter: { aturan: i, perangkat: a.perangkatId } }] : []));
    return {
      jenis,
      fase,
      saatTunda: "lanjut",
      rencana: () => [],
      ...(fase === "tunda" ? { rencanaTunda: rencanakan } : { rencanaCek: rencanakan }),
      jalankan: ({ kejadian, isi, langkah }) =>
        lindungi(async () => {
          const p = (langkah.parameter ?? {}) as Param;
          const a = isi?.tuya[p.aturan ?? -1];
          if (!a || a.perangkatId !== p.perangkat || !a.kedip) return { hasil: { lewat: "aturan_berubah" } };
          const c = await b.konteks(kejadian.penggunaId);
          if ("lewat" in c) return { hasil: { lewat: c.lewat } };
          const h = await b.aksi(c.k, c.klien, kejadian, a.perangkatId, { terangPersen: a.aksi.terang ?? 100 }, { konfirmasi: false, potret: false });
          return { hasil: { ...h, tenang: true } };
        }),
    };
  };

  const tunda: Saluran = {
    jenis: "tuya_tunda",
    fase: "tunda",
    saatTunda: "lanjut",
    rencana: () => [],
    rencanaTunda: (isi, sekarang) =>
      (isi?.tuya ?? []).flatMap((a, i) => (a.kapan === "tunda" ? [{ jatuhTempo: sekarang, urutan: i * 100_000, parameter: { aturan: i, perangkat: a.perangkatId } }] : [])),
    jalankan: ({ kejadian, isi, langkah }) =>
      lindungi(async () => {
        const p = (langkah.parameter ?? {}) as Param;
        const a = isi?.tuya[p.aturan ?? -1];
        if (!a || a.perangkatId !== p.perangkat) return { hasil: { lewat: "aturan_berubah" } };
        const c = await b.konteks(kejadian.penggunaId);
        if ("lewat" in c) return { hasil: { lewat: c.lewat } };
        return { hasil: await b.aksi(c.k, c.klien, kejadian, a.perangkatId, perintahDari(a.aksi), { konfirmasi: true, potret: true }) };
      }),
  };

  const selesai: Saluran = {
    jenis: "tuya_selesai",
    fase: "selesai",
    saatTunda: "lanjut",
    rencana: () => [],
    rencanaSelesai: (isi, sekarang, _k, status) =>
      (isi?.tuya ?? []).map((a, i) => ({ jatuhTempo: sekarang, urutan: i * 100_000, parameter: { aturan: i, perangkat: a.perangkatId, status } })),
    jalankan: ({ kejadian, isi, langkah }) =>
      lindungi(async () => {
        const p = (langkah.parameter ?? {}) as Param;
        const a = isi?.tuya[p.aturan ?? -1];
        if (!a || a.perangkatId !== p.perangkat) return { hasil: { lewat: "aturan_berubah" } };
        const bangun = p.status === "bangun";
        const c = await b.konteks(kejadian.penggunaId);
        if ("lewat" in c) return { hasil: { lewat: c.lewat } };
        if (a.kapan === "sesudah") {
          if (!bangun) return { hasil: { lewat: "tidak_bangun" } };
          return { hasil: await b.aksi(c.k, c.klien, kejadian, a.perangkatId, perintahDari(a.aksi), { konfirmasi: true, potret: false }) };
        }
        if (a.sesudahBangun === "kembalikan") {
          // Dipulihkan sekali per perangkat per kejadian (beberapa aturan bisa menunjuk perangkat sama).
          const [pt] = await b.j((tx) =>
            tx
              .update(schema.potretTuya)
              .set({ dipulihkan: new Date() })
              .where(and(eq(schema.potretTuya.kejadianId, kejadian.id), eq(schema.potretTuya.deviceId, a.perangkatId), sql`${schema.potretTuya.dipulihkan} is null`))
              .returning(),
          );
          if (!pt) return { hasil: { lewat: "tanpa_potret" } };
          if (!Object.keys(pt.properti).length) return { hasil: { lewat: "potret_kosong" } };
          return { hasil: { ...(await b.aksi(c.k, c.klien, kejadian, a.perangkatId, { properti: pt.properti }, { konfirmasi: true, potret: false })), kembalikan: true } };
        }
        if (a.sesudahBangun === "suasana_pagi") {
          if (!bangun) return { hasil: { lewat: "tidak_bangun" } };
          const [baris] = await b.j((tx) =>
            tx
              .select()
              .from(schema.perangkatTuya)
              .where(and(eq(schema.perangkatTuya.penggunaId, kejadian.penggunaId), eq(schema.perangkatTuya.deviceId, a.perangkatId))),
          );
          if (!baris || !kemampuanDari(baris).terang) return { hasil: { lewat: "bukan_lampu" } };
          return { hasil: { ...(await b.aksi(c.k, c.klien, kejadian, a.perangkatId, SUASANA_PAGI, { konfirmasi: true, potret: false })), pagi: true } };
        }
        // Biarkan: tapi lampu yang dikedipkan tidak ditinggal redup di 10%.
        if (a.kedip)
          return {
            hasil: { ...(await b.aksi(c.k, c.klien, kejadian, a.perangkatId, { terangPersen: a.aksi.terang ?? 100 }, { konfirmasi: false, potret: false })), biarkan: true },
          };
        return { hasil: { biarkan: true } };
      }),
  };

  const darurat: Saluran = {
    jenis: "tuya_darurat",
    saatTunda: "berhenti",
    rencana: (_isi, mulai, kej) => (kej.uji ? [] : [{ jatuhTempo: mulai }]),
    jalankan: ({ kejadian, langkah, sekarang }) =>
      lindungi(async () => {
        const s = await bacaSambungan(b.j, kejadian.penggunaId);
        if (!s || !s.darurat.aktif) return { hasil: { lewat: "mati" } };
        const mulai = kejadian.berbunyiPada ?? sekarang;
        const saat = new Date(mulai.getTime() + s.darurat.menit * 60_000);
        if (sekarang < saat) return { hasil: { tunggu: true }, ulangiPada: saat };
        const [{ n }] = await b.j((tx: Tx) =>
          tx
            .select({ n: sql<number>`count(*)::int` })
            .from(schema.langkahKejadian)
            .where(
              and(
                eq(schema.langkahKejadian.penggunaId, kejadian.penggunaId),
                eq(schema.langkahKejadian.jenis, "tuya_darurat"),
                sql`(${schema.langkahKejadian.hasil}->>'terkirim')::boolean is true`,
                gt(schema.langkahKejadian.diubah, new Date(sekarang.getTime() - 24 * 3_600_000)),
                sql`${schema.langkahKejadian.id} <> ${langkah.id}`,
              ),
            ),
        );
        if (n >= DARURAT_MAKS_SEHARI) return { hasil: { lewat: "batas_harian" } };
        const c = await b.konteks(kejadian.penggunaId);
        if ("lewat" in c) return { hasil: { lewat: c.lewat } };
        const pesan = isiTeks(c.k.t.rumah.darurat.pesan, { jam: c.k.bahasa === "id" ? kejadian.jamLokal.replace(":", ".") : kejadian.jamLokal, judul: kejadian.judul }).slice(
          0,
          200,
        );
        try {
          if (s.darurat.cara === "sms") await c.klien.smsKeDiriSendiri(pesan);
          else await c.klien.teleponKeDiriSendiri(pesan);
        } catch (e) {
          const g = await tanganiGalatTuya(b.j, c.k, e).catch((x: GalatLayanan) => x);
          return { hasil: { terkirim: false, lewat: g.kode }, ...(g.kode === "kunci_bermasalah" ? {} : { ulangiPada: new Date(sekarang.getTime() + DARURAT_ULANG_MS) }) };
        }
        return { hasil: { terkirim: true, cara: s.darurat.cara }, ulangiPada: new Date(sekarang.getTime() + DARURAT_ULANG_MS) };
      }),
  };

  return [pra, bareng, kedip, tenang("tuya_kedip_tunda", "tunda"), tenang("tuya_kedip_cek", "cek"), tunda, selesai, darurat];
}
