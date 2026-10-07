import { NextResponse } from "next/server";
import { cekHak } from "@/lib/agentbuff/status";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Periksa hak ulang tanpa singgahan, lalu kembali ke aplikasi. */
export async function GET() {
  const s = await sesiSaatIni();
  if (s) await cekHak({ id: s.pengguna.id, agentbuffSub: s.pengguna.agentbuffSub }, { ketat: true });
  return NextResponse.redirect(new URL(s ? "/app" : "/masuk", env("APP_ORIGIN")), 303);
}
