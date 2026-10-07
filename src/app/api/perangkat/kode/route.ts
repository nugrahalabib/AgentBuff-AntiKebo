import { NextResponse } from "next/server";
import { bacaJson, dariGalat, galat, ipKlien, lolosLaju } from "@/lib/api";
import { env } from "@/lib/env";
import { mintaKodeSambung } from "@/lib/layanan/perangkat";

// Aplikasi PC (belum punya akun di sini) meminta kode sambung (docs/09-APLIKASI-PC.md §4).
export async function POST(req: Request) {
  if (!lolosLaju(`kode:${ipKlien(req)}`, 10, 10 * 60_000)) return galat(429, "terlalu_sering", "Terlalu banyak permintaan kode. Coba lagi beberapa menit lagi.");
  try {
    const k = await mintaKodeSambung(await bacaJson(req, 2_048));
    const tautan = new URL(`/sambung-pc?kode=${encodeURIComponent(k.kode)}`, env("APP_ORIGIN")).toString();
    return NextResponse.json({ kode: k.kode, rahasia: k.rahasia, kedaluwarsa: k.kedaluwarsa.toISOString(), tautan }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
