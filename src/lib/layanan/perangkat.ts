import { randomInt } from "node:crypto";
import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import { isiDariBaris } from "@/lib/alarm/baris";
import { db, denganHashToken, denganPengguna, schema, type Tx } from "@/lib/db";
import type { KemampuanPerangkat } from "@/lib/db/schema";
import { kejadianDalamRentang } from "@/lib/jadwal/pengulangan";
import { acakBase64Url, sha256Hex } from "@/lib/kripto";
import { catatAudit } from "./audit";
import { GalatLayanan, pesanMasukan, type Sumber } from "./dasar";
import { konteksPengguna } from "./konteks";
import { omelanUntuk, type OmelanPerangkat } from "./suara";

/**
 * Perangkat siaga (PRD H1, H4, H5; arsitektur §4 "perangkat juga memegang jadwal", §5).
 *
 *  - PC: aplikasi meminta kode sambung (tanpa akun), pengguna menyetujui di peramban yang sudah
 *    masuk, aplikasi mengambil token perangkat sekali pakai dengan rahasia tunggu miliknya.
 *    Token hanya disimpan hash-nya; kode dan rahasia juga hanya hash.
 *  - Web (Mode Jam Meja): didaftarkan dari sesi peramban, tanpa token.
 *  - Siaga = detak < 2 menit dan tidak dicabut.
 */

export type BarisPerangkat = typeof schema.perangkatSiaga.$inferSelect;

export const KODE_BERLAKU_MS = 10 * 60_000;
export const SIAGA_MS = 2 * 60_000;
export const JENDELA_JADWAL_MS = 24 * 60 * 60_000;
export const POLA_TOKEN_PERANGKAT = /^antikebo_pc_[A-Za-z0-9_-]{43}$/;

const HURUF_KODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I

function kodeAcak(): string {
  const h = Array.from({ length: 8 }, () => HURUF_KODE[randomInt(HURUF_KODE.length)]).join("");
  return `${h.slice(0, 4)}-${h.slice(4)}`;
}

/** Kode yang diketik/ditempel pengguna dirapikan: huruf besar, tanpa spasi, tanda hubung di tengah. */
export function rapikanKode(kode: string): string | null {
  const h = kode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (h.length !== 8 || [...h].some((c) => !HURUF_KODE.includes(c))) return null;
  return `${h.slice(0, 4)}-${h.slice(4)}`;
}

const SkemaNamaPerangkat = z
  .string()
  .trim()
  .min(1, "nama_wajib")
  .refine((s) => Array.from(s).length <= 40, "terlalu_panjang");

export const SkemaMintaKode = z.strictObject({ nama: SkemaNamaPerangkat, versi: z.string().max(20).optional() });
export const SkemaAmbilKode = z.strictObject({ kode: z.string().max(20), rahasia: z.string().min(20).max(100) });
export const SkemaDetak = z.strictObject({
  versi: z.string().max(20).optional(),
  kemampuan: z
    .strictObject({
      dicas: z.boolean().nullable().optional(),
      baterai: z.number().min(0).max(100).nullable().optional(),
      suara: z.boolean().nullable().optional(),
      layarMenyala: z.boolean().nullable().optional(),
    })
    .optional(),
  /** Perangkat memegang jadwal lokal sampai waktu ini (ISO). */
  siapSampai: z.iso.datetime({ offset: true }).optional(),
});

// ------------------------------------------------------------------ sambung PC

/** Langkah 1 (aplikasi PC, tanpa akun): minta kode sambung + rahasia tunggu. */
export async function mintaKodeSambung(masukan: unknown, sekarang = new Date()): Promise<{ kode: string; rahasia: string; kedaluwarsa: Date }> {
  const h = SkemaMintaKode.safeParse(masukan);
  if (!h.success) throw new GalatLayanan("masukan", "Nama perangkat tidak sah.");
  const rahasia = acakBase64Url(32);
  const kedaluwarsa = new Date(sekarang.getTime() + KODE_BERLAKU_MS);
  for (let coba = 0; coba < 5; coba++) {
    const kode = kodeAcak();
    const r = await db()
      .insert(schema.kodeSambung)
      .values({ kodeHash: sha256Hex(kode), rahasiaHash: sha256Hex(rahasia), namaPerangkat: h.data.nama, versiAplikasi: h.data.versi ?? null, kedaluwarsa, dibuat: sekarang })
      .onConflictDoNothing()
      .returning({ id: schema.kodeSambung.id });
    if (r.length) return { kode, rahasia, kedaluwarsa };
  }
  throw new Error("kode sambung bertabrakan terus");
}

