import { NextResponse } from "next/server";
import { dariGalat } from "@/lib/api";
import { ambilSoal } from "@/lib/layanan/jawab";
import { penjawabDari } from "@/lib/penjawab";

export const dynamic = "force-dynamic";

/** Soal yang berlaku di layar alarm (`?tujuan=tunda` untuk soal tunda). Tanpa jawaban. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = await penjawabDari(req, id, false);
  if (p instanceof NextResponse) return p;
  try {
    const tujuan = new URL(req.url).searchParams.get("tujuan") === "tunda" ? "tunda" : "bangun";
    return NextResponse.json({ soal: await ambilSoal(p, id, tujuan) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
