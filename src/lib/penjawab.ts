import { NextResponse } from "next/server";
import { asalSama, bearer, galat, lolosLaju } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { idSah } from "@/lib/keamanan/laju";
import type { Penjawab } from "@/lib/layanan/jawab";
import { perangkatDariToken } from "@/lib/layanan/perangkat";

/**
 * Siapa yang menjawab soal alarm (PRD D7): HANYA sesi pemilik (peramban, dengan cek asal untuk
 * mutasi) atau token perangkat siaga miliknya (PC). Tidak ada kunci internal. Setiap rute yang
 * memakai `@/lib/layanan/jawab` wajib lewat sini (dijaga `jaga`, penjaga `jalur-alarm`).
 * Batas laju 30 per menit per kejadian per penjawab (arsitektur §9).
 */
export async function penjawabDari(req: Request, kejadianId: string, mutasi: boolean): Promise<Penjawab | NextResponse> {
  // Id dari jalur diperiksa bentuknya dulu: tidak pernah jadi kunci batas laju atau kueri bila palsu.
  if (!idSah(kejadianId)) return galat(404, "tidak_ditemukan", "Alarm tidak ditemukan.");
  const token = bearer(req);
  let p: Penjawab;
  if (token) {
    const d = await perangkatDariToken(token);
    if (!d) return galat(401, "token_tidak_berlaku", "Perangkat ini sudah diputus. Sambungkan lagi.");
    p = { penggunaId: d.penggunaId, perangkatId: d.id, oleh: "perangkat" };
  } else {
    if (mutasi && !asalSama(req)) return galat(403, "asal_ditolak", "Permintaan ditolak.");
    const s = await sesiSaatIni();
    if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
    p = { penggunaId: s.pengguna.id, perangkatId: null, oleh: "sesi" };
  }
  const pelan = () => galat(429, "terlalu_sering", "Pelan-pelan. Coba lagi sebentar lagi.");
  if (!lolosLaju(`${mutasi ? "jawabU" : "soalU"}:${p.penggunaId}`, mutasi ? 120 : 300)) return pelan();
  if (mutasi && !lolosLaju(`jawab:${kejadianId}:${p.perangkatId ?? p.penggunaId}`, 30)) return pelan();
  return p;
}