export type InfoKode = { namaPerangkat: string; kedaluwarsa: Date; status: "menunggu" | "disetujui" | "diambil" | "kedaluwarsa" };

async function cariKode(kodeMentah: string, sekarang: Date) {
  const kode = rapikanKode(kodeMentah);
  if (!kode) return null;
  const [k] = await db()
    .select()
    .from(schema.kodeSambung)
    .where(eq(schema.kodeSambung.kodeHash, sha256Hex(kode)));
  if (!k) return null;
  const status = k.status === "menunggu" && k.kedaluwarsa <= sekarang ? "kedaluwarsa" : (k.status as InfoKode["status"]);
  return { ...k, status };
}

/** Halaman "Sambungkan PC ini?": nama PC dan status kode. */
export async function lihatKodeSambung(kode: string, sekarang = new Date()): Promise<InfoKode | null> {
  const k = await cariKode(kode, sekarang);
  return k ? { namaPerangkat: k.namaPerangkat, kedaluwarsa: k.kedaluwarsa, status: k.status } : null;
}

/** Langkah 2 (peramban yang sudah masuk): setujui kode. */
export async function setujuiKodeSambung(penggunaId: string, kode: string, sumber: Sumber, sekarang = new Date()): Promise<InfoKode> {
  const k = await cariKode(kode, sekarang);
  const t = await denganPengguna(penggunaId, async (tx) => (await konteksPengguna(tx, penggunaId)).t);
  if (!k || k.status === "kedaluwarsa") throw new GalatLayanan("tidak_ditemukan", t.sambung.kodeHabis);
  if (k.status !== "menunggu" && k.penggunaId !== penggunaId) throw new GalatLayanan("tidak_ditemukan", t.sambung.kodeHabis);
  if (k.status === "menunggu") {
    const r = await db()
      .update(schema.kodeSambung)
      .set({ status: "disetujui", penggunaId })
      .where(and(eq(schema.kodeSambung.id, k.id), eq(schema.kodeSambung.status, "menunggu")))
      .returning({ id: schema.kodeSambung.id });
    if (!r.length) throw new GalatLayanan("tidak_ditemukan", t.sambung.kodeHabis);
    await catatAudit(penggunaId, { sumber, jenis: "perangkat", ringkasan: `Kode sambung PC disetujui: ${k.namaPerangkat}` });
  }
  return { namaPerangkat: k.namaPerangkat, kedaluwarsa: k.kedaluwarsa, status: k.status === "menunggu" ? "disetujui" : k.status };
}

export type HasilAmbil = { status: "menunggu" } | { status: "tersambung"; token: string; perangkat: { id: string; nama: string } } | { status: "kedaluwarsa" };

