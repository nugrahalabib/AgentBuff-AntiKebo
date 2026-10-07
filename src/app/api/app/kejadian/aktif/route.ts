import { NextResponse } from "next/server";
import { dariGalat, sesiBaca } from "@/lib/api";
import { kejadianAktif } from "@/lib/layanan/kejadian";

export const dynamic = "force-dynamic";

/** Kejadian yang sedang berbunyi, ditunda, atau menunggu "Masih bangun?" (urut jadwal, PRD B8). */
export async function GET() {
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json({ kejadian: await kejadianAktif(s.pengguna.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
