import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { ujiKanal } from "@/lib/layanan/kanal";

/** Kirim satu pesan uji ke kanal pilihan (PRD G7). */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    return NextResponse.json(await ujiKanal(k.pengguna.id, await bacaJson(req, 512), "web"), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
