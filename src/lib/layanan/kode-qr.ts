import { and, asc, eq, inArray, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";
import { barisDari, denganPengguna, schema, type Tx } from "@/lib/db";
import { isi } from "@/lib/i18n";
import { acakBase64Url, bukaRahasia, sandikanRahasia, sha256Hex } from "@/lib/kripto";
import { catatAudit } from "./audit";
import { GalatLayanan, pesanMasukan, type Sumber } from "./dasar";
import { konteksPengguna, type KonteksPengguna } from "./konteks";

/**
 * Kode QR Misi QR (PRD D4). Isi acak 128 bit berawalan `antikebo-qr:`; server hanya
 * membandingkan hash pindaian, isinya tersandi amplop supaya halaman cetak bisa dibuka lagi (K-48).
 */

export const MAKS_KODE_QR = 10;
const AWALAN = "antikebo-qr:";
const aad = (penggunaId: string) => `kode_qr:${penggunaId}`;

const SkemaNama = z
  .string()
  .trim()
  .min(1, "nama_wajib")
  .refine((s) => Array.from(s).length <= 40, "terlalu_panjang");

export type KodeQrTampil = { id: string; nama: string; dibuat: Date; dipakai: number };

export function hashIsiQr(isiPindai: string): string {
  return sha256Hex(isiPindai.trim());
}

function periksaNama(nama: unknown, k: KonteksPengguna): string {
  const h = SkemaNama.safeParse(nama);
  if (!h.success) throw new GalatLayanan("masukan", pesanMasukan(h.error, k.t));
  return h.data;
}

async function ambil(tx: Tx, k: KonteksPengguna, id: string) {
  const [r] = z.uuid().safeParse(id).success
    ? await tx
        .select()
        .from(schema.kodeQr)
        .where(and(eq(schema.kodeQr.penggunaId, k.id), eq(schema.kodeQr.id, id)))
    : [];
  if (!r) throw new GalatLayanan("tidak_ditemukan", k.t.kodeQr.tidakAda);
  return r;
}

/** Alarm yang memakai kode ini (soal Misi QR atau gabungan). */
async function alarmPemakai(tx: Tx, penggunaId: string, id: string): Promise<Array<{ judul: string }>> {
  return barisDari<{ judul: string }>(
    await tx.execute(sql`select agenda_judul as judul from alarm where pengguna_id = ${penggunaId} and (soal->'kodeQr') @> jsonb_build_array(${id}::text)`),
  );
}

export async function buatKodeQr(penggunaId: string, nama: unknown, sumber: Sumber): Promise<KodeQrTampil> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const n = periksaNama(nama, k);
    const [{ jumlah }] = barisDari<{ jumlah: number }>(await tx.execute(sql`select count(*)::int as jumlah from kode_qr where pengguna_id = ${penggunaId}`));
    if (jumlah >= MAKS_KODE_QR) throw new GalatLayanan("masukan", isi(k.t.kodeQr.batas, { n: MAKS_KODE_QR }));
    const isiQr = `${AWALAN}${acakBase64Url(16)}`;
    const [r] = await tx
      .insert(schema.kodeQr)
      .values({ penggunaId, nama: n, isiHash: hashIsiQr(isiQr), isiTersandi: sandikanRahasia(isiQr, aad(penggunaId)) })
      .returning();
    await catatAudit(penggunaId, { sumber, jenis: "alarm", ringkasan: `Kode QR dibuat: ${n}`, detail: { kodeQrId: r.id } }, tx);
    return { id: r.id, nama: r.nama, dibuat: r.dibuat, dipakai: 0 };
  });
}

export async function daftarKodeQr(penggunaId: string): Promise<KodeQrTampil[]> {
  return denganPengguna(penggunaId, async (tx) => {
    const daftar = await tx.select().from(schema.kodeQr).where(eq(schema.kodeQr.penggunaId, penggunaId)).orderBy(asc(schema.kodeQr.dibuat));
    const alarm = await tx.select({ soal: schema.alarm.soal }).from(schema.alarm).where(eq(schema.alarm.penggunaId, penggunaId));
    return daftar.map((r) => ({ id: r.id, nama: r.nama, dibuat: r.dibuat, dipakai: alarm.filter((a) => a.soal.kodeQr.includes(r.id)).length }));
  });
}