/** Langkah 3 (aplikasi PC, polling): ambil token perangkat SEKALI dengan rahasia tunggu. */
export async function ambilTokenSambung(masukan: unknown, sekarang = new Date()): Promise<HasilAmbil> {
  const h = SkemaAmbilKode.safeParse(masukan);
  if (!h.success) throw new GalatLayanan("masukan", "Kode atau rahasia tidak sah.");
  const k = await cariKode(h.data.kode, sekarang);
  if (!k || k.rahasiaHash !== sha256Hex(h.data.rahasia)) return { status: "kedaluwarsa" };
  if (k.status === "menunggu") return { status: "menunggu" };
  if (k.status !== "disetujui" || !k.penggunaId) return { status: "kedaluwarsa" };
  const penggunaId = k.penggunaId;
  const token = `antikebo_pc_${acakBase64Url(32)}`;
  const p = await denganPengguna(penggunaId, async (tx) => {
    // Klaim kode dulu (sekali pakai) supaya dua permintaan bersamaan tidak membuat dua perangkat.
    const r = await tx
      .update(schema.kodeSambung)
      .set({ status: "diambil" })
      .where(and(eq(schema.kodeSambung.id, k.id), eq(schema.kodeSambung.status, "disetujui")))
      .returning({ id: schema.kodeSambung.id });
    if (!r.length) return null;
    const [baru] = await tx
      .insert(schema.perangkatSiaga)
      .values({ penggunaId, jenis: "pc", nama: k.namaPerangkat, tokenHash: sha256Hex(token), versiAplikasi: k.versiAplikasi, terakhirTerlihat: sekarang, dibuat: sekarang })
      .returning();
    await tx.update(schema.kodeSambung).set({ perangkatId: baru.id }).where(eq(schema.kodeSambung.id, k.id));
    await catatAudit(penggunaId, { sumber: "perangkat", jenis: "perangkat", ringkasan: `PC tersambung: ${baru.nama}`, detail: { perangkatId: baru.id } }, tx);
    return baru;
  });
  if (!p) return { status: "kedaluwarsa" };
  return { status: "tersambung", token, perangkat: { id: p.id, nama: p.nama } };
}

/** Otentikasi token perangkat (Bearer). Null bila salah, dicabut, atau bentuknya keliru. */
export async function perangkatDariToken(token: string): Promise<BarisPerangkat | null> {
  if (!POLA_TOKEN_PERANGKAT.test(token)) return null;
  const hash = sha256Hex(token);
  const [p] = await denganHashToken(hash, (tx) =>
    tx
      .select()
      .from(schema.perangkatSiaga)
      .where(and(eq(schema.perangkatSiaga.tokenHash, hash), isNull(schema.perangkatSiaga.dicabutPada)))
      .limit(1),
  );
  return p ?? null;
}

// ------------------------------------------------------------------ web (Mode Jam Meja)

export async function daftarkanPerangkatWeb(penggunaId: string, nama: unknown, sumber: Sumber, sekarang = new Date()): Promise<BarisPerangkat> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const h = SkemaNamaPerangkat.safeParse(nama);
    if (!h.success) throw new GalatLayanan("masukan", pesanMasukan(h.error, k.t));
    const [p] = await tx.insert(schema.perangkatSiaga).values({ penggunaId, jenis: "web", nama: h.data, terakhirTerlihat: sekarang, dibuat: sekarang }).returning();
    await catatAudit(penggunaId, { sumber, jenis: "perangkat", ringkasan: `Jam Meja dimulai: ${p.nama}`, detail: { perangkatId: p.id } }, tx);
    return p;
  });
}

// ------------------------------------------------------------------ detak, daftar, cabut

async function ambilPerangkat(tx: Tx, penggunaId: string, id: string): Promise<BarisPerangkat> {
  const k = await konteksPengguna(tx, penggunaId);
  const [p] = z.uuid().safeParse(id).success
    ? await tx
        .select()
        .from(schema.perangkatSiaga)
        .where(and(eq(schema.perangkatSiaga.penggunaId, penggunaId), eq(schema.perangkatSiaga.id, id), isNull(schema.perangkatSiaga.dicabutPada)))
    : [];
  if (!p) throw new GalatLayanan("tidak_ditemukan", k.t.siaga.tidakAda);
  return p;
}

export async function detakPerangkat(penggunaId: string, perangkatId: string, masukan: unknown, sekarang = new Date()): Promise<BarisPerangkat> {
  return denganPengguna(penggunaId, async (tx) => {
    const p = await ambilPerangkat(tx, penggunaId, perangkatId);
    const h = SkemaDetak.safeParse(masukan ?? {});
    if (!h.success) throw new GalatLayanan("masukan", "Detak tidak sah.");
    const [b] = await tx
      .update(schema.perangkatSiaga)
      .set({
        terakhirTerlihat: sekarang,
        ...(h.data.versi ? { versiAplikasi: h.data.versi } : {}),
        ...(h.data.kemampuan ? { kemampuan: { ...p.kemampuan, ...h.data.kemampuan } as KemampuanPerangkat } : {}),
        ...(h.data.siapSampai ? { siapSampai: new Date(h.data.siapSampai) } : {}),
      })
      .where(eq(schema.perangkatSiaga.id, p.id))
      .returning();
    return b;
  });
}

