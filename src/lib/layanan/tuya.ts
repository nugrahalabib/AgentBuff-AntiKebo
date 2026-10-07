import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AturanTuya } from "@/lib/alarm/isi";
import { denganPengguna, schema, type Tx } from "@/lib/db";
import { modeTiruan, envOpsional } from "@/lib/env";
import { isi } from "@/lib/i18n";
import { bukaRahasia, sandikanRahasia } from "@/lib/kripto";
import { log } from "@/lib/log";
import { jenisDari, LABEL_JENIS, type JenisPerangkat } from "@/lib/tuya/jenis";
import { bacaKeadaan, pilihanBermakna, rakitKemampuan, terjemahkan, type Kemampuan, type PerintahRamah } from "@/lib/tuya/kemampuan";
import { GalatTuya, KlienTuya } from "@/lib/tuya/klien";
import { bandingkanLaporan } from "@/lib/tuya/konfirmasi";
import type { ModelPerangkat, PerangkatRingkas } from "@/lib/tuya/tipe";
import { bacaKunci, samarkanKunci, WILAYAH, type KodeWilayah } from "@/lib/tuya/wilayah";
import { catatAudit } from "./audit";
import { GalatLayanan, type Sumber } from "./dasar";
import { konteksPengguna, type KonteksPengguna } from "./konteks";

/**
 * Rumah pintar Tuya (PRD I1 sampai I5; disalin dan disesuaikan dari template AgentBuff-Tuya).
 * Kunci `sk-...` milik pengguna tersandi amplop (AAD terikat pengguna), dibuka hanya di server
 * tepat sebelum memanggil Tuya, tidak pernah dikirim ke peramban, agen, atau log.
 *
 * Fungsi inti menerima `Jalankan` (cara membuka transaksi) supaya dipakai web (konteks pengguna)
 * dan worker (peran antikebo_worker) dengan aturan yang sama.
 */

export type Jalankan = <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;
const web =
  (penggunaId: string): Jalankan =>
  (fn) =>
    denganPengguna(penggunaId, fn);

const aad = (penggunaId: string) => `tuya:${penggunaId}`;
const MODEL_BASI_MS = 7 * 24 * 60 * 60 * 1000;

/** Server Tuya tiruan untuk pengembangan/uji: hanya berlaku di mode tiruan (kunci tidak pernah dikirim ke alamat lain di produksi). */
export function opsiKlien(): { basisOverride?: string } {
  const basis = envOpsional("TUYA_BASIS_UJI");
  return basis && modeTiruan() ? { basisOverride: basis } : {};
}

export type Sambungan = typeof schema.sambunganTuya.$inferSelect;
export type BarisPerangkat = typeof schema.perangkatTuya.$inferSelect;
export type Struktur = { rumah: Array<{ id: string; nama: string; ruangan: Array<{ id: string; nama: string }> }> };
export type RingkasanSinkron = { rumah: number; ruangan: number; perangkat: number; online: number };

export async function bacaSambungan(j: Jalankan, penggunaId: string): Promise<Sambungan | null> {
  const [s] = await j((tx) => tx.select().from(schema.sambunganTuya).where(eq(schema.sambunganTuya.penggunaId, penggunaId)).limit(1));
  return s ?? null;
}

export async function klienUntuk(j: Jalankan, k: KonteksPengguna, s?: Sambungan | null): Promise<KlienTuya> {
  const sambungan = s === undefined ? await bacaSambungan(j, k.id) : s;
  if (!sambungan) throw new GalatLayanan("belum_tersambung", k.t.rumah.galat.belum_tersambung);
  if (sambungan.status === "kunci_bermasalah") throw new GalatLayanan("kunci_bermasalah", k.t.rumah.galat.kunci_bermasalah);
  return new KlienTuya(bukaRahasia(sambungan.kunciSandi, aad(k.id)), opsiKlien());
}

