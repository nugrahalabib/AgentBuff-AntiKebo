"use client";

import { Volume2 } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useKamus } from "@/lib/i18n/klien";
import { PemutarAlarm, type CaraUcap, type OpsiPemutar, type PeristiwaPemutar } from "@/lib/suara/pemutar";
import { LayarBerbunyi } from "./berbunyi";

export type SuaraAlarm = Omit<OpsiPemutar, "saatOmelan" | "saatKeadaan" | "catat">;

/**
 * Bunyi + omelan untuk layar berbunyi (docs/10-SUARA.md §3). Pemutar dimulai saat layar tampil;
 * bila peramban menahan audio, muncul ajakan "Ketuk layar" dan ketukan/tombol pertama di
 * mana pun membuka audio (juga papan angka soal). Pemutar berhenti saat layar ditutup.
 */
export function useSuaraAlarm(suara: SuaraAlarm | null, catat?: (p: PeristiwaPemutar) => void) {
  const [perluKetuk, setPerluKetuk] = useState(false);
  const [omelan, setOmelan] = useState<{ teks: string; cara: CaraUcap } | null>(null);
  const terbaru = useRef({ suara, catat });
  useEffect(() => {
    terbaru.current = { suara, catat };
  });
  const kunci = suara ? [suara.bunyi.url, suara.benih, suara.mulaiMs, suara.bahasa, ...suara.omelan.map((o) => `${o.klip ?? ""}|${o.teks}`)].join("\n") : null;

  useEffect(() => {
    const s = terbaru.current.suara;
    if (!kunci || !s) return;
    const p = new PemutarAlarm({
      ...s,
      saatOmelan: (teks, cara) => setOmelan(teks && cara ? { teks, cara } : null),
      saatKeadaan: (jalan) => setPerluKetuk(!jalan),
      catat: (x) => terbaru.current.catat?.(x),
    });
    let aktif = true;
    void p.mulai().then((jalan) => {
      if (aktif) setPerluKetuk(!jalan);
    });
    // Safari lama hanya membuka audio di touchend/click; Chrome di pointerdown/keydown.
    const ketuk = () => p.ketuk();
    const JENIS = ["pointerdown", "touchend", "click", "keydown"] as const;
    for (const j of JENIS) document.addEventListener(j, ketuk, true);
    return () => {
      aktif = false;
      for (const j of JENIS) document.removeEventListener(j, ketuk, true);
      p.berhenti();
    };
  }, [kunci]);

  return { perluKetuk, omelan };
}

/** Layar berbunyi lengkap dengan suara. Teks omelan yang sedang diucapkan menggantikan teks contoh. */
export function LayarBerbunyiBersuara({ suara, catat, ...props }: ComponentProps<typeof LayarBerbunyi> & { suara: SuaraAlarm | null; catat?: (p: PeristiwaPemutar) => void }) {
  const { t } = useKamus();
  const { perluKetuk, omelan } = useSuaraAlarm(suara, catat);
  return (
    <>
      <LayarBerbunyi {...props} omelan={omelan?.teks ?? props.omelan} omelanBesar={omelan?.cara === "teks"} />
      {perluKetuk ? (
        <div className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-30 flex justify-center px-4">
          <button
            type="button"
            className="tekan pointer-events-auto flex min-h-12 max-w-full items-center gap-2 rounded-full bg-white px-5 py-2 text-left text-[15px] leading-tight font-semibold text-[#1a0d05] shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
          >
            <Volume2 aria-hidden size={20} strokeWidth={2.2} className="shrink-0" />
            {t.suara.ketukMulai}
          </button>
        </div>
      ) : null}
    </>
  );
}
