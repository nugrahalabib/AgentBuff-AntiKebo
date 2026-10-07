import { NextResponse } from "next/server";
import { dariGalat } from "@/lib/api";
import { konfirmasiMasihBangun } from "@/lib/layanan/jawab";
import { penjawabDari } from "@/lib/penjawab";

/** Ketuk "Masih!" (PRD E2). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = await penjawabDari(req, id, true);
  if (p instanceof NextResponse) return p;
  try {
    return NextResponse.json(await konfirmasiMasihBangun(p, id));
  } catch (e) {
    return dariGalat(e);
  }
}
