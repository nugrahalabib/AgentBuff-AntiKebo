import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { cabutPerangkat, ubahNamaPerangkat } from "@/lib/layanan/perangkat";

/** Ganti nama perangkat siaga. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const { id } = await ctx.params;
    const isi = await bacaJson<{ nama?: unknown }>(req, 1_024);
    return NextResponse.json({ perangkat: await ubahNamaPerangkat(k.pengguna.id, id, isi?.nama, "web") });
  } catch (e) {
    return dariGalat(e);
  }
}

/** Putuskan perangkat (PRD H4): token tidak berlaku, aliran SSE-nya ditutup. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const { id } = await ctx.params;
    await cabutPerangkat(k.pengguna.id, id, "web");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dariGalat(e);
  }
}
