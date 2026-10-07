import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { batalLewati, lewatiBerikutnya, lewatiTanggal } from "@/lib/layanan/alarm";

type Ctx = { params: Promise<{ id: string }> };

/** Lewati sekali (tanpa tanggal = kejadian berikutnya) atau tanggal tertentu (PRD B4). */
export async function POST(req: Request, ctx: Ctx) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const { id } = await ctx.params;
    const isi = await bacaJson<{ tanggal?: unknown }>(req, 256);
    const a = isi?.tanggal === undefined ? await lewatiBerikutnya(k.pengguna.id, id, "web") : await lewatiTanggal(k.pengguna.id, id, isi.tanggal, "web");
    return NextResponse.json({ alarm: a });
  } catch (e) {
    return dariGalat(e);
  }
}

/** Batalkan lewati tanggal (`?tanggal=YYYY-MM-DD`). */
export async function DELETE(req: Request, ctx: Ctx) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ alarm: await batalLewati(k.pengguna.id, id, new URL(req.url).searchParams.get("tanggal"), "web") });
  } catch (e) {
    return dariGalat(e);
  }
}
