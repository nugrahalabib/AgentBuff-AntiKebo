import { NextResponse } from "next/server";
import { bacaJson, dariGalat, galat, ipKlien, lolosLaju } from "@/lib/api";
import { ambilTokenSambung } from "@/lib/layanan/perangkat";

// Aplikasi PC menanti persetujuan (polling 2 dtk). Token perangkat diantar SEKALI, hanya kepada
// pemegang rahasia tunggu yang dibuat bersama kodenya.
export async function POST(req: Request) {
  if (!lolosLaju(`ambil:${ipKlien(req)}`, 120)) return galat(429, "terlalu_sering", "Terlalu sering. Tunggu sebentar.");
  try {
    const h = await ambilTokenSambung(await bacaJson(req, 2_048));
    return NextResponse.json(h, { status: h.status === "kedaluwarsa" ? 410 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
