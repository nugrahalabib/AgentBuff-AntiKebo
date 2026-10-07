"use client";

import { BatteryCharging, Check, PlugZap, Volume2, WifiOff } from "lucide-react";
import { useState } from "react";
import { Tombol } from "@/components/ui/dasar";
import { Kebo } from "@/components/ui/kebo";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";

/** Jam Meja sebelum mulai (docs/04-DESAIN.md §4.6): tiga baris penjelasan + Mulai siaga + Tes bunyi. */
export function LayarJamMejaSebelum({ mulai, tesBunyi }: { mulai?: () => void; tesBunyi?: () => void }) {
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
        <div className="mt-7 flex flex-col gap-2.5">
          <Tombol ukuran="besar" onClick={mulai}>
            {J.mulai}
          </Tombol>
          <Tombol ukuran="besar" varian="kaca" onClick={tesBunyi}>
            <Volume2 size={18} />
            {J.tesBunyi}
          </Tombol>
        </div>
      </div>
    </main>
  );
}

/**
 * Jam Meja saat siaga: hitam pekat, jam besar sangat redup berwarna hangat, pil siaga, ikon dicas.
 * Ketuk = terang 5 detik. Peringatan amber bila tidak dicas atau koneksi putus.
 */
export function LayarJamMejaSiaga({ jam, alarm, dicas, daring }: { jam: string; alarm: string; dicas: boolean; daring: boolean }) {
  const { t } = useKamus();
  const J = t.jamMeja;
  const [terang, setTerang] = useState(false);
  return (
    <main
      className="relative flex min-h-dvh cursor-pointer flex-col items-center justify-center bg-black px-6 text-center select-none"
      onClick={() => {
        setTerang(true);
        setTimeout(() => setTerang(false), 5000);
      }}
    >
      <p className={cn("t-jam text-[min(30vw,300px)] text-[#ff9f6b] transition-opacity duration-700", terang ? "opacity-90" : "opacity-[0.38]")}>{jam}</p>
      <p
        className={cn(
          "mt-6 flex h-10 items-center gap-2 rounded-full border border-[#5eead4]/35 px-4 text-[16px] font-semibold text-[#5eead4] transition-opacity",
          terang ? "opacity-100" : "opacity-60",
        )}
      >
        {isi(J.siagaUntuk, { jam: alarm })}
        <Check size={17} strokeWidth={2.6} />
      </p>
      <div className={cn("mt-4 flex items-center gap-2 text-[14px] text-white/55 transition-opacity", terang ? "opacity-100" : "opacity-60")}>
        {dicas ? (
          <>
            <BatteryCharging size={18} strokeWidth={1.75} />
            {J.dicas}
          </>
        ) : null}
      </div>
      {!dicas || !daring ? (
        <div
          role="status"
          className="absolute inset-x-4 bottom-[max(24px,env(safe-area-inset-bottom))] mx-auto flex max-w-[460px] items-center gap-3 rounded-[20px] bg-[#3a2500] px-4 py-3 text-left text-[15px] text-amber-100"
        >
          {!daring ? <WifiOff size={20} className="shrink-0 text-amber-300" /> : <PlugZap size={20} className="shrink-0 text-amber-300" />}
          {!daring ? J.putus : J.tidakDicas}
        </div>
      ) : (
        <p className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] text-[13px] text-white/35">{terang ? J.keluar : J.ketuk}</p>
      )}
    </main>
  );
}