/** Galat Tuya jadi galat layanan ramah; kunci ditolak = sambungan ditandai bermasalah (spanduk perbaikan, PRD I5). */
export async function tanganiGalatTuya(j: Jalankan, k: KonteksPengguna, e: unknown, nama = ""): Promise<never> {
  if (e instanceof GalatLayanan) throw e;
  const G = k.t.rumah.galat;
  if (e instanceof GalatTuya) {
    switch (e.jenis) {
      case "kunci_tidak_sah":
        await j((tx) =>
          tx
            .update(schema.sambunganTuya)
            .set({ status: "kunci_bermasalah", statusPesan: `Tuya menolak kunci (${e.kode ?? "?"})`, diubah: new Date() })
            .where(eq(schema.sambunganTuya.penggunaId, k.id)),
        );
        throw new GalatLayanan("kunci_bermasalah", G.kunci_bermasalah);
      case "perangkat_tak_ada":
        throw new GalatLayanan("tidak_ditemukan", G.tidak_ada);
      case "perangkat_offline":
        throw new GalatLayanan("offline", isi(G.offline, { nama }));
      case "model_tak_ada":
      case "parameter":
        throw new GalatLayanan("tidak_didukung", isi(G.tidak_didukung, { nama }));
      case "batas_laju":
      case "batas_notifikasi":
        throw new GalatLayanan("batas_laju", G.batas_laju);
      default:
        log.warn({ jenis: e.jenis, kode: e.kode }, "galat Tuya");
        throw new GalatLayanan("tuya_gangguan", G.gangguan);
    }
  }
  throw e;
}

export async function denganTuya<T>(j: Jalankan, k: KonteksPengguna, fn: (klien: KlienTuya) => Promise<T>, nama = ""): Promise<T> {
  const klien = await klienUntuk(j, k);
  try {
    return await fn(klien);
  } catch (e) {
    return tanganiGalatTuya(j, k, e, nama);
  }
}

/** Jalankan `fn` untuk setiap butir dengan paling banyak `n` serentak (sopan ke batas laju Tuya). */
async function petaTerbatas<T, R>(daftar: T[], n: number, fn: (x: T) => Promise<R>): Promise<Array<PromiseSettledResult<R>>> {
  const hasil: Array<PromiseSettledResult<R>> = new Array(daftar.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, daftar.length) }, async () => {
      while (i < daftar.length) {
        const x = i++;
        try {
          hasil[x] = { status: "fulfilled", value: await fn(daftar[x]) };
        } catch (e) {
          hasil[x] = { status: "rejected", reason: e };
        }
      }
    }),
  );
  return hasil;
}

