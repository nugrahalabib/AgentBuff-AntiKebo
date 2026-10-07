import { NextResponse } from "next/server";
import { dariGalat, mutasiPengguna } from "@/lib/api";
import { cabutTokenAgen } from "@/lib/layanan/agen";

/** Cabut token agen: klien yang memakainya langsung mendapat 401. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    await cabutTokenAgen(k.pengguna.id, id, "web");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dariGalat(e);
  }
}
