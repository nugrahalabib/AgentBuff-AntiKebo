import { NextResponse } from "next/server";
import { bacaJson, dariGalat, galat } from "@/lib/api";
import { selesaiLuring } from "@/lib/layanan/jawab";
import { penjawabDari } from "@/lib/penjawab";

/** Aplikasi PC menyinkronkan jawaban soal yang dikerjakan luring (PRD D8). Hanya token perangkat. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = await penjawabDari(req, id, true);
  if (p instanceof NextResponse) return p;
  if (p.oleh !== "perangkat" || !p.perangkatId) return galat(403, "perlu_perangkat", "Hanya aplikasi PC yang bisa mengirim jawaban luring.");
  const isi = await bacaJson<{ jawaban?: unknown }>(req, 8_192);
  try {
    return NextResponse.json(await selesaiLuring({ penggunaId: p.penggunaId, id: p.perangkatId }, id, isi?.jawaban));
  } catch (e) {
    return dariGalat(e);
  }
}
