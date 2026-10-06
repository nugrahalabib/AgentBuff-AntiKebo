import { randomBytes } from "node:crypto";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { barisDari, db, denganPengguna, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import type { Sumber } from "./dasar";

// Foto & klip kamera disalin dari awan Tuya (tautannya hanya hidup beberapa menit)
// ke basis data selama 7 hari, lalu dibuka lewat tautan rahasia
// `/api/foto/<kunci>.<ext>` (32 karakter acak, tanpa sesi). Tautan inilah yang
// dikirim agen ke chat AgentBuff / Telegram dan ke notifikasi otomasi.

export const UMUR_FOTO_HARI = 7;
const MAKS_FOTO = 5 * 1024 * 1024;
const MAKS_VIDEO = 25 * 1024 * 1024;
/** Batas per pemilik supaya otomasi yang sering menembak tidak memenuhi disk. */
const MAKS_PER_PENGGUNA = 300;
export const POLA_NAMA_FOTO = /^([A-Za-z0-9_-]{32})\.(jpg|png|webp|mp4)$/;

export type JenisFoto = "foto" | "video";

export type FotoTersimpan = {
  id: string;
  /** Jalur relatif untuk halaman app sendiri (CSP 'self'). */
  jalur: string;
  /** Alamat lengkap untuk chat agen, Telegram, dan notifikasi. */
  url: string;
  jenis: JenisFoto;
  mime: string;
  perangkat: string;
  deviceId: string;
  sumber: string;
  catatan: string | null;
  dibuat: Date;
  kedaluwarsa: Date;
};

const EKSTENSI: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4" };

/** Jenis berkas dari isinya (bukan header): awan Tuya sering menjawab application/octet-stream. */
export function jenisBerkas(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (dari: number, sampai: number) => String.fromCharCode(...b.subarray(dari, sampai));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (b.length >= 12 && ascii(4, 8) === "ftyp") return "video/mp4";
  return null;
}

/** Server hanya mengambil tautan https publik (bukan alamat lokal/privat) - cegah SSRF. */
export function tautanPublik(u: string): boolean {
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return false;
  }
  // Uji integrasi: server Tuya tiruan berjalan di 127.0.0.1 (http). Hanya saat NODE_ENV=test.
  const basisUji = process.env.NODE_ENV === "test" ? process.env.TUYA_BASIS_UJI : undefined;
  if (basisUji && u.startsWith(`${basisUji}/`)) return true;
  const h = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.startsWith("[")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return false;
  return true;
}

/** Unduh dengan batas ukuran yang ditegakkan SAMBIL membaca (Content-Length bisa bohong/kosong). */
async function unduh(u: string, batas: number): Promise<Buffer | null> {
  if (!tautanPublik(u)) return null;
  const r = await fetch(u, { signal: AbortSignal.timeout(30_000), redirect: "error" }).catch(() => null);
  if (!r?.ok || !r.body) return null;
  const panjang = Number(r.headers.get("content-length") ?? 0);
  if (panjang > batas) return null;
  const potongan: Uint8Array[] = [];
  let total = 0;
  const pembaca = r.body.getReader();
  for (;;) {
    const { done, value } = await pembaca.read();
    if (done) break;
    total += value.byteLength;
    if (total > batas) {
      await pembaca.cancel().catch(() => {});
      return null;
    }
    potongan.push(value);
  }
  return Buffer.concat(potongan);
}

function keTersimpan(r: {
  id: string;
  kunci: string;
  jenis: string;
  mime: string;
  namaPerangkat: string;
  deviceId: string;
  sumber: string;
  catatan: string | null;
  dibuat: Date;
  kedaluwarsa: Date;
}): FotoTersimpan {
  const jalur = `/api/foto/${r.kunci}.${EKSTENSI[r.mime] ?? "jpg"}`;
  return {
    id: r.id,
    jalur,
    url: `${env("APP_ORIGIN").replace(/\/+$/, "")}${jalur}`,
    jenis: r.jenis === "video" ? "video" : "foto",
    mime: r.mime,
    perangkat: r.namaPerangkat,
    deviceId: r.deviceId,
    sumber: r.sumber,
    catatan: r.catatan,
    dibuat: r.dibuat,
    kedaluwarsa: r.kedaluwarsa,
  };
}

const KOLOM = {
  id: schema.fotoKamera.id,
  kunci: schema.fotoKamera.kunci,
  jenis: schema.fotoKamera.jenis,
  mime: schema.fotoKamera.mime,
  namaPerangkat: schema.fotoKamera.namaPerangkat,
  deviceId: schema.fotoKamera.deviceId,
  sumber: schema.fotoKamera.sumber,
  catatan: schema.fotoKamera.catatan,
  dibuat: schema.fotoKamera.dibuat,
  kedaluwarsa: schema.fotoKamera.kedaluwarsa,
};