export type PerangkatTampil = {
  id: string;
  jenis: "pc" | "web";
  nama: string;
  versi: string | null;
  terakhirTerlihat: Date | null;
  /** Detak < 2 menit. */
  siaga: boolean;
  kemampuan: KemampuanPerangkat;
};

export function tampilPerangkat(p: BarisPerangkat, sekarang: Date): PerangkatTampil {
  return {
    id: p.id,
    jenis: p.jenis === "pc" ? "pc" : "web",
    nama: p.nama,
    versi: p.versiAplikasi,
    terakhirTerlihat: p.terakhirTerlihat,
    siaga: !!p.terakhirTerlihat && sekarang.getTime() - p.terakhirTerlihat.getTime() < SIAGA_MS,
    kemampuan: p.kemampuan,
  };
}

export async function daftarPerangkat(penggunaId: string, sekarang = new Date()): Promise<PerangkatTampil[]> {
  const daftar = await denganPengguna(penggunaId, (tx) =>
    tx
      .select()
      .from(schema.perangkatSiaga)
      .where(and(eq(schema.perangkatSiaga.penggunaId, penggunaId), isNull(schema.perangkatSiaga.dicabutPada)))
      .orderBy(asc(schema.perangkatSiaga.dibuat)),
  );
  return daftar.map((p) => tampilPerangkat(p, sekarang));
}

export async function ubahNamaPerangkat(penggunaId: string, id: string, nama: unknown, sumber: Sumber): Promise<PerangkatTampil> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const p = await ambilPerangkat(tx, penggunaId, id);
    const h = SkemaNamaPerangkat.safeParse(nama);
    if (!h.success) throw new GalatLayanan("masukan", pesanMasukan(h.error, k.t));
    const [b] = await tx.update(schema.perangkatSiaga).set({ nama: h.data }).where(eq(schema.perangkatSiaga.id, p.id)).returning();
    await catatAudit(penggunaId, { sumber, jenis: "perangkat", ringkasan: `Perangkat dinamai ulang: ${b.nama}`, detail: { perangkatId: p.id } }, tx);
    return tampilPerangkat(b, new Date());
  });
}

/** Putuskan perangkat: token tidak berlaku lagi, aliran SSE-nya ditutup (pemicu `cabut`). */
export async function cabutPerangkat(penggunaId: string, id: string, sumber: Sumber, sekarang = new Date()): Promise<void> {
  await denganPengguna(penggunaId, async (tx) => {
    const p = await ambilPerangkat(tx, penggunaId, id);
    await tx.update(schema.perangkatSiaga).set({ dicabutPada: sekarang, tokenHash: null }).where(eq(schema.perangkatSiaga.id, p.id));
    await catatAudit(penggunaId, { sumber, jenis: "perangkat", ringkasan: `Perangkat diputus: ${p.nama}`, detail: { perangkatId: p.id } }, tx);
  });
}

// ------------------------------------------------------------------ jadwal 24 jam

export type ItemJadwal = {
  /** Kunci tetap kejadian (`alarmId:tanggal`, atau `uji:<id>`): perangkat memakainya supaya tidak berbunyi dobel. */
  kunci: string;
  kejadianId: string | null;
  alarmId: string | null;
  jadwalUtc: string;
  tanggal: string;
  jam: string;
  status: string;
  judul: string;
  detail: string | null;
  bunyi: string;
  karakter: string;
  suaraId: string | null;
  soal: { jenis: string; tingkat: string; benar: number };
  tunda: { jatah: number; menit: number; terpakai: number };
  tundaSampai: string | null;
  uji: boolean;
  /** Kalimat omelan (teks untuk cadangan suara perangkat) + klip siap (`/api/perangkat/klip/<hash>`). */
  omelan: OmelanPerangkat[];
};

