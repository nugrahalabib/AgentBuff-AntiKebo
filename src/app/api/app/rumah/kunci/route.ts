import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { putuskan, simpanKunci } from "@/lib/layanan/tuya";

/** Simpan/perbarui kunci rumah (PRD I1). Diuji ke Tuya dulu; tidak pernah dikembalikan ke peramban. */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const b = await bacaJson<{ kunci?: unknown }>(req, 1_024);
    return NextResponse.json(await simpanKunci(k.pengguna.id, b?.kunci, "web"), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}

/** Putuskan rumah: kunci dan daftar perangkat dihapus dari server. */
export async function DELETE(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    await putuskan(k.pengguna.id, "web");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
