import { Monitor, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TautanTombol } from "@/components/ui/dasar";
import { Kebo } from "@/components/ui/kebo";
import { cekHak } from "@/lib/agentbuff/status";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";
import { lihatKodeSambung, rapikanKode } from "@/lib/layanan/perangkat";
import { KonfirmasiSambung } from "./konfirmasi";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

type Props = { searchParams: Promise<{ kode?: string }> };

/**
 * "Sambungkan PC ini?" (docs/09-APLIKASI-PC.md §4, PRD H4). Dibuka aplikasi PC di peramban
 * pengguna; bila belum masuk, masuk senyap dulu lalu kembali ke sini dengan kode yang sama.
 */
export default async function SambungPc({ searchParams }: Props) {
  const { kode: kodeMentah } = await searchParams;
  const kode = kodeMentah ? rapikanKode(kodeMentah) : null;
  const s = await sesiSaatIni();
  if (!s) redirect(`/auth/agentbuff/start?senyap=1&lanjut=${encodeURIComponent(`/sambung-pc${kode ? `?kode=${kode}` : ""}`)}`);
  const [{ t }, hak] = await Promise.all([kamusServer(), cekHak({ id: s.pengguna.id, agentbuffSub: s.pengguna.agentbuffSub })]);
  const S = t.sambung;
  const info = kode && hak.aktif ? await lihatKodeSambung(kode) : null;
  const sah = !!info && (info.status === "menunggu" || info.status === "disetujui" || info.status === "diambil");

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="muncul kaca-kuat w-full max-w-[440px] rounded-[34px] px-7 pt-9 pb-7 text-center">
        <Kebo pose={sah ? "netral" : "kaget"} ukuran={88} className="mx-auto" />
        {!hak.aktif ? (
          <>
            <h1 className="t-judul-2 mt-4">{t.beku.judul}</h1>
            <p className="t-subjudul mt-2 text-label-2">{t.beku.isi}</p>
            <TautanTombol href="/app" ukuran="besar" className="mt-7 w-full">
              {t.navigasi.alarm}
            </TautanTombol>
          </>
        ) : !kode || !info || !sah ? (
          <>
            <h1 className="t-judul-2 mt-4">{S.judul}</h1>
            <p role="alert" className="t-subjudul mt-3 text-label-2">
              {kode ? S.kodeHabis : S.tanpaKode}
            </p>
            <TautanTombol href="/app" varian="kaca" ukuran="besar" className="mt-7 w-full">
              {S.keSiaga}
            </TautanTombol>
          </>
        ) : (
          <>
            <h1 className="t-judul-1 mt-4">{S.judul}</h1>
            <p className="t-subjudul mt-2 text-label-2">{S.sub}</p>
            <dl className="mt-6 flex flex-col gap-2.5 text-left">
              <div className="flex items-center gap-3 rounded-[18px] bg-kaca-isi px-4 py-3">
                <Monitor size={22} strokeWidth={1.75} className="shrink-0 text-label-2" />
                <dt className="sr-only">{S.perangkat}</dt>
                <dd className="t-kepala min-w-0 truncate">{info.namaPerangkat}</dd>
              </div>
              <div className="rounded-[18px] bg-kaca-isi px-4 py-3 text-center">
                <dt className="t-keterangan text-label-2">{S.kode}</dt>
                <dd className="t-angka mt-0.5 text-[30px] font-bold tracking-[0.12em]">{kode}</dd>
              </div>
            </dl>
            <p className="mt-4 flex items-start gap-2 text-left text-[14px] text-label-2">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-waspada" />
              {S.peringatan}
            </p>
            <KonfirmasiSambung kode={kode} sudah={info.status !== "menunggu"} />
          </>
        )}
      </div>
    </main>
  );
}
