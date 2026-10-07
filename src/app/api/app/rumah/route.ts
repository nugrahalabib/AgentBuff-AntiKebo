import { NextResponse } from "next/server";
import { dariGalat, galat } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { statusRumah } from "@/lib/layanan/tuya";

export const dynamic = "force-dynamic";

/** Status rumah pintar (PRD I1, I5): tersambung, bermasalah, wilayah, jumlah perangkat. Kunci tidak pernah dikirim. */
export async function GET() {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    return NextResponse.json(await statusRumah(s.pengguna.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
