import { NextResponse } from "next/server";
import { dariGalat, mutasiPengguna } from "@/lib/api";
import { ujiPerangkat } from "@/lib/layanan/tuya";

/** Uji perangkat (PRD I2, I4): nyala sebentar lalu kembali; hasil = benar-benar melapor atau belum. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await ujiPerangkat(k.pengguna.id, id.slice(0, 64)), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
