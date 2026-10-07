import { NextResponse } from "next/server";
import { bacaJson, dariGalat, galat, mutasiPengguna } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { buatAlarm, daftarAlarm } from "@/lib/layanan/alarm";

export const dynamic = "force-dynamic";

/** Semua alarm pengguna, lengkap dengan kejadian berikutnya dan status suara (PRD B1, B7). */
export async function GET() {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    return NextResponse.json({ alarm: await daftarAlarm(s.pengguna.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}

/** Buat alarm (PRD B1, B2). Isian kosong memakai template (`?template=`), lalu bawaan pengguna. */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const isi = await bacaJson<unknown>(req, 16_384);
    const template = new URL(req.url).searchParams.get("template") ?? undefined;
    return NextResponse.json({ alarm: await buatAlarm(k.pengguna.id, isi ?? {}, "web", { template }) }, { status: 201 });
  } catch (e) {
    return dariGalat(e);
  }
}
