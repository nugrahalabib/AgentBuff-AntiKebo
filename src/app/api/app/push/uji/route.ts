import { NextResponse } from "next/server";
import { dariGalat, mutasiPengguna } from "@/lib/api";
import { ujiPush } from "@/lib/layanan/kanal";

/** Kirim notifikasi uji ke semua peramban pengguna. */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    return NextResponse.json(await ujiPush(k.pengguna.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
