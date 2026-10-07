import { NextResponse } from "next/server";
import { dariGalat, galat } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { rincianKejadian } from "@/lib/layanan/riwayat";

export const dynamic = "force-dynamic";

/** Rincian satu kejadian di Riwayat (PRD K1): soal, kiriman kanal, perangkat yang menghentikan. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    return NextResponse.json({ rincian: await rincianKejadian(s.pengguna.id, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
