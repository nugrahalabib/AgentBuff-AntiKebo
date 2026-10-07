import { NextResponse } from "next/server";
import { dariGalat, sesiBaca } from "@/lib/api";
import { kirimanKejadian } from "@/lib/layanan/kanal";

export const dynamic = "force-dynamic";

/** Jejak pesan kanal satu kejadian (PRD G6): terkirim, gagal + alasan, ditunda. Tanpa isi pesan. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ kiriman: await kirimanKejadian(s.pengguna.id, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
