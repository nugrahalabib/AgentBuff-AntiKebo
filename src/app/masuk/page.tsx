import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { tautanPerpanjang } from "@/lib/agentbuff/tautan-beku";
import { TautanTombol } from "@/components/ui/dasar";
import { Logo } from "@/components/ui/ikon";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

type Props = { searchParams: Promise<{ alasan?: string; galat?: string; info?: string }> };

export default async function Masuk({ searchParams }: Props) {
  const [{ t }, s, q] = await Promise.all([kamusServer(), sesiSaatIni(), searchParams]);
  if (s && !q.alasan && !q.galat) redirect("/app");
  const M = t.masuk;
  const pesanAlasan = q.alasan ? (M.alasan[q.alasan as keyof typeof M.alasan] ?? M.alasan.tidak_diketahui) : null;
  const pesanGalat = q.galat ? (M.galat[q.galat as keyof typeof M.galat] ?? M.galat.umum) : null;
  const pesanInfo = q.info === "dihapus" ? M.info.dihapus : null;
  const perbaiki = q.alasan ? tautanPerpanjang(q.alasan, process.env.AGENTBUFF_ORIGIN ?? "https://agentbuff.id", process.env.AGENTBUFF_PRODUCT_KEY ?? "antikebo") : null;

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="muncul kaca-kuat w-full max-w-[420px] rounded-[36px] px-7 pt-10 pb-8 text-center">
        <div className="mx-auto w-fit">
          <Logo ukuran={72} />
        </div>
        <h1 className="t-judul-1 mt-6">{t.merek.nama}</h1>
        <p className="t-subjudul mt-2 text-label-2">{M.sub}</p>

        {pesanInfo && !pesanAlasan && !pesanGalat ? (
          <p role="status" className="mt-6 rounded-[18px] bg-toska-isi/15 px-4 py-3 text-left text-[15px] text-label">
            {pesanInfo}
          </p>
        ) : null}

        {pesanAlasan || pesanGalat ? (
          <div role="alert" data-pesan-galat className="mt-6 rounded-[18px] bg-waspada-isi/15 px-4 py-3 text-left text-[15px] text-label">
            {pesanAlasan ?? pesanGalat}
            {perbaiki && !perbaiki.startsWith("/") ? (
              <a href={perbaiki} className="mt-2 block font-semibold text-aksen">
                {M.perbaiki}
              </a>
            ) : null}
          </div>
        ) : null}

        <TautanTombol href="/auth/agentbuff/start?lanjut=/app" ukuran="besar" className="mt-8 w-full">
          <span className="grid size-6 place-items-center rounded-[7px] bg-grafit-label/15">
            <ShieldCheck size={16} />
          </span>
          {M.tombol}
        </TautanTombol>
        <p className="t-keterangan mt-5 text-label-2">{M.catatan}</p>
      </div>
    </main>
  );
}
