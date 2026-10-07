import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { contohSuara } from "@/lib/layanan/suara";

/** Contoh dengar satu suara (PRD F5). Idempoten: panggil lagi untuk menanyakan status; siap = klip bisa diputar. */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const isi = await bacaJson<{ suaraId?: unknown }>(req, 512);
    const h = await contohSuara(k.pengguna.id, isi?.suaraId ?? null);
    return NextResponse.json({ ...h, klip: h.status === "siap" ? `/api/perangkat/klip/${h.hash}` : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
