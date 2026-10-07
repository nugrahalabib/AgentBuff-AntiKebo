"use client";

import { BatteryCharging, Check, MonitorOff, PlugZap, Volume2, WifiOff } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { PanduanPasang } from "@/components/app/panduan-pasang";
import { Tombol } from "@/components/ui/dasar";
import { Kebo } from "@/components/ui/kebo";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";

/** Jam Meja sebelum mulai (docs/04-DESAIN.md §4.6): tiga baris penjelasan + Mulai siaga + Tes bunyi + panduan pasang. */
export function LayarJamMejaSebelum({ mulai, tesBunyi, galat, panduan = true }: { mulai?: () => void; tesBunyi?: () => void; galat?: string | null; panduan?: boolean }) {
  const { t } = useKamus();
  const J = t.jamMeja;
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="muncul kaca-kuat w-full max-w-[440px] rounded-[34px] px-7 pt-9 pb-7 text-center">
        <Kebo pose="netral" ukuran={96} className="mx-auto" />
        <h1 className="t-judul-1 mt-4">{J.judul}</h1>
        <ol className="mt-6 flex flex-col gap-2.5 text-left">
          {J.langkah.map((l, i) => (
            <li key={l} className="flex items-center gap-3 rounded-[16px] bg-kaca-isi px-4 py-3">
              <span className="t-angka grid size-7 shrink-0 place-items-center rounded-full bg-grafit text-[14px] font-bold text-grafit-label">{i + 1}</span>
              <span className="text-[16px]">{l}</span>
            </li>
          ))}
        </ol>
        {galat ? (
          <p role="alert" className="t-subjudul mt-4 text-bahaya">
            {galat}
          </p>
        ) : null}
        <div className="mt-7 flex flex-col gap-2.5">
          <Tombol ukuran="besar" onClick={mulai}>
            {J.mulai}
          </Tombol>
          <Tombol ukuran="besar" varian="kaca" onClick={tesBunyi}>
            <Volume2 size={18} />
            {J.tesBunyi}
          </Tombol>
        </div>
        {panduan ? <PanduanPasang /> : null}
      </div>
    </main>
  );
}

/**
 * Jam Meja saat siaga: hitam pekat, jam besar redup berwarna hangat (tetap 3:1, teks bantu 4,5:1; K-111), pil siaga, ikon dicas.
 * Ketuk = terang 5 detik. Geser ke atas (atau tombol Keluar saat terang) = keluar, dengan konfirmasi
 * bila alarm tinggal kurang dari 8 jam. Peringatan amber bila tidak dicas, koneksi putus, atau
 * layar tidak bisa ditahan menyala.
 */
export function LayarJamMejaSiaga({
  jam,
  alarm,
  dicas,
  daring,
  layarDitahan = true,
  siap = null,
  perluYakin = false,
  keluar,
}: {
  jam: string;
  alarm: string | null;
  dicas: boolean;
  daring: boolean;
  layarDitahan?: boolean;
  /** Semua bunyi + klip 24 jam ke depan sudah tersimpan (null = belum diketahui). */
  siap?: boolean | null;
  perluYakin?: boolean;
  keluar?: () => void;
}) {
  const { t } = useKamus();
  const J = t.jamMeja;
  const [terang, setTerang] = useState(false);
  const [yakin, setYakin] = useState(false);
  const pewaktu = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awalY = useRef<number | null>(null);
  const nyalakan = () => {
    setTerang(true);
    if (pewaktu.current) clearTimeout(pewaktu.current);
    pewaktu.current = setTimeout(() => setTerang(false), 5000);
  };
  const mintaKeluar = () => (perluYakin ? setYakin(true) : keluar?.());

  const peringatan: { ikon: ReactNode; teks: string } | null = !daring
    ? { ikon: <WifiOff size={20} className="shrink-0 text-amber-300" />, teks: J.putus }
    : !dicas
      ? { ikon: <PlugZap size={20} className="shrink-0 text-amber-300" />, teks: J.tidakDicas }
      : !layarDitahan
        ? { ikon: <MonitorOff size={20} className="shrink-0 text-amber-300" />, teks: J.layarMati }
        : null;

  return (
    <main
      className="relative flex min-h-dvh cursor-pointer touch-none flex-col items-center justify-center bg-black px-6 text-center select-none"
      onClick={nyalakan}
      onPointerDown={(e) => (awalY.current = e.clientY)}
      onPointerUp={(e) => {
        if (awalY.current !== null && awalY.current - e.clientY > 120) mintaKeluar();
        awalY.current = null;
      }}
    >
      <p className={cn("t-jam text-[min(30vw,300px)] text-[#ff9f6b] transition-opacity duration-700", terang ? "opacity-90" : "opacity-50")}>{jam}</p>
      <p
        className={cn(
          "mt-6 flex h-10 items-center gap-2 rounded-full border px-4 text-[16px] font-semibold transition-opacity",
          alarm ? "border-[#5eead4]/35 text-[#5eead4]" : "border-white/20 text-white/60",
          terang ? "opacity-100" : "opacity-85",
        )}
      >
        {alarm ? isi(J.siagaUntuk, { jam: alarm }) : J.tanpaAlarm}
        {alarm ? <Check size={17} strokeWidth={2.6} /> : null}
      </p>
      <div className={cn("mt-4 flex items-center gap-3 text-[14px] text-white/55 transition-opacity", terang ? "opacity-100" : "opacity-85")}>
        {dicas ? (
          <span className="flex items-center gap-1.5">
            <BatteryCharging size={18} strokeWidth={1.75} />
            {J.dicas}
          </span>
        ) : null}
        {siap === false ? <span>{J.menyimpan}</span> : null}
      </div>
      {yakin ? (
        <div
          role="dialog"
          aria-label={J.yakinJudul}
          className="absolute inset-x-4 bottom-[max(24px,env(safe-area-inset-bottom))] mx-auto max-w-[460px] rounded-[24px] bg-[#1b1b22] p-5 text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[17px] font-semibold text-white">{J.yakinJudul}</p>
          <p className="mt-1 text-[15px] text-white/70">{isi(J.yakinIsi, { jam: alarm ?? "" })}</p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setYakin(false)} className="tekan h-12 flex-1 rounded-full bg-white text-[16px] font-semibold text-black">
              {J.tetapSiaga}
            </button>
            <button type="button" onClick={keluar} className="tekan h-12 flex-1 rounded-full bg-white/10 text-[16px] font-semibold text-white">
              {J.keluarYa}
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-4 bottom-[max(24px,env(safe-area-inset-bottom))] mx-auto flex max-w-[460px] flex-col items-center gap-3">
          {terang && keluar ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                mintaKeluar();
              }}
              className="tekan h-11 rounded-full bg-white/10 px-5 text-[15px] font-semibold text-white/80"
            >
              {J.keluarTombol}
            </button>
          ) : null}
          {peringatan ? (
            <div role="status" className="flex w-full items-center gap-3 rounded-[20px] bg-[#3a2500] px-4 py-3 text-left text-[15px] text-amber-100">
              {peringatan.ikon}
              {peringatan.teks}
            </div>
          ) : (
            <p className="text-[13px] text-white/55">{terang ? J.keluar : J.ketuk}</p>
          )}
        </div>
      )}
    </main>
  );
}