/** Sinkron penuh rumah, ruangan, perangkat, keadaan, dan model (pola template). Perangkat hilang ditandai, tidak dihapus. */
export async function sinkronkan(j: Jalankan, penggunaId: string, klien: KlienTuya): Promise<RingkasanSinkron> {
  const rumah = await klien.rumah();
  const struktur: Struktur = { rumah: [] };
  const perangkat: Array<PerangkatRingkas & { home_id: string }> = [];
  for (const r of rumah) {
    const [ruangan, alat] = await Promise.all([klien.ruangan(r.home_id).catch(() => []), klien.perangkatRumah(r.home_id)]);
    struktur.rumah.push({ id: String(r.home_id), nama: r.name, ruangan: ruangan.map((x) => ({ id: String(x.room_id), nama: x.name })) });
    for (const d of alat) perangkat.push({ ...d, home_id: String(r.home_id) });
  }
  if (rumah.length === 0) for (const d of await klien.semuaPerangkat()) perangkat.push({ ...d, home_id: "" });

  const ada = await j((tx) =>
    tx
      .select({ deviceId: schema.perangkatTuya.deviceId, modelDiperbarui: schema.perangkatTuya.modelDiperbarui })
      .from(schema.perangkatTuya)
      .where(eq(schema.perangkatTuya.penggunaId, penggunaId)),
  );
  const modelLama = new Map(ada.map((a) => [a.deviceId, a.modelDiperbarui]));
  const butuhModel = perangkat.filter((d) => {
    const t = modelLama.get(d.device_id);
    return !t || Date.now() - t.getTime() > MODEL_BASI_MS;
  });
  const [detail, model] = await Promise.all([petaTerbatas(perangkat, 3, (d) => klien.detail(d.device_id)), petaTerbatas(butuhModel, 3, (d) => klien.model(d.device_id))]);
  const modelPer = new Map<string, ModelPerangkat>();
  butuhModel.forEach((d, i) => {
    const m = model[i];
    if (m.status === "fulfilled") modelPer.set(d.device_id, m.value);
  });

  const kini = new Date();
  const idSekarang = new Set<string>();
  let online = 0;
  await j(async (tx) => {
    for (const [i, d] of perangkat.entries()) {
      idSekarang.add(d.device_id);
      const det = detail[i].status === "fulfilled" ? detail[i].value : null;
      const m = modelPer.get(d.device_id);
      const nyala = det ? det.online : d.online;
      if (nyala) online++;
      const nilai = {
        homeId: d.home_id || null,
        roomId: d.room_id ? String(d.room_id) : null,
        nama: (det?.name || d.name || "Perangkat").slice(0, 120),
        kategori: d.category || det?.category || "",
        kategoriNama: d.category_name ?? det?.category_name ?? null,
        produkNama: det?.product_name ?? null,
        online: nyala,
        hilangPada: null,
        diubah: kini,
        ...(det?.properties ? { properti: det.properties, propertiDiperbarui: kini } : {}),
        ...(m ? { model: m, modelDiperbarui: kini } : {}),
      };
      await tx
        .insert(schema.perangkatTuya)
        .values({ penggunaId, deviceId: d.device_id, ...nilai })
        .onConflictDoUpdate({ target: [schema.perangkatTuya.penggunaId, schema.perangkatTuya.deviceId], set: nilai });
    }
    for (const a of ada)
      if (!idSekarang.has(a.deviceId))
        await tx
          .update(schema.perangkatTuya)
          .set({ hilangPada: sql`coalesce(${schema.perangkatTuya.hilangPada}, now())`, online: false })
          .where(and(eq(schema.perangkatTuya.penggunaId, penggunaId), eq(schema.perangkatTuya.deviceId, a.deviceId)));
    await tx
      .update(schema.sambunganTuya)
      .set({
        struktur,
        strukturDiperbarui: kini,
        diperiksaPada: kini,
        status: "aktif",
        statusPesan: null,
        rumahUtamaId: sql`coalesce(${schema.sambunganTuya.rumahUtamaId}, ${struktur.rumah[0]?.id ?? null})`,
      })
      .where(eq(schema.sambunganTuya.penggunaId, penggunaId));
  });
  return { rumah: struktur.rumah.length, ruangan: struktur.rumah.reduce((n, r) => n + r.ruangan.length, 0), perangkat: perangkat.length, online };
}

// ------------------------------------------------------------------ sambungan (web)

export type HasilSimpanKunci = RingkasanSinkron & { wilayah: { kode: KodeWilayah; nama: string } };

