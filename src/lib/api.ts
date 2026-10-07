import { NextResponse } from "next/server";
import { sesiSaatIni, type Pengguna, type Sesi } from "@/lib/auth/sesi";
import { env } from "@/lib/env";

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

const jendela = new Map<string, { mulai: number; n: number }>();
export function lolosLaju(kunci: string, batas = 300, ms = 60_000): boolean {
  const kini = Date.now();
  const w = jendela.get(kunci);
  if (!w || kini - w.mulai > ms) {
    jendela.set(kunci, { mulai: kini, n: 1 });
    if (jendela.size > 50_000) jendela.clear();
    return true;
  }
  w.n += 1;
  return w.n <= batas;
}

type Konteks = { sesi: Sesi; pengguna: Pengguna };

/** Pastikan permintaan mutasi: asal sama + sesi sah + dalam batas laju. */
export async function mutasiPengguna(req: Request): Promise<Konteks | NextResponse> {
  if (!asalSama(req)) return galat(403, "asal_ditolak", "Permintaan ditolak.");
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  if (!lolosLaju(`u:${s.pengguna.id}`)) return galat(429, "terlalu_sering", "Terlalu banyak permintaan. Coba lagi sebentar lagi.");
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
