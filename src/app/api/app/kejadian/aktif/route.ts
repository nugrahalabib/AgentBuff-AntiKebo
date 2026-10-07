import { NextResponse } from "next/server";
import { dariGalat, galat } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kejadianAktif } from "@/lib/layanan/kejadian";

export const dynamic = "force-dynamic";

/** Kejadian yang sedang berbunyi, ditunda, atau menunggu "Masih bangun?" (urut jadwal, PRD B8). */
export async function GET() {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    return NextResponse.json({ kejadian: await kejadianAktif(s.pengguna.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
