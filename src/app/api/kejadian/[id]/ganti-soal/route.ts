import { NextResponse } from "next/server";
import { dariGalat } from "@/lib/api";
import { gantiSoalKamera } from "@/lib/layanan/jawab";
import { penjawabDari } from "@/lib/penjawab";

/** Kamera ditolak: Misi QR diganti hitungan Berat 3 soal (PRD D6). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = await penjawabDari(req, id, true);
  if (p instanceof NextResponse) return p;
  try {
    return NextResponse.json({ soal: await gantiSoalKamera(p, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
