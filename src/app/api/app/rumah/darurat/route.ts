import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { aturDarurat } from "@/lib/layanan/tuya";

/** Lapisan darurat tersembunyi (PRD I6): telepon/SMS Tuya ke nomor akun sendiri. */
export async function PATCH(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    return NextResponse.json(await aturDarurat(k.pengguna.id, await bacaJson(req, 512), "web"), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
