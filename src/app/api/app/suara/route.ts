import { NextResponse } from "next/server";
import { dariGalat, galat } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { pilihanSuara } from "@/lib/layanan/suara";

export const dynamic = "force-dynamic";

/** Pilihan suara dari AgentBuff pengguna (PRD F5). */
export async function GET() {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    return NextResponse.json(await pilihanSuara(s.pengguna.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