/** Simpan/perbarui kunci (PRD I1). Kunci diuji ke Tuya dulu; yang ditolak tidak pernah disimpan. */
export async function simpanKunci(penggunaId: string, masukan: unknown, sumber: Sumber): Promise<HasilSimpanKunci> {
  const j = web(penggunaId);
  const k = await j((tx) => konteksPengguna(tx, penggunaId));
  const G = k.t.rumah.galat;
  const baca = bacaKunci(typeof masukan === "string" ? masukan.slice(0, 300) : "");
  if (!baca.ok) throw new GalatLayanan("kunci_tidak_sah", G[baca.alasan]);
  const klien = new KlienTuya(baca.kunci, opsiKlien());
  try {
    await klien.rumah();
  } catch (e) {
    if (e instanceof GalatTuya && e.jenis === "kunci_tidak_sah") throw new GalatLayanan("kunci_tidak_sah", G.kunci_ditolak);
    throw new GalatLayanan("tuya_gangguan", G.gangguan);
  }
  const nilai = {
    kunciSandi: sandikanRahasia(baca.kunci, aad(penggunaId)),
    kunciSamar: samarkanKunci(baca.kunci),
    wilayah: baca.wilayah.kode,
    status: "aktif",
    statusPesan: null,
    tersambungPada: new Date(),
    diperiksaPada: new Date(),
    diubah: new Date(),
  };
  await j((tx) =>
    tx
      .insert(schema.sambunganTuya)
      .values({ penggunaId, ...nilai })
      .onConflictDoUpdate({ target: schema.sambunganTuya.penggunaId, set: nilai }),
  );
  const ringkas = await sinkronkan(j, penggunaId, klien).catch((e) => tanganiGalatTuya(j, k, e));
  await catatAudit(penggunaId, { sumber, jenis: "perangkat", ringkasan: `Rumah pintar tersambung: ${ringkas.perangkat} perangkat`, detail: { wilayah: baca.wilayah.kode } });
  return { ...ringkas, wilayah: { kode: baca.wilayah.kode, nama: baca.wilayah.nama[k.bahasa] } };
}

/** Putuskan: kunci dan cermin perangkat dihapus; aturan di alarm tetap (berlaku lagi bila disambung ulang). */
export async function putuskan(penggunaId: string, sumber: Sumber, sekarang = new Date()): Promise<void> {
  await denganPengguna(penggunaId, async (tx) => {
    const { tolakSelamaKomitmen } = await import("./komitmen-aktif");
    await tolakSelamaKomitmen(tx, await konteksPengguna(tx, penggunaId), sekarang, "putus_rumah");
    await tx.delete(schema.perangkatTuya).where(eq(schema.perangkatTuya.penggunaId, penggunaId));
    await tx.delete(schema.sambunganTuya).where(eq(schema.sambunganTuya.penggunaId, penggunaId));
  });
  await catatAudit(penggunaId, { sumber, jenis: "perangkat", ringkasan: "Rumah pintar diputus; kunci dihapus dari server" });
}

export type DaruratTuya = Sambungan["darurat"];
export type StatusRumah =
  | { tersambung: false }
  | { tersambung: true; bermasalah: boolean; pesan: string | null; kunciSamar: string; wilayah: { kode: string; nama: string }; perangkat: number; darurat: DaruratTuya };

export async function statusRumah(penggunaId: string): Promise<StatusRumah> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const [s] = await tx.select().from(schema.sambunganTuya).where(eq(schema.sambunganTuya.penggunaId, penggunaId));
    if (!s) return { tersambung: false as const };
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.perangkatTuya)
      .where(and(eq(schema.perangkatTuya.penggunaId, penggunaId), sql`${schema.perangkatTuya.hilangPada} is null`));
    const bermasalah = s.status === "kunci_bermasalah";
    return {
      tersambung: true as const,
      bermasalah,
      pesan: bermasalah ? k.t.rumah.spanduk.isi : null,
      kunciSamar: s.kunciSamar,
      wilayah: { kode: s.wilayah, nama: WILAYAH[s.wilayah as KodeWilayah]?.nama[k.bahasa] ?? s.wilayah },
      perangkat: n,
      darurat: s.darurat,
    };
  });
}

const SkemaDarurat = z.strictObject({ aktif: z.boolean(), menit: z.int().min(5).max(60), cara: z.enum(["telepon", "sms"]) });

