import { NextResponse } from "next/server";
import { dariGalat, sesiBaca } from "@/lib/api";
import { statusRumah } from "@/lib/layanan/tuya";

export const dynamic = "force-dynamic";

/** Status rumah pintar (PRD I1, I5): tersambung, bermasalah, wilayah, jumlah perangkat. Kunci tidak pernah dikirim. */
export async function GET() {
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json(await statusRumah(s.pengguna.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
