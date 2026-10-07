"use client";

import { Camera, CameraOff } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PapanAngka } from "@/components/ui/papan-angka";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { bacaQrVideo } from "@/lib/soal/pindai";

/** Soal dari server untuk layar alarm (tanpa jawaban). */
export type SoalLayar = {
  id: string;
  tujuan: "bangun" | "tunda";
  jenis: "hitungan" | "ingat" | "ketik" | "qr";
  tingkat: "ringan" | "sedang" | "berat";
  tampil: { teks: string; sembunyiSetelahMs?: number; tempat?: string[] };
  target: number;
  benarBeruntun: number;
  tahap: number;
  jumlahTahap: number;
};

export type Umpan = { teks: string; nada: "benar" | "salah" } | null;

/**
 * Kartu soal layar alarm (PRD D1 sampai D6). Satu kartu per jenis; jawaban dikirim ke server
 * (`kirim`), kartu hanya menampilkan umpan balik. `getar` naik setiap jawaban salah supaya kartu
 * bergetar sekali.
 */
export function KartuSoal({
  soal,
  kirim,
  gantiKamera,
  umpan,
  getar,
  proses,
  judul,
}: {
  soal: SoalLayar;
  kirim: (jawaban: string) => void;
  gantiKamera: () => void;
  umpan: Umpan;
  getar: number;
  proses: boolean;
  /** Keterangan di atas soal (mis. "Soal tunda"). */
  judul?: string;
}) {
  if (soal.jenis === "qr") return <KartuKamera key={soal.id} tempat={soal.tampil.tempat ?? []} kirim={kirim} ganti={gantiKamera} umpan={umpan} proses={proses} />;
  return (
    <Bingkai getar={getar} label={judul}>
      {soal.jenis === "ketik" ? (
        <IsiKetik key={soal.id} soal={soal} kirim={kirim} umpan={umpan} proses={proses} />
      ) : (
        <IsiAngka key={soal.id} soal={soal} kirim={kirim} umpan={umpan} proses={proses} />
      )}
    </Bingkai>
  );
}

function Bingkai({ getar, label, children }: { getar: number; label?: string; children: ReactNode }) {
  const { t } = useKamus();
  return (
    <section key={getar} aria-label={label ?? t.bunyi.jawaban} className={cn("kaca-gelap rounded-[32px] p-5 sm:p-6", getar > 0 && "getar")}>
      {label ? <p className="mb-2 text-center text-[14px] font-semibold text-white/75">{label}</p> : null}
      {children}
    </section>
  );
}

function Titik({ soal }: { soal: SoalLayar }) {
  const { t } = useKamus();
  if (soal.target <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-2" aria-label={`${t.bunyi.beruntun}: ${soal.benarBeruntun}/${soal.target}`} role="img">
      {Array.from({ length: soal.target }, (_, i) => (
        <span key={i} className={cn("size-3 rounded-full", i < soal.benarBeruntun ? "bg-white" : "bg-white/25")} />
      ))}
    </div>
  );
}

function Pesan({ umpan }: { umpan: Umpan }) {
  return (
    <p aria-live="assertive" className={cn("mt-2 min-h-6 text-center text-[15px] font-semibold", umpan?.nada === "salah" ? "text-amber-200" : "text-emerald-200")}>
      {umpan?.teks ?? ""}
    </p>
  );
}

