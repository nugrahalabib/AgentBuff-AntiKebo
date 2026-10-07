import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sesiSaatIni } from "@/lib/auth/sesi";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/**
 * Gerbang sesi aplikasi (masuk senyap bila belum). Hak AgentBuff diperiksa `GerbangHak` di kerangka
 * `(utama)` dan perkenalan saja: layar penuh jalur bangun (berbunyi, Masih bangun, Selamat pagi,
 * Jam Meja) tetap terbuka saat akses beku supaya alarm yang berbunyi selalu bisa dihentikan (K-109).
 */
export default async function TataLetakApp({ children }: { children: React.ReactNode }) {
  const s = await sesiSaatIni();
  if (!s) {
    const jalur = (await headers()).get("x-antikebo-jalur") ?? "/app";
    redirect(`/auth/agentbuff/start?senyap=1&lanjut=${encodeURIComponent(jalur)}`);
  }
  return children;
}
