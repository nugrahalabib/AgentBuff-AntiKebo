import { NextResponse } from "next/server";
import { dariGalat, mutasiPengguna } from "@/lib/api";
import { gandakanAlarm } from "@/lib/layanan/alarm";

/** Gandakan alarm: salinan nonaktif tanpa Komitmen (K-36). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ alarm: await gandakanAlarm(k.pengguna.id, id, "web") }, { status: 201 });
  } catch (e) {
    return dariGalat(e);
  }
}
