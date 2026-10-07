import { NextResponse } from "next/server";
import { dariGalat, galat } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kirimanKejadian } from "@/lib/layanan/kanal";

export const dynamic = "force-dynamic";

/** Jejak pesan kanal satu kejadian (PRD G6): terkirim, gagal + alasan, ditunda. Tanpa isi pesan. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ kiriman: await kirimanKejadian(s.pengguna.id, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
