import { NextResponse } from "next/server";
import { dariGalat, sesiBaca } from "@/lib/api";
import { dataAgen } from "@/lib/layanan/agen";

export const dynamic = "force-dynamic";

/** Halaman Agen: alamat MCP, token aktif (tanpa nilai mentah), aktivitas terbaru. */
export async function GET() {
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json(await dataAgen(s.pengguna.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
