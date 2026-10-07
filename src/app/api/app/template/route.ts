import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna, sesiBaca } from "@/lib/api";
import { buatTemplate, daftarTemplate } from "@/lib/layanan/template";

export const dynamic = "force-dynamic";

/** Template alarm (PRD B10): bawaan dulu, lalu buatan pengguna. */
export async function GET() {
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
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
