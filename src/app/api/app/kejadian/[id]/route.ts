import { NextResponse } from "next/server";
import { dariGalat, galat } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { layarKejadian } from "@/lib/layanan/kejadian";

export const dynamic = "force-dynamic";

/** Data layar alarm satu kejadian (berbunyi, ditunda, Masih bangun, Selamat pagi). Tanpa jawaban soal. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ kejadian: await layarKejadian(s.pengguna.id, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