/** Hitungan dan ingat angka: papan angka besar milik AntiKebo. Ingat angka disembunyikan sesudah 3 detik. */
function IsiAngka({ soal, kirim, umpan, proses }: { soal: SoalLayar; kirim: (j: string) => void; umpan: Umpan; proses: boolean }) {
  const { t } = useKamus();
  const T = t.bunyi;
  const ingat = soal.jenis === "ingat";
  const maks = ingat ? 8 : 4;
  const [jawaban, setJawaban] = useState("");
  const [tersembunyi, setTersembunyi] = useState(false);
  useEffect(() => {
    if (!ingat) return;
    const h = setTimeout(() => setTersembunyi(true), soal.tampil.sembunyiSetelahMs ?? 3_000);
    return () => clearTimeout(h);
  }, [ingat, soal.tampil.sembunyiSetelahMs]);
  const kirimJawaban = () => {
    if (!jawaban || proses) return;
    kirim(jawaban);
    setJawaban("");
  };
  return (
    <div
      onKeyDown={(e) => {
        if (/^\d$/.test(e.key)) setJawaban((j) => (j + e.key).slice(0, maks));
        else if (e.key === "Backspace") setJawaban((j) => j.slice(0, -1));
        else if (e.key === "Enter") kirimJawaban();
      }}
    >
      {ingat ? (
        <>
          <p className="text-center text-[15px] font-semibold text-white/75">{tersembunyi ? T.ingatKetik : T.ingatLihat}</p>
          <p className="t-jam mt-1 text-center text-[44px] tracking-[0.12em] sm:text-[52px]" aria-live="polite">
            {tersembunyi ? "• ".repeat(soal.tampil.teks.length).trim() : soal.tampil.teks}
          </p>
        </>
      ) : (
        <p className="t-jam text-center text-[44px] sm:text-[52px]">{soal.tampil.teks} = ?</p>
      )}
      <output aria-label={T.jawaban} className="t-jam mx-auto mt-3 flex h-[68px] max-w-[280px] items-center justify-center rounded-[20px] bg-black/30 text-[40px]">
        {jawaban || <span className="text-white/35">?</span>}
      </output>
      <Titik soal={soal} />
      <Pesan umpan={umpan} />
      <div className="mt-3">
        <PapanAngka
          ubah={(a) => setJawaban((j) => (j + a).slice(0, maks))}
          hapus={() => setJawaban((j) => j.slice(0, -1))}
          kirim={kirimJawaban}
          labelHapus={T.hapus}
          labelKirim={T.kirim}
          bisaKirim={jawaban.length > 0 && (!ingat || tersembunyi)}
          nonaktif={proses}
        />
      </div>
    </div>
  );
}

/** Ketik kalimat: salin persis (huruf besar/kecil dan spasi ganda diabaikan server). */
function IsiKetik({ soal, kirim, umpan, proses }: { soal: SoalLayar; kirim: (j: string) => void; umpan: Umpan; proses: boolean }) {
  const { t } = useKamus();
  const T = t.bunyi;
  const [jawaban, setJawaban] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!jawaban.trim() || proses) return;
        kirim(jawaban);
        setJawaban("");
      }}
    >
      <p className="text-center text-[15px] font-semibold text-white/75">{T.ketikJudul}</p>
      <p className="mt-2 text-center font-[family-name:var(--font-tampil)] text-[26px] leading-tight font-bold select-none sm:text-[30px]">{soal.tampil.teks}</p>
      <input
        value={jawaban}
        onChange={(e) => setJawaban(e.target.value)}
        aria-label={T.jawaban}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={proses}
        onPaste={(e) => e.preventDefault()}
        className="mt-4 h-14 w-full rounded-[18px] bg-black/30 px-4 text-[18px] text-white outline-none placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-white/60"
        placeholder={T.ketikPlaceholder}
      />
      <Titik soal={soal} />
      <Pesan umpan={umpan} />
      <button
        type="submit"
        disabled={proses || !jawaban.trim()}
        className="tekan mt-2 h-14 w-full rounded-[20px] bg-white text-[18px] font-semibold text-[#140403] disabled:opacity-40"
      >
        {T.kirim}
      </button>
    </form>
  );
}

