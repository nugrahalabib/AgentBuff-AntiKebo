import { NextResponse } from "next/server";
import { bacaJson, dariGalat, galat, mutasiPengguna } from "@/lib/api";
import { aturAktifAlarm } from "@/lib/layanan/alarm";

/** Nyalakan/matikan alarm (sakelar di Beranda). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  const isi = await bacaJson<{ aktif?: unknown }>(req, 256);
  if (typeof isi?.aktif !== "boolean") return galat(400, "masukan", "Isian aktif tidak sah.");
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ alarm: await aturAktifAlarm(k.pengguna.id, id, isi.aktif, "web") });
  } catch (e) {
    return dariGalat(e);
  }
}
