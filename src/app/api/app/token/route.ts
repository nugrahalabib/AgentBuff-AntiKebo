import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { buatTokenManual } from "@/lib/layanan/agen";

export const dynamic = "force-dynamic";

/** Token manual untuk klien MCP lain. Nilainya ditampilkan SEKALI di jawaban ini dan tidak pernah dicatat. */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    return NextResponse.json(await buatTokenManual(k.pengguna.id, await bacaJson(req, 1_024), "web"), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
