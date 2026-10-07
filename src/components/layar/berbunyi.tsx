"use client";

import { Camera } from "lucide-react";
import { useState } from "react";
import { Kebo } from "@/components/ui/kebo";
import { PapanAngka } from "@/components/ui/papan-angka";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";

export type SoalTampil = { jenis: "hitungan"; teks: string } | { jenis: "qr"; tempat: string };

/**
 * Layar berbunyi (docs/04-DESAIN.md §4.3): penuh layar, selalu gelap, cahaya Bara berdenyut.
 * Judul agenda raksasa, soal langsung tampil dengan papan angka sendiri, tunda hanya bila
 * jatah masih ada. Prototipe: `periksa` lokal; P8 mengirim jawaban ke server (kebenaran di server).
 */
export function LayarBerbunyi({
  jam,
  judul,
  detail,
  soal,
  perluBenar,
  benarBeruntun,
  tunda,
  omelan,
  urutan,
  terlambatMenit,
  periksa,
  mintaTunda,
  gantiSoal,
}: {
  jam: string;
  judul: string;
  detail?: string;
  soal: SoalTampil;
  perluBenar: number;
  benarBeruntun: number;
  tunda: { sisa: number; menit: number } | null;
  omelan?: string;
  urutan?: { ke: number; dari: number };
  terlambatMenit?: number;
  periksa?: (jawaban: string) => Promise<"benar" | "salah" | "selesai">;
  mintaTunda?: () => void;
  gantiSoal?: () => void;
}) {
  const { t } = useKamus();
  const T = t.bunyi;

  return (
    <div className="relative min-h-dvh text-white">
      <div aria-hidden className="latar-bara" />
      <div className="mx-auto grid min-h-dvh max-w-[1100px] grid-cols-[minmax(0,1fr)] content-center gap-8 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))] lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-14 lg:px-10">
        <header className="flex min-w-0 flex-col">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {urutan ? <p className="mb-3 inline-flex rounded-full bg-white/14 px-3 py-1 text-[13px] font-semibold">{isi(T.urutan, urutan)}</p> : null}
              <p className="t-jam text-[64px] text-white/90 sm:text-[80px]">{jam}</p>
            </div>
            <Kebo pose="kaget" ukuran={72} className="shrink-0" />
          </div>
          <h1 className="mt-2 font-[family-name:var(--font-tampil)] text-[clamp(40px,9vw,84px)] leading-[1.02] font-extrabold tracking-[-0.035em] break-words">{judul}</h1>
          {detail ? <p className="mt-3 max-w-[40ch] text-[19px] leading-snug text-white/80">{detail}</p> : null}
          {terlambatMenit ? <p className="mt-3 text-[15px] font-semibold text-amber-200">{isi(T.terlambat, { n: terlambatMenit })}</p> : null}
          {omelan ? (
            <div aria-label={T.omelan} className="mt-6 overflow-hidden rounded-full bg-black/25 py-2" role="marquee">
              <p className="teks-jalan flex w-max gap-12 px-4 text-[15px] font-medium whitespace-nowrap text-white/85">
                <span>{omelan}</span>
                <span aria-hidden>{omelan}</span>
              </p>
            </div>
          ) : null}
        </header>

        {soal.jenis === "hitungan" ? (
          <KartuHitungan soal={soal.teks} perluBenar={perluBenar} benarBeruntun={benarBeruntun} periksa={periksa} />
        ) : (
          <KartuQr tempat={soal.tempat} gantiSoal={gantiSoal} />
        )}

        <div className="lg:col-span-2">
          {tunda && tunda.sisa > 0 ? (
            <button
              type="button"
              onClick={mintaTunda}
              className="tekan mx-auto flex h-12 items-center rounded-full bg-white/12 px-6 text-[16px] font-semibold text-white hover:bg-white/18"
            >
              {isi(T.tunda, { menit: tunda.menit, sisa: tunda.sisa })}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KartuHitungan({
  soal,
  perluBenar,
  benarBeruntun,
  periksa,
}: {
  soal: string;
  perluBenar: number;
  benarBeruntun: number;
  periksa?: (j: string) => Promise<"benar" | "salah" | "selesai">;
}) {
  const { t } = useKamus();
  const T = t.bunyi;
  const [jawaban, setJawaban] = useState("");
  const [pesan, setPesan] = useState<{ teks: string; nada: "benar" | "salah" } | null>(null);
  const [getar, setGetar] = useState(0);
  const [proses, setProses] = useState(false);

  const kirim = async () => {
    if (!jawaban || proses || !periksa) return;
    setProses(true);
    const h = await periksa(jawaban);
    setProses(false);
    setJawaban("");
    if (h === "salah") {
      setGetar((g) => g + 1);
      setPesan({ teks: T.salah, nada: "salah" });
    } else if (h === "benar") setPesan({ teks: T.benar, nada: "benar" });
  };

  return (
    <section
      key={getar}
      aria-label={T.jawaban}
      className={cn("kaca-gelap rounded-[32px] p-5 sm:p-6", getar > 0 && "getar")}
      onKeyDown={(e) => {
        if (/^\d$/.test(e.key)) setJawaban((j) => (j + e.key).slice(0, 4));
        else if (e.key === "Backspace") setJawaban((j) => j.slice(0, -1));
        else if (e.key === "Enter") void kirim();
      }}
    >
      <p className="t-jam text-center text-[44px] sm:text-[52px]">{soal} = ?</p>
      <output aria-label={T.jawaban} className="t-jam mx-auto mt-3 flex h-[68px] max-w-[220px] items-center justify-center rounded-[20px] bg-black/30 text-[44px]">
        {jawaban || <span className="text-white/35">?</span>}
      </output>
      <div className="mt-3 flex items-center justify-center gap-2" aria-label={`${T.beruntun}: ${benarBeruntun}/${perluBenar}`} role="img">
        {Array.from({ length: perluBenar }, (_, i) => (
          <span key={i} className={cn("size-3 rounded-full", i < benarBeruntun ? "bg-white" : "bg-white/25")} />
        ))}
      </div>
      <p aria-live="assertive" className={cn("mt-2 min-h-6 text-center text-[15px] font-semibold", pesan?.nada === "salah" ? "text-amber-200" : "text-emerald-200")}>
        {pesan?.teks ?? ""}
      </p>
      <div className="mt-3">
        <PapanAngka
          ubah={(a) => setJawaban((j) => (j + a).slice(0, 4))}
          hapus={() => setJawaban((j) => j.slice(0, -1))}
          kirim={() => void kirim()}
          labelHapus={T.hapus}
          labelKirim={T.kirim}
          bisaKirim={jawaban.length > 0}
          nonaktif={proses}
        />
      </div>
    </section>
  );
}

function KartuQr({ tempat, gantiSoal }: { tempat: string; gantiSoal?: () => void }) {
  const { t } = useKamus();
  const T = t.bunyi;
  return (
    <section aria-label={T.qrJudul} className="kaca-gelap rounded-[32px] p-5 sm:p-6">
      <div className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-[24px] bg-black/60">
        <Camera aria-hidden size={40} strokeWidth={1.5} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/25" />
        {/* Bingkai pindai */}
        {[
          "top-6 left-6 border-t-4 border-l-4 rounded-tl-[18px]",
          "top-6 right-6 border-t-4 border-r-4 rounded-tr-[18px]",
          "bottom-6 left-6 border-b-4 border-l-4 rounded-bl-[18px]",
          "bottom-6 right-6 border-r-4 border-b-4 rounded-br-[18px]",
        ].map((k) => (
          <span key={k} aria-hidden className={cn("absolute size-14 border-white", k)} />
        ))}
        <span aria-hidden className="denyut absolute inset-x-10 top-1/2 h-0.5 rounded-full bg-[#ff8a00] shadow-[0_0_16px_#ff8a00]" />
      </div>
      <h2 className="t-judul-2 mt-5 text-center">{T.qrJudul}</h2>
      <p className="mt-1 text-center text-[15px] text-white/75">{isi(T.qrKet, { tempat })}</p>
      <button
        type="button"
        onClick={gantiSoal}
        className="tekan mx-auto mt-4 flex h-11 items-center rounded-full px-4 text-[15px] font-semibold text-white/85 underline-offset-4 hover:underline"
      >
        {T.qrGanti}
      </button>
    </section>
  );
}
