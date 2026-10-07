import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { hapusTemplate, ubahTemplate } from "@/lib/layanan/template";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    return NextResponse.json({ template: await ubahTemplate(k.pengguna.id, id, await bacaJson(req), "web") });
  } catch (e) {
    return dariGalat(e);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    await hapusTemplate(k.pengguna.id, id, "web");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dariGalat(e);
  }
}
