import { NextResponse } from "next/server";
import { dariGalat, sesiBaca } from "@/lib/api";
import { pilihanSuara } from "@/lib/layanan/suara";

export const dynamic = "force-dynamic";

/** Pilihan suara dari AgentBuff pengguna (PRD F5). */
export async function GET() {
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json(await pilihanSuara(s.pengguna.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
