import { NextResponse } from "next/server";
import { dariGalat, sesiBaca } from "@/lib/api";
import { rincianKejadian } from "@/lib/layanan/riwayat";

export const dynamic = "force-dynamic";

/** Rincian satu kejadian di Riwayat (PRD K1): soal, kiriman kanal, perangkat yang menghentikan. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json({ rincian: await rincianKejadian(s.pengguna.id, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