export type MasukanSimpan = {
  deviceId: string;
  perangkat: string;
  jenis: JenisFoto;
  /** Tautan sementara dari jawaban API Tuya (bukan masukan pengguna). */
  dari: string;
  sumber: Sumber;
  otomasiId?: string | null;
  catatan?: string | null;
};

/**
 * Salin foto/klip dari awan Tuya ke penyimpanan 7 hari. null = tidak bisa disalin
 * (tautan bukan https publik, terlalu besar, atau bukan gambar/video) - pemanggil
 * memakai tautan Tuya apa adanya sebagai cadangan.
 */
export async function simpanTangkapan(penggunaId: string, m: MasukanSimpan): Promise<FotoTersimpan | null> {
  const isi = await unduh(m.dari, m.jenis === "video" ? MAKS_VIDEO : MAKS_FOTO);
  const mime = isi ? jenisBerkas(isi) : null;
  if (!isi || !mime || (m.jenis === "video" ? !mime.startsWith("video/") : !mime.startsWith("image/"))) {
    log.warn({ pengguna: penggunaId, jenis: m.jenis, ukuran: isi?.length ?? 0, mime }, "foto kamera tidak bisa disalin");
    return null;
  }
  const kedaluwarsa = new Date(Date.now() + UMUR_FOTO_HARI * 24 * 60 * 60 * 1000);
  const baris = await denganPengguna(penggunaId, async (tx) => {
    const [b] = await tx
      .insert(schema.fotoKamera)
      .values({
        penggunaId,
        kunci: randomBytes(24).toString("base64url"),
        deviceId: m.deviceId,
        namaPerangkat: m.perangkat.slice(0, 120),
        jenis: m.jenis,
        mime,
        isi,
        ukuran: isi.length,
        sumber: m.sumber,
        otomasiId: m.otomasiId ?? null,
        catatan: m.catatan?.slice(0, 200) ?? null,
        kedaluwarsa,
      })
      .returning(KOLOM);
    // Simpan yang terbaru saja bila melewati batas per pemilik.
    await tx.execute(sql`
      delete from foto_kamera where pengguna_id = ${penggunaId} and id in (
        select id from foto_kamera where pengguna_id = ${penggunaId} order by dibuat desc offset ${MAKS_PER_PENGGUNA}
      )`);
    return b;
  });
  return keTersimpan(baris);
}

/** Foto/klip terbaru milik pemilik (tanpa isi berkas), terbaru dulu. */
export async function daftarFoto(penggunaId: string, opsi: { deviceId?: string; batas?: number; sumber?: string } = {}): Promise<FotoTersimpan[]> {
  const batas = Math.min(Math.max(Math.round(opsi.batas ?? 10), 1), 50);
  const syarat = [eq(schema.fotoKamera.penggunaId, penggunaId), sql`${schema.fotoKamera.kedaluwarsa} > now()`];
  if (opsi.deviceId) syarat.push(eq(schema.fotoKamera.deviceId, opsi.deviceId));
  if (opsi.sumber) syarat.push(eq(schema.fotoKamera.sumber, opsi.sumber));
  const rows = await denganPengguna(penggunaId, (tx) =>
    tx
      .select(KOLOM)
      .from(schema.fotoKamera)
      .where(and(...syarat))
      .orderBy(desc(schema.fotoKamera.dibuat))
      .limit(batas),
  );
  return rows.map(keTersimpan);
}

/** Isi berkas untuk tautan publik. Hanya baris dengan kunci itu yang terlihat (RLS app.foto_kunci). */
export async function bacaFotoPublik(kunci: string): Promise<{ mime: string; isi: Buffer; dibuat: Date; kedaluwarsa: Date } | null> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(kunci)) return null;
  const rows = await db().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.foto_kunci', ${kunci}, true)`);
    return barisDari<{ mime: string; isi: Uint8Array; dibuat: string | Date; kedaluwarsa: string | Date }>(
      await tx.execute(sql`select mime, isi, dibuat, kedaluwarsa from foto_kamera where kunci = ${kunci} and kedaluwarsa > now() limit 1`),
    );
  });
  const r = rows[0];
  if (!r) return null;
  return { mime: r.mime, isi: Buffer.from(r.isi), dibuat: new Date(r.dibuat), kedaluwarsa: new Date(r.kedaluwarsa) };
}

/** Worker: hapus foto yang sudah lewat 7 hari. */
export async function hapusFotoKedaluwarsa(): Promise<number> {
  const d = await db().delete(schema.fotoKamera).where(lt(schema.fotoKamera.kedaluwarsa, new Date())).returning({ id: schema.fotoKamera.id });
  return d.length;
}

/** Baris markdown yang dirender sebagai gambar/klip oleh chat AgentBuff dan dikirim sebagai foto oleh Telegram. */
export function markdownFoto(f: Pick<FotoTersimpan, "url" | "jenis" | "perangkat">): string {
  return `![${f.jenis === "video" ? "Klip" : "Foto"} ${f.perangkat.replace(/[[\]]/g, "")}](${f.url})`;
}
