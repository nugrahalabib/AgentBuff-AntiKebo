import { NextResponse } from "next/server";
import { cekHak } from "@/lib/agentbuff/status";
import { tautanPerpanjang } from "@/lib/agentbuff/tautan-beku";
import { sesiSaatIni, type Pengguna, type Sesi } from "@/lib/auth/sesi";
import { env } from "@/lib/env";
import { kamusServer } from "@/lib/i18n/server";
import { PembatasLaju } from "@/lib/keamanan/laju";
import { GalatLayanan, type KodeGalat } from "@/lib/layanan/dasar";
import { log } from "@/lib/log";

// Pembantu rute API aplikasi: galat {galat, pesan} + kode HTTP tepat, CSRF
// lewat Origin/Sec-Fetch-Site untuk mutasi, batas laju 300/menit/pengguna.

export function galat(status: number, galatKode: string, pesan: string, tambahan: Record<string, unknown> = {}) {
  return NextResponse.json({ galat: galatKode, pesan, ...tambahan }, { status, headers: { "Cache-Control": "no-store" } });
}

export function asalSama(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) return origin === env("APP_ORIGIN");
  return req.headers.get("sec-fetch-site") === "same-origin";
}

const laju = new PembatasLaju();
export function lolosLaju(kunci: string, batas = 300, ms = 60_000): boolean {
  return laju.tunggu(kunci, batas, ms) === 0;
}

type Konteks = { sesi: Sesi; pengguna: Pengguna };

/** Sesi untuk rute baca (GET): sesi sah + batas laju baca 600/menit/pengguna (arsitektur §11). */
export async function sesiBaca(): Promise<Konteks | NextResponse> {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  if (!lolosLaju(`b:${s.pengguna.id}`, 600)) return galat(429, "terlalu_sering", "Terlalu banyak permintaan. Coba lagi sebentar lagi.");
  return s;
}

/**
 * Pastikan permintaan mutasi: asal sama + sesi sah + dalam batas laju + hak AgentBuff aktif (K-07:
 * saat beku, mengubah dikunci). `bolehBeku` hanya untuk aksi privasi dan keamanan yang tetap hak
 * pengguna walau beku: hapus semua data, cabut token agen, putuskan perangkat, notifikasi.
 */
export async function mutasiPengguna(req: Request, opsi: { bolehBeku?: boolean } = {}): Promise<Konteks | NextResponse> {
  if (!asalSama(req)) return galat(403, "asal_ditolak", "Permintaan ditolak.");
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  if (!lolosLaju(`u:${s.pengguna.id}`)) return galat(429, "terlalu_sering", "Terlalu banyak permintaan. Coba lagi sebentar lagi.");
  if (!opsi.bolehBeku) {
    const hak = await cekHak({ id: s.pengguna.id, agentbuffSub: s.pengguna.agentbuffSub });
    if (!hak.aktif) {
      const { t } = await kamusServer();
      return galat(403, "akses_beku", t.beku.ubahDitolak, {
        alasan: hak.alasan,
        perpanjang: tautanPerpanjang(hak.alasan, env("AGENTBUFF_ORIGIN"), env("AGENTBUFF_PRODUCT_KEY")),
      });
    }
  }
  return s;
}

export async function bacaJson<T>(req: Request, batasByte = 16_384): Promise<T | null> {
  const teks = await req.text();
  if (teks.length > batasByte) return null;
  try {
    return JSON.parse(teks) as T;
  } catch {
    return null;
  }
}

/** IP klien di balik NPM (X-Real-IP), hanya untuk batas laju. */
export function ipKlien(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
}

const STATUS_GALAT: Record<KodeGalat, number> = {
  tidak_ditemukan: 404,
  masukan: 400,
  batas_laju: 429,
  perlu_izin: 403,
  perlu_perangkat: 409,
  komitmen_terkunci: 409,
  sedang_berbunyi: 409,
  kanal_gagal: 409,
  belum_tersambung: 409,
  kunci_bermasalah: 409,
  kunci_tidak_sah: 400,
  offline: 409,
  tidak_didukung: 400,
  tuya_gangguan: 503,
};

/** Galat layanan jadi jawaban {galat, pesan} dengan kode HTTP tepat; galat lain dicatat dan disamarkan. */
export function dariGalat(e: unknown): NextResponse {
  if (e instanceof GalatLayanan) return galat(STATUS_GALAT[e.kode], e.kode, e.message, e.tambahan);
  log.error({ err: (e as Error)?.message }, "galat tak terduga di rute API");
  return galat(500, "galat", "Ada yang tidak beres. Coba lagi sebentar lagi.");
}

/** Bearer token dari header Authorization, atau null. */
export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7).trim() : null;
}