/**
 * Salinan jadwal untuk perangkat siaga: kejadian yang sedang aktif + semua kejadian 24 jam ke
 * depan (termasuk yang belum dimaterialisasi). Tanpa jawaban soal, tanpa rahasia.
 */
export async function jadwalPerangkat(penggunaId: string, sekarang = new Date()): Promise<ItemJadwal[]> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const sampai = new Date(sekarang.getTime() + JENDELA_JADWAL_MS);
    const kejadian = await tx
      .select()
      .from(schema.kejadianAlarm)
      .where(
        and(
          eq(schema.kejadianAlarm.penggunaId, penggunaId),
          or(
            inArray(schema.kejadianAlarm.status, ["berbunyi", "ditunda", "cek_bangun"]),
            and(
              eq(schema.kejadianAlarm.status, "menunggu"),
              lte(schema.kejadianAlarm.jadwalUtc, sampai),
              gte(schema.kejadianAlarm.jadwalUtc, new Date(sekarang.getTime() - 60_000)),
            ),
          ),
        ),
      );
    const alarm = await tx
      .select()
      .from(schema.alarm)
      .where(and(eq(schema.alarm.penggunaId, penggunaId), eq(schema.alarm.aktif, true)));
    const lewati = await tx.select().from(schema.lewatiAlarm).where(eq(schema.lewatiAlarm.penggunaId, penggunaId));

    const hasil = new Map<string, ItemJadwal>();
    for (const kej of kejadian) {
      const a = alarm.find((x) => x.id === kej.alarmId);
      const isi = (kej.isi as ReturnType<typeof isiDariBaris> | null) ?? (a ? isiDariBaris(a) : null);
      if (!isi) continue;
      const kunci = kej.uji || !kej.alarmId ? `uji:${kej.id}` : `${kej.alarmId}:${kej.tanggalLokal}`;
      hasil.set(kunci, {
        kunci,
        kejadianId: kej.id,
        alarmId: kej.alarmId,
        jadwalUtc: kej.jadwalUtc.toISOString(),
        tanggal: kej.tanggalLokal,
        jam: kej.jamLokal,
        status: kej.status,
        judul: kej.judul,
        detail: isi.agendaDetail,
        bunyi: isi.bunyi,
        karakter: isi.karakter,
        suaraId: isi.suaraId,
        soal: { jenis: isi.soal.jenis, tingkat: isi.soal.tingkat, benar: isi.soal.benar },
        tunda: { jatah: isi.tunda.jatah, menit: isi.tunda.menit, terpakai: kej.jumlahTunda },
        tundaSampai: kej.tundaSampai?.toISOString() ?? null,
        uji: kej.uji,
        omelan: await omelanUntuk(tx, k, isi),
      });
    }
    for (const a of alarm) {
      const isi = isiDariBaris(a);
      const lw = lewati.filter((x) => x.alarmId === a.id).map((x) => x.tanggal);
      for (const j of kejadianDalamRentang(isi.pengulangan, isi.jam, a.zona, new Date(sekarang.getTime() - 1), sampai, { lewati: lw, liburNasional: isi.liburNasional })) {
        const kunci = `${a.id}:${j.tanggal}`;
        if (hasil.has(kunci)) continue;
        hasil.set(kunci, {
          kunci,
          kejadianId: null,
          alarmId: a.id,
          jadwalUtc: j.utc.toISOString(),
          tanggal: j.tanggal,
          jam: isi.jam,
          status: "menunggu",
          judul: isi.agendaJudul,
          detail: isi.agendaDetail,
          bunyi: isi.bunyi,
          karakter: isi.karakter,
          suaraId: isi.suaraId,
          soal: { jenis: isi.soal.jenis, tingkat: isi.soal.tingkat, benar: isi.soal.benar },
          tunda: { jatah: isi.tunda.jatah, menit: isi.tunda.menit, terpakai: 0 },
          tundaSampai: null,
          uji: false,
          omelan: await omelanUntuk(tx, k, isi),
        });
      }
    }
    return [...hasil.values()].sort((x, y) => x.jadwalUtc.localeCompare(y.jadwalUtc));
  });
}
