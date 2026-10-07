import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { hapusKodeQr, ubahNamaKodeQr } from "@/lib/layanan/kode-qr";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const { id } = await ctx.params;
    const isi = await bacaJson<{ nama?: unknown }>(req, 1_024);
    return NextResponse.json({ kodeQr: await ubahNamaKodeQr(k.pengguna.id, id, isi?.nama, "web") });
  } catch (e) {
    return dariGalat(e);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const { id } = await ctx.params;
    await hapusKodeQr(k.pengguna.id, id, "web");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dariGalat(e);
  }
}
