"use client";

import { Clock, Hourglass } from "lucide-react";
import { Tombol } from "@/components/ui/dasar";
import { Cincin } from "@/components/ui/cincin";
import { Kebo } from "@/components/ui/kebo";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";

/** Selamat pagi (docs/04-DESAIN.md §4.4): gradasi Fajar, Kebo segar, ringkasan, lalu "Oke". */
export function LayarSelamatPagi({
  nama,
  jamBangun,
  agenda,
  skor,
  tunda,
  menit,
  cekMenit,
  oke,
}: {
  nama: string;
  jamBangun: string;
  agenda: { judul: string; detail?: string } | null;
  skor: number;
  tunda: number;
  menit: number;
  cekMenit: number | null;
  oke?: () => void;
}) {
  const { t } = useKamus();
  const P = t.pagi;
  return (
    <div className="relative min-h-dvh text-fajar-label">
      <div aria-hidden className="latar-fajar" />
      <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center px-5 pt-[max(40px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] text-center">
        <Kebo pose="segar" ukuran={140} className="muncul" />
        <h1 className="t-judul-besar muncul mt-5 [animation-delay:60ms]">{isi(P.judul, { nama })}</h1>
        <p className="t-isi muncul mt-1 text-fajar-label-2 [animation-delay:100ms]">{isi(P.bangun, { jam: jamBangun })}</p>

        {agenda ? (
          <section className="muncul mt-7 w-full rounded-[26px] bg-white/55 p-5 text-left shadow-[0_10px_40px_-20px_rgba(120,50,20,0.5)] [animation-delay:140ms] dark:bg-white/8">
            <h2 className="t-subjudul font-semibold text-fajar-label-2">{P.agendaHariIni}</h2>
            <p className="t-judul-2 mt-1">{agenda.judul}</p>
            {agenda.detail ? <p className="t-subjudul mt-1 text-fajar-label-2">{agenda.detail}</p> : null}
          </section>
        ) : null}

        <section className="muncul mt-3 grid w-full grid-cols-3 gap-3 [animation-delay:180ms]">
          <div className="flex flex-col items-center rounded-[22px] bg-white/55 p-3 dark:bg-white/8">
            <Cincin nilai={skor / 100} ukuran={64} tebal={7} warna="#f97316" jalur="rgba(249,115,22,0.2)" label={`${P.skor} ${skor}`}>
              <span className="t-angka text-[19px] font-bold">{skor}</span>
            </Cincin>
            <span className="t-keterangan mt-1.5 text-fajar-label-2">{P.skor}</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-[22px] bg-white/55 p-3 dark:bg-white/8">
            <Hourglass size={22} strokeWidth={1.75} />
            <span className="t-angka mt-1 text-[22px] font-bold">{tunda}</span>
            <span className="t-keterangan text-fajar-label-2">{P.tunda}</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-[22px] bg-white/55 p-3 dark:bg-white/8">
            <Clock size={22} strokeWidth={1.75} />
            <span className="t-angka mt-1 text-[22px] font-bold">{isi(P.menit, { n: menit })}</span>
            <span className="t-keterangan text-fajar-label-2">{P.lama}</span>
          </div>
        </section>

        {cekMenit ? <p className="t-subjudul mt-5 text-fajar-label-2">{isi(P.cekLagi, { n: cekMenit })}</p> : null}
        <div className="flex-1" />
        <Tombol ukuran="besar" className="mt-8 w-full max-w-[360px]" onClick={oke}>
          {P.oke}
        </Tombol>
      </main>
    </div>
  );
}

/** Masih bangun? (docs/04-DESAIN.md §4.5): gelap, satu tombol sangat besar di dalam cincin hitung mundur. */
export function LayarMasihBangun({ sisaDetik, totalDetik, konfirmasi }: { sisaDetik: number; totalDetik: number; konfirmasi?: () => void }) {
  const { t } = useKamus();
  const C = t.cek;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#07070a] px-6 text-center text-white">
      <h1 className="t-judul-1">{C.judul}</h1>
      <div className="mt-10">
        <Cincin nilai={sisaDetik / totalDetik} ukuran={300} tebal={14} warna="#fbbf24" jalur="rgba(255,255,255,0.12)">
          <button
            type="button"
            onClick={konfirmasi}
            className="tekan grid size-[236px] place-items-center rounded-full bg-white text-[#07070a] shadow-[0_0_60px_-10px_rgba(251,191,36,0.6)]"
          >
            <span className="font-[family-name:var(--font-tampil)] text-[56px] font-extrabold tracking-[-0.03em]">{C.tombol}</span>
          </button>
        </Cincin>
      </div>
      <p className="t-angka mt-8 text-[20px] font-semibold text-amber-200" aria-live="polite">
        {isi(C.sisa, { n: sisaDetik })}
      </p>
      <p className="t-subjudul mt-1 text-white/70">{C.ket}</p>
    </main>
  );
}
