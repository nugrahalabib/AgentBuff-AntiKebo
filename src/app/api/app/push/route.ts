import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { daftarkanPush, lepasPush } from "@/lib/layanan/kanal";

/** Nyalakan notifikasi alarm di peramban ini: simpan langganan Web Push (PRD G5). */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req, { bolehBeku: true });
  if (k instanceof NextResponse) return k;
  try {
    return NextResponse.json(await daftarkanPush(k.pengguna.id, await bacaJson(req, 4_096), "web"), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}

/** Matikan notifikasi di peramban ini (juga dipanggil saat keluar). */
export async function DELETE(req: Request) {
  const k = await mutasiPengguna(req, { bolehBeku: true });
  if (k instanceof NextResponse) return k;
  try {
    return NextResponse.json(await lepasPush(k.pengguna.id, await bacaJson(req, 2_048), "web"), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
