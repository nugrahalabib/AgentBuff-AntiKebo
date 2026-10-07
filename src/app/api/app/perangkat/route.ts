import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna, sesiBaca } from "@/lib/api";
import { daftarkanPerangkatWeb, daftarPerangkat, tampilPerangkat } from "@/lib/layanan/perangkat";

export const dynamic = "force-dynamic";

/** Daftar perangkat siaga (tab Siaga, PRD H1). */
export async function GET() {
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json({ perangkat: await daftarPerangkat(s.pengguna.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}

/** Daftarkan peramban ini sebagai Jam Meja (Mode Jam Meja, PRD H2). */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const isi = await bacaJson<{ nama?: unknown }>(req, 1_024);
    const p = await daftarkanPerangkatWeb(k.pengguna.id, isi?.nama, "web");
    return NextResponse.json({ perangkat: tampilPerangkat(p, new Date()) }, { status: 201 });
  } catch (e) {
    return dariGalat(e);
  }
}