/** Misi QR: kamera belakang + bingkai; kode terbaca dikirim ke server. Kamera ditolak = tombol ganti soal. */
function KartuKamera({ tempat, kirim, ganti, umpan, proses }: { tempat: string[]; kirim: (j: string) => void; ganti: () => void; umpan: Umpan; proses: boolean }) {
  const { t } = useKamus();
  const T = t.bunyi;
  const video = useRef<HTMLVideoElement>(null);
  const kanvas = useRef<HTMLCanvasElement>(null);
  const [keadaan, setKeadaan] = useState<"mulai" | "jalan" | "ditolak">("mulai");
  const terakhir = useRef<{ isi: string; saat: number } | null>(null);
  const kirimTerbaru = useRef(kirim);
  useEffect(() => {
    kirimTerbaru.current = kirim;
  });
  const sibuk = useRef(proses);
  useEffect(() => {
    sibuk.current = proses;
  }, [proses]);

  useEffect(() => {
    let hidup = true;
    let aliran: MediaStream | null = null;
    let h: ReturnType<typeof setTimeout> | null = null;
    const pindai = async () => {
      if (!hidup) return;
      const v = video.current;
      if (v && kanvas.current && !sibuk.current) {
        const isiQr = await bacaQrVideo(v, kanvas.current).catch(() => null);
        // Kode yang sama tidak dikirim berulang dalam 4 detik (salah = tunggu kode lain).
        if (isiQr && !(terakhir.current && terakhir.current.isi === isiQr && Date.now() - terakhir.current.saat < 4_000)) {
          terakhir.current = { isi: isiQr, saat: Date.now() };
          kirimTerbaru.current(isiQr);
        }
      }
      h = setTimeout(() => void pindai(), 250);
    };
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("tanpa kamera");
        aliran = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!hidup) return aliran.getTracks().forEach((x) => x.stop());
        if (video.current) {
          video.current.srcObject = aliran;
          await video.current.play().catch(() => {});
        }
        setKeadaan("jalan");
        void pindai();
      } catch {
        if (hidup) setKeadaan("ditolak");
      }
    })();
    return () => {
      hidup = false;
      if (h) clearTimeout(h);
      aliran?.getTracks().forEach((x) => x.stop());
    };
  }, []);

  const namaTempat = tempat.join(` ${T.atau} `) || T.tempatBawaan;
  return (
    <section aria-label={isi(T.qrJudulTempat, { tempat: namaTempat })} className="kaca-gelap rounded-[32px] p-5 sm:p-6">
      <div className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-[24px] bg-black/60">
        <video ref={video} playsInline muted className={cn("absolute inset-0 size-full object-cover", keadaan !== "jalan" && "hidden")} />
        <canvas ref={kanvas} className="hidden" />
        {keadaan !== "jalan" ? (
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/35">
            {keadaan === "ditolak" ? <CameraOff size={40} strokeWidth={1.5} /> : <Camera size={40} strokeWidth={1.5} />}
          </span>
        ) : null}
        {[
          "top-6 left-6 border-t-4 border-l-4 rounded-tl-[18px]",
          "top-6 right-6 border-t-4 border-r-4 rounded-tr-[18px]",
          "bottom-6 left-6 border-b-4 border-l-4 rounded-bl-[18px]",
          "bottom-6 right-6 border-r-4 border-b-4 rounded-br-[18px]",
        ].map((k) => (
          <span key={k} aria-hidden className={cn("absolute size-14 border-white", k)} />
        ))}
      </div>
      <h2 className="t-judul-2 mt-5 text-center">{isi(T.qrJudulTempat, { tempat: namaTempat })}</h2>
      <p className="mt-1 text-center text-[15px] text-white/75">{keadaan === "ditolak" ? T.kameraDitolak : T.qrArahkan}</p>
      <Pesan umpan={umpan} />
      <button
        type="button"
        onClick={ganti}
        disabled={proses}
        className={cn(
          "tekan mx-auto mt-2 flex h-12 items-center rounded-full px-5 text-[15px] font-semibold",
          keadaan === "ditolak" ? "bg-white text-[#140403]" : "text-white/85 underline-offset-4 hover:underline",
        )}
      >
        {T.qrGanti}
      </button>
    </section>
  );
}
