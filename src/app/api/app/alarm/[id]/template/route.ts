import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { simpanAlarmSebagaiTemplate } from "@/lib/layanan/template";

/** Simpan alarm ini sebagai template baru (PRD B10). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const isi = await bacaJson<{ nama?: unknown }>(req, 1_024);
    return NextResponse.json({ template: await simpanAlarmSebagaiTemplate(k.pengguna.id, id, isi?.nama, "web") }, { status: 201 });
  } catch (e) {
    return dariGalat(e);
  }
}
