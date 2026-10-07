import { NextResponse } from "next/server";
import { bacaJson, dariGalat, galat, mutasiPengguna } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { buatTemplate, daftarTemplate } from "@/lib/layanan/template";

export const dynamic = "force-dynamic";

/** Template alarm (PRD B10): bawaan dulu, lalu buatan pengguna. */
export async function GET() {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    return NextResponse.json({ template: await daftarTemplate(s.pengguna.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}

export async function POST(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    return NextResponse.json({ template: await buatTemplate(k.pengguna.id, await bacaJson(req), "web") }, { status: 201 });
  } catch (e) {
    return dariGalat(e);
  }
}
