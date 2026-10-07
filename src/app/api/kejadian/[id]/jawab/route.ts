import { NextResponse } from "next/server";
import { bacaJson, dariGalat, galat } from "@/lib/api";
import { jawab } from "@/lib/layanan/jawab";
import { penjawabDari } from "@/lib/penjawab";

/** Jawab soal alarm (satu-satunya jalan mematikan atau menunda, aturan teknis 2). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = await penjawabDari(req, id, true);
  if (p instanceof NextResponse) return p;
  const isi = await bacaJson<{ soalId?: unknown; jawaban?: unknown }>(req, 2_048);
  if (typeof isi?.soalId !== "string" || typeof isi.jawaban !== "string") return galat(400, "masukan", "Jawaban tidak sah.");
  try {
    return NextResponse.json(await jawab(p, id, isi.soalId, isi.jawaban), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
