import { PauseCircle } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TautanTombol } from "@/components/ui/dasar";
import { cekHak } from "@/lib/agentbuff/status";
import { tautanPerpanjang } from "@/lib/agentbuff/tautan-beku";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/**
 * Gerbang aplikasi: sesi (masuk senyap bila belum), lalu hak AgentBuff. Kerangka (tab/bilah samping)
 * dipasang grup `(utama)`; layar penuh (berbunyi, Masih bangun, Selamat pagi) tanpa kerangka.
 */
export default async function TataLetakApp({ children }: { children: React.ReactNode }) {
  const s = await sesiSaatIni();
  if (!s) {
    const jalur = (await headers()).get("x-antikebo-jalur") ?? "/app";
    redirect(`/auth/agentbuff/start?senyap=1&lanjut=${encodeURIComponent(jalur)}`);
  }
  const [hak, { t }] = await Promise.all([cekHak({ id: s.pengguna.id, agentbuffSub: s.pengguna.agentbuffSub }), kamusServer()]);

  if (!hak.aktif) {
    const url = tautanPerpanjang(hak.alasan, process.env.AGENTBUFF_ORIGIN ?? "https://agentbuff.id", process.env.AGENTBUFF_PRODUCT_KEY ?? "antikebo");
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <div className="muncul kaca-kuat w-full max-w-md rounded-[32px] p-8 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-[20px] bg-waspada-isi/20 text-waspada">
            <PauseCircle size={30} strokeWidth={1.75} />
          </div>
          <h1 className="t-judul-2 mt-5">{t.beku.judul}</h1>
          <p className="t-subjudul mt-2 text-label-2">{t.masuk.alasan[hak.alasan as keyof typeof t.masuk.alasan] ?? t.beku.isi}</p>
          <p className="t-keterangan mt-3 text-label-2">{t.beku.isi}</p>
          <div className="mt-7 flex flex-col gap-2.5">
            {url ? (
              <TautanTombol href={url} ukuran="besar">
                {t.beku.tombol}
              </TautanTombol>
            ) : null}
            <TautanTombol href="/api/hak/periksa" varian="kaca" ukuran="besar">
              {t.beku.periksa}
            </TautanTombol>
          </div>
        </div>
      </main>
    );
  }

  return children;
}
