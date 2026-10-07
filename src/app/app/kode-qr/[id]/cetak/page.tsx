import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TautanTombol } from "@/components/ui/dasar";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { isi } from "@/lib/i18n";
import { kamusServer } from "@/lib/i18n/server";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { gambarKodeQr } from "@/lib/layanan/kode-qr";
import { TombolCetak } from "./tombol-cetak";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/** Halaman cetak kode QR Misi QR (PRD D4): kode besar + nama tempat + petunjuk. */
export default async function CetakKodeQr({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await sesiSaatIni();
  if (!s) notFound();
  const { t } = await kamusServer();
  const K = t.kodeQr;
  let kode: { nama: string; svg: string };
  try {
    kode = await gambarKodeQr(s.pengguna.id, id);
  } catch (e) {
    if (e instanceof GalatLayanan) notFound();
    throw e;
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="tanpa-cetak flex items-center justify-between gap-3 pt-2">
        <TautanTombol href="/app" varian="kaca" ukuran="kecil">
          <ArrowLeft size={16} />
          {K.kembali}
        </TautanTombol>
        <TombolCetak label={K.cetak} />
      </div>
      <section className="kaca-kuat cetak-polos mx-auto flex w-full max-w-[520px] flex-col items-center rounded-[30px] px-6 py-9 text-center">
        <h1 className="t-judul-1">{isi(K.judulCetak, { nama: kode.nama })}</h1>
        {/* SVG dibuat server dari pustaka qrcode (bukan masukan pengguna). */}
        <div
          role="img"
          aria-label={isi(K.judulCetak, { nama: kode.nama })}
          className="mt-6 w-full max-w-[360px] rounded-[18px] bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: kode.svg }}
        />
        <p className="t-isi mt-6 max-w-[40ch] text-label-2">{isi(K.petunjuk, { nama: kode.nama })}</p>
      </section>
    </div>
  );
}