/** Lapisan darurat tersembunyi (PRD I6): mati bawaannya, hanya untuk rumah yang tersambung. */
export async function aturDarurat(penggunaId: string, masukan: unknown, sumber: Sumber, sekarang = new Date()): Promise<DaruratTuya> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const m = SkemaDarurat.safeParse(masukan ?? {});
    if (!m.success) throw new GalatLayanan("masukan", isi(k.t.galat.masukan, { isian: isi(k.t.galat.isian.umum, { isian: m.error.issues[0]?.path.join(".") || "darurat" }) }));
    // Mematikan lapisan darurat yang menyala = melemahkan alarm terkunci (K-34).
    const [lama] = await tx.select({ darurat: schema.sambunganTuya.darurat }).from(schema.sambunganTuya).where(eq(schema.sambunganTuya.penggunaId, penggunaId));
    if (lama?.darurat.aktif && !m.data.aktif) {
      const { tolakSelamaKomitmen } = await import("./komitmen-aktif");
      await tolakSelamaKomitmen(tx, k, sekarang, "darurat_mati");
    }
    const r = await tx.update(schema.sambunganTuya).set({ darurat: m.data, diubah: new Date() }).where(eq(schema.sambunganTuya.penggunaId, penggunaId)).returning();
    if (!r.length) throw new GalatLayanan("belum_tersambung", k.t.rumah.galat.belum_tersambung);
    await catatAudit(
      penggunaId,
      { sumber, jenis: "pengaturan", ringkasan: m.data.aktif ? "Lapisan darurat rumah pintar dinyalakan" : "Lapisan darurat rumah pintar dimatikan" },
      tx,
    );
    return m.data;
  });
}

// ------------------------------------------------------------------ perangkat

export function kemampuanDari(b: Pick<BarisPerangkat, "model" | "properti">): Kemampuan {
  return rakitKemampuan(b.model as ModelPerangkat | null, b.properti ?? undefined);
}

/** Aksi alarm yang bisa dilakukan perangkat (untuk layar aturan dan validasi). */
export type BisaAlarm = { nyala: boolean; terang: boolean; warna: boolean; suhuPutih: boolean; suhuAc: { min: number; max: number } | null; modeAc: string[] };

export function bisaAlarm(k: Kemampuan): BisaAlarm {
  const skala = (x: { scale: number }) => 10 ** x.scale;
  return {
    nyala: !!k.daya || !!k.saluran?.length,
    terang: !!k.terang,
    warna: !!k.warna,
    suhuPutih: !!k.suhuPutih,
    suhuAc: k.suhuTarget && k.modeAc ? { min: k.suhuTarget.min / skala(k.suhuTarget), max: k.suhuTarget.max / skala(k.suhuTarget) } : null,
    modeAc: k.modeAc ? pilihanBermakna(k.modeAc) : [],
  };
}

export type PerangkatRumah = { id: string; nama: string; jenis: JenisPerangkat; jenisLabel: string; online: boolean; nyala: boolean | null; bisa: BisaAlarm };
export type RuanganRumah = { id: string | null; nama: string; perangkat: PerangkatRumah[] };

/** Daftar perangkat per ruangan dengan status online (PRD I2). */
export async function daftarPerangkatRumah(penggunaId: string): Promise<{ ruangan: RuanganRumah[] }> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const [s] = await tx.select({ struktur: schema.sambunganTuya.struktur }).from(schema.sambunganTuya).where(eq(schema.sambunganTuya.penggunaId, penggunaId));
    if (!s) throw new GalatLayanan("belum_tersambung", k.t.rumah.galat.belum_tersambung);
    const struktur = (s.struktur as Struktur | null) ?? { rumah: [] };
    const namaRuang = new Map(struktur.rumah.flatMap((r) => r.ruangan.map((x) => [x.id, x.nama] as const)));
    const baris = await tx
      .select()
      .from(schema.perangkatTuya)
      .where(and(eq(schema.perangkatTuya.penggunaId, penggunaId), sql`${schema.perangkatTuya.hilangPada} is null`))
      .orderBy(asc(schema.perangkatTuya.nama));
    const per = new Map<string, RuanganRumah>();
    for (const b of baris) {
      const kunci = b.roomId && namaRuang.has(b.roomId) ? b.roomId : "";
      if (!per.has(kunci)) per.set(kunci, { id: kunci || null, nama: kunci ? namaRuang.get(kunci)! : k.t.rumah.tanpaRuangan, perangkat: [] });
      const km = kemampuanDari(b);
      const jenis = jenisDari(b.kategori);
      per.get(kunci)!.perangkat.push({
        id: b.deviceId,
        nama: b.nama,
        jenis,
        jenisLabel: b.kategoriNama || LABEL_JENIS[jenis][k.bahasa],
        online: b.online,
        nyala: bacaKeadaan(km, b.properti).nyala ?? null,
        bisa: bisaAlarm(km),
      });
    }
    return { ruangan: [...per.values()].sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : a.nama.localeCompare(b.nama))) };
  });
}

