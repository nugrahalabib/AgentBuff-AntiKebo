import { NextResponse } from "next/server";
import { bacaJson, dariGalat, galat, mutasiPengguna } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { ambilAlarm, hapusAlarm, ubahAlarm } from "@/lib/layanan/alarm";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ alarm: await ambilAlarm(s.pengguna.id, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}

/** Ubah sebagian isian alarm; ID dan riwayat tetap (PRD B1). Mode Komitmen ditegakkan layanan. */
export async function PATCH(req: Request, ctx: Ctx) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const { id } = await ctx.params;
    const isi = await bacaJson<unknown>(req, 16_384);
    return NextResponse.json({ alarm: await ubahAlarm(k.pengguna.id, id, isi ?? {}, "web") });
  } catch (e) {
    return dariGalat(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const { id } = await ctx.params;
    await hapusAlarm(k.pengguna.id, id, "web");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dariGalat(e);
  }
}
