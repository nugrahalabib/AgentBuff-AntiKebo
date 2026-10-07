import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { ujiAlarm } from "@/lib/layanan/kejadian";

/** Uji alarm: berbunyi 1 menit lagi, versi singkat (PRD B9). */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const isi = await bacaJson<unknown>(req, 1_024);
    return NextResponse.json(await ujiAlarm(k.pengguna.id, isi ?? {}, "web"), { status: 201 });
  } catch (e) {
    return dariGalat(e);
  }
}