/** Perintah alarm (PRD I3) dalam bentuk perintah ramah template. */
export function perintahDari(aksi: AturanTuya["aksi"]): PerintahRamah {
  return {
    ...(aksi.nyala !== undefined ? { nyala: aksi.nyala } : {}),
    ...(aksi.terang !== undefined ? { terangPersen: aksi.terang } : {}),
    ...(aksi.warna !== undefined ? { warna: aksi.warna } : {}),
    ...(aksi.suhuPutih !== undefined ? { suhuPutihPersen: aksi.suhuPutih } : {}),
    ...(aksi.suhuAc !== undefined ? { suhuTarget: aksi.suhuAc } : {}),
    ...(aksi.modeAc !== undefined ? { modeAc: aksi.modeAc } : {}),
  };
}

/** Aturan rumah pintar alarm: perangkat milik pengguna dan sanggup melakukan aksinya (dipanggil saat menyimpan alarm). */
export async function periksaAturanTuya(tx: Tx, k: KonteksPengguna, aturan: readonly AturanTuya[]): Promise<void> {
  if (!aturan.length) return;
  const salah = (kunci: "tuya_tidak_ada" | "tuya_tidak_bisa") => new GalatLayanan("masukan", isi(k.t.galat.masukan, { isian: k.t.galat.isian[kunci] }));
  const baris = await tx.select().from(schema.perangkatTuya).where(eq(schema.perangkatTuya.penggunaId, k.id));
  for (const a of aturan) {
    const b = baris.find((x) => x.deviceId === a.perangkatId && !x.hilangPada);
    if (!b) throw salah("tuya_tidak_ada");
    if (!b.model) continue; // model belum pernah terbaca: diperiksa lagi saat dijalankan
    const km = kemampuanDari(b);
    if (a.kedip && !km.terang) throw salah("tuya_tidak_bisa");
    const cmd = perintahDari(a.aksi);
    if (Object.keys(cmd).length && !terjemahkan(km, cmd, b.properti).ok) throw salah("tuya_tidak_bisa");
  }
}

// ------------------------------------------------------------------ kendali

export type StatusKendali = "terkonfirmasi" | "belum_terkonfirmasi" | "terkirim";

export async function barisPerangkat(j: Jalankan, k: KonteksPengguna, deviceId: string): Promise<BarisPerangkat> {
  const [b] = await j((tx) =>
    tx
      .select()
      .from(schema.perangkatTuya)
      .where(and(eq(schema.perangkatTuya.penggunaId, k.id), eq(schema.perangkatTuya.deviceId, deviceId)))
      .limit(1),
  );
  if (!b || b.hilangPada) throw new GalatLayanan("tidak_ditemukan", k.t.rumah.galat.tidak_ada);
  return b;
}

async function pastikanModel(j: Jalankan, b: BarisPerangkat, klien: KlienTuya): Promise<BarisPerangkat> {
  if (b.model && b.modelDiperbarui && Date.now() - b.modelDiperbarui.getTime() < MODEL_BASI_MS) return b;
  const m = await klien.model(b.deviceId);
  await j((tx) =>
    tx
      .update(schema.perangkatTuya)
      .set({ model: m, modelDiperbarui: new Date() })
      .where(and(eq(schema.perangkatTuya.penggunaId, b.penggunaId), eq(schema.perangkatTuya.deviceId, b.deviceId))),
  );
  return { ...b, model: m, modelDiperbarui: new Date() };
}