export async function ubahNamaKodeQr(penggunaId: string, id: string, nama: unknown, sumber: Sumber): Promise<KodeQrTampil> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const r = await ambil(tx, k, id);
    const n = periksaNama(nama, k);
    const [b] = await tx.update(schema.kodeQr).set({ nama: n }).where(eq(schema.kodeQr.id, r.id)).returning();
    await catatAudit(penggunaId, { sumber, jenis: "alarm", ringkasan: `Kode QR dinamai ulang: ${n}`, detail: { kodeQrId: r.id } }, tx);
    return { id: b.id, nama: b.nama, dibuat: b.dibuat, dipakai: (await alarmPemakai(tx, penggunaId, r.id)).length };
  });
}

/** Hapus kode QR. Ditolak bila masih dipakai alarm (soalnya akan mustahil dijawab). */
export async function hapusKodeQr(penggunaId: string, id: string, sumber: Sumber): Promise<void> {
  await denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const r = await ambil(tx, k, id);
    const pakai = await alarmPemakai(tx, penggunaId, r.id);
    if (pakai.length) throw new GalatLayanan("masukan", isi(k.t.kodeQr.dipakai, { judul: pakai[0].judul }));
    await tx.delete(schema.kodeQr).where(eq(schema.kodeQr.id, r.id));
    await catatAudit(penggunaId, { sumber, jenis: "alarm", ringkasan: `Kode QR dihapus: ${r.nama}`, detail: { kodeQrId: r.id } }, tx);
  });
}

/** Gambar SVG kode QR untuk halaman cetak. Isinya tidak pernah dicatat. */
export async function gambarKodeQr(penggunaId: string, id: string): Promise<{ nama: string; svg: string }> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const r = await ambil(tx, k, id);
    const isiQr = bukaRahasia(r.isiTersandi, aad(penggunaId));
    const svg = await QRCode.toString(isiQr, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000", light: "#ffffff" } });
    return { nama: r.nama, svg };
  });
}

/** Semua id kode QR ada dan milik pengguna ini (dipakai layanan alarm saat menyimpan soal). */
export async function pastikanKodeQrMilik(tx: Tx, k: KonteksPengguna, ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  const ada = await tx
    .select({ id: schema.kodeQr.id })
    .from(schema.kodeQr)
    .where(and(eq(schema.kodeQr.penggunaId, k.id), inArray(schema.kodeQr.id, [...ids])));
  if (ada.length !== new Set(ids).size) throw new GalatLayanan("masukan", isi(k.t.galat.masukan, { isian: k.t.galat.isian.kode_qr_tidak_ada }));
}

/** Nama tempat kode-kode QR (ditampilkan di layar alarm: "Pindai kode di kamar mandi"). */
export async function namaTempatQr(tx: Tx, penggunaId: string, ids: readonly string[]): Promise<string[]> {
  if (!ids.length) return [];
  const r = await tx
    .select({ nama: schema.kodeQr.nama })
    .from(schema.kodeQr)
    .where(and(eq(schema.kodeQr.penggunaId, penggunaId), inArray(schema.kodeQr.id, [...ids])));
  return r.map((x) => x.nama);
}

/** Apakah isi pindaian cocok dengan salah satu kode yang diterima soal ini. */
export async function pindaianCocok(tx: Tx, penggunaId: string, ids: readonly string[], isiPindai: string): Promise<boolean> {
  if (!ids.length || !isiPindai.trim().startsWith(AWALAN)) return false;
  const [r] = await tx
    .select({ id: schema.kodeQr.id })
    .from(schema.kodeQr)
    .where(and(eq(schema.kodeQr.penggunaId, penggunaId), inArray(schema.kodeQr.id, [...ids]), eq(schema.kodeQr.isiHash, hashIsiQr(isiPindai))));
  return !!r;
}
