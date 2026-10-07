import { NextResponse } from "next/server";
import { dariGalat, sesiBaca } from "@/lib/api";
import { layarKejadian } from "@/lib/layanan/kejadian";

export const dynamic = "force-dynamic";

/** Data layar alarm satu kejadian (berbunyi, ditunda, Masih bangun, Selamat pagi). Tanpa jawaban soal. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ kejadian: await layarKejadian(s.pengguna.id, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