const tunggu = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Tunggu perangkat melaporkan keadaan baru (PRD I4, pola template; maks ~4 dtk). */
async function tungguLaporan(klien: KlienTuya, b: BarisPerangkat, km: Kemampuan, harap: Record<string, unknown>, jeda: readonly number[]) {
  let nyata: Record<string, unknown> | null = null;
  let status: ReturnType<typeof bandingkanLaporan>["status"] = "tak_terukur";
  for (const ms of jeda) {
    await tunggu(ms);
    const d = await klien.detail(b.deviceId).catch(() => null);
    if (!d) continue;
    nyata = d.properties ?? null;
    status = bandingkanLaporan(km, b.model as ModelPerangkat | null, harap, nyata).status;
    if (status !== "beda") break;
  }
  return { status, nyata };
}

export const JEDA_KONFIRMASI = [800, 1200, 1800] as const;

/**
 * Kirim satu perintah ke perangkat milik pengguna (web dan worker). Perangkat offline ditolak
 * (`offline`), perintah yang tidak bisa dilakukan perangkat ditolak (`tidak_didukung`).
 * `konfirmasi` = tunggu perangkat melaporkan keadaan baru; tanpa itu (kedip, langkah naik) cukup
 * terkirim. Cermin keadaan diperbarui.
 */
export async function kirimPerintah(
  j: Jalankan,
  k: KonteksPengguna,
  klien: KlienTuya,
  deviceId: string,
  cmd: PerintahRamah | { properti: Record<string, unknown> },
  opsi: { konfirmasi: boolean; jeda?: readonly number[] },
): Promise<{ status: StatusKendali; properti: Record<string, unknown>; nama: string }> {
  let b = await barisPerangkat(j, k, deviceId);
  if (!b.online) throw new GalatLayanan("offline", isi(k.t.rumah.galat.offline, { nama: b.nama }));
  try {
    b = await pastikanModel(j, b, klien);
    const km = kemampuanDari(b);
    let properti: Record<string, unknown>;
    if ("properti" in cmd && Object.keys(cmd).length === 1) properti = cmd.properti ?? {};
    else {
      const t = terjemahkan(km, cmd as PerintahRamah, b.properti);
      if (!t.ok) throw new GalatLayanan("tidak_didukung", isi(k.t.rumah.galat.tidak_didukung, { nama: b.nama }));
      properti = t.properti;
    }
    await klien.kirimProperti(b.deviceId, properti);
    let status: StatusKendali = "terkirim";
    let baru: Record<string, unknown> = { ...(b.properti ?? {}), ...properti };
    if (opsi.konfirmasi) {
      const l = await tungguLaporan(klien, b, km, properti, opsi.jeda ?? JEDA_KONFIRMASI);
      status = l.status === "cocok" ? "terkonfirmasi" : l.status === "beda" ? "belum_terkonfirmasi" : "terkirim";
      if (l.nyata && status !== "terkirim") baru = { ...(b.properti ?? {}), ...l.nyata };
    }
    await j((tx) =>
      tx
        .update(schema.perangkatTuya)
        .set({ properti: baru, propertiDiperbarui: new Date() })
        .where(and(eq(schema.perangkatTuya.penggunaId, b.penggunaId), eq(schema.perangkatTuya.deviceId, b.deviceId))),
    );
    return { status, properti, nama: b.nama };
  } catch (e) {
    if (e instanceof GalatTuya && e.jenis === "perangkat_offline")
      await j((tx) =>
        tx
          .update(schema.perangkatTuya)
          .set({ online: false })
          .where(and(eq(schema.perangkatTuya.penggunaId, b.penggunaId), eq(schema.perangkatTuya.deviceId, b.deviceId))),
      );
    return tanganiGalatTuya(j, k, e, b.nama);
  }
}

/** Kode properti yang perlu dipotret untuk dikembalikan sesudah bangun. */
export function kodePotret(km: Kemampuan): string[] {
  return [
    km.daya?.kode,
    ...(km.saluran?.map((s) => s.kode) ?? []),
    km.modeKerja?.kode,
    km.terang?.kode,
    km.suhuPutih?.kode,
    km.warna?.kode,
    km.suhuTarget?.kode,
    km.modeAc?.kode,
  ].filter((x): x is string => !!x);
}

/** Ambil keadaan terkini perangkat dari Tuya (untuk potret) dan perbarui cermin. */
export async function keadaanTerkini(j: Jalankan, k: KonteksPengguna, klien: KlienTuya, deviceId: string): Promise<{ baris: BarisPerangkat; properti: Record<string, unknown> }> {
  let b = await barisPerangkat(j, k, deviceId);
  try {
    b = await pastikanModel(j, b, klien);
    const d = await klien.detail(deviceId);
    await j((tx) =>
      tx
        .update(schema.perangkatTuya)
        .set({ online: d.online, properti: d.properties ?? b.properti, propertiDiperbarui: new Date() })
        .where(and(eq(schema.perangkatTuya.penggunaId, b.penggunaId), eq(schema.perangkatTuya.deviceId, deviceId))),
    );
    return { baris: { ...b, online: d.online, properti: d.properties ?? b.properti }, properti: d.properties ?? b.properti ?? {} };
  } catch (e) {
    return tanganiGalatTuya(j, k, e, b.nama);
  }
}

/**
 * Uji perangkat (PRD I2, I4): nyalakan (lampu: terang penuh) lalu kembalikan keadaan semula 2 dtk
 * kemudian. Hasil = apakah perangkat benar-benar melaporkan perubahan.
 */
export async function ujiPerangkat(
  penggunaId: string,
  deviceId: string,
  opsi: { jeda?: readonly number[]; jedaKembali?: number } = {},
): Promise<{ status: StatusKendali; pesan: string }> {
  const j = web(penggunaId);
  const k = await j((tx) => konteksPengguna(tx, penggunaId));
  return denganTuya(j, k, async (klien) => {
    const { baris, properti } = await keadaanTerkini(j, k, klien, deviceId);
    if (!baris.online) throw new GalatLayanan("offline", isi(k.t.rumah.galat.offline, { nama: baris.nama }));
    const km = kemampuanDari(baris);
    const sebelum = Object.fromEntries(
      kodePotret(km)
        .filter((x) => x in properti)
        .map((x) => [x, properti[x]]),
    );
    const h = await kirimPerintah(j, k, klien, deviceId, km.terang ? { nyala: true, terangPersen: 100 } : { nyala: true }, { konfirmasi: true, jeda: opsi.jeda });
    await tunggu(opsi.jedaKembali ?? 2_000);
    if (Object.keys(sebelum).length) await kirimPerintah(j, k, klien, deviceId, { properti: sebelum }, { konfirmasi: false }).catch(() => null);
    await catatAudit(penggunaId, { sumber: "web", jenis: "perangkat", ringkasan: `Uji perangkat rumah pintar: ${h.status}`, detail: { status: h.status } });
    const R = k.t.rumah;
    return { status: h.status, pesan: isi(h.status === "terkonfirmasi" ? R.ujiOk : h.status === "belum_terkonfirmasi" ? R.ujiBelum : R.ujiTerkirim, { nama: h.nama }) };
  });
}

/** Muat ulang daftar perangkat dari Tuya. */
export async function sinkronkanPengguna(penggunaId: string): Promise<RingkasanSinkron> {
  const j = web(penggunaId);
  const k = await j((tx) => konteksPengguna(tx, penggunaId));
  return denganTuya(j, k, (klien) => sinkronkan(j, penggunaId, klien));
}
