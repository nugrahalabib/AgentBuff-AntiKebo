"use client";

import { Download, Share, SquarePlus } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Tombol } from "@/components/ui/dasar";
import { useKamus } from "@/lib/i18n/klien";

type Platform = "ios" | "android" | "desktop";
type AjakanPasang = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function platformIni(): Platform {
  const ua = navigator.userAgent;
  const ipadBaru = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || ipadBaru) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

const tanpaLangganan = () => () => {};
const terpasang = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Panduan pasang ke layar utama per platform (P9). Chrome/Edge memberi tombol Pasang langsung
 * (`beforeinstallprompt`); iPhone/iPad lewat Bagikan, lalu Tambah ke Layar Utama (Safari tidak
 * punya tombol pasang otomatis). Sudah terpasang = disembunyikan.
 */
export function PanduanPasang() {
  const { t } = useKamus();
  const P = t.pasang;
  const platform = useSyncExternalStore(tanpaLangganan, platformIni, () => null);
  const sudah = useSyncExternalStore(tanpaLangganan, terpasang, () => true);
  const [ajakan, setAjakan] = useState<AjakanPasang | null>(null);

  useEffect(() => {
    const f = (e: Event) => {
      e.preventDefault();
      setAjakan(e as AjakanPasang);
    };
    window.addEventListener("beforeinstallprompt", f);
    return () => window.removeEventListener("beforeinstallprompt", f);
  }, []);

  if (sudah || !platform) return null;
  const langkah = platform === "ios" ? P.ios : platform === "android" ? P.android : P.desktop;
  return (
    <section aria-label={P.judul} className="mt-6 rounded-[20px] bg-kaca-isi px-4 py-3.5 text-left">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <SquarePlus size={17} className="text-label-2" />
        {P.judul}
      </h2>
      <p className="t-keterangan mt-1 text-label-2">{P.ket}</p>
      {ajakan ? (
        <Tombol
          varian="kaca"
          ukuran="sedang"
          className="mt-3"
          onClick={async () => {
            await ajakan.prompt();
            await ajakan.userChoice.catch(() => null);
            setAjakan(null);
          }}
        >
          <Download size={16} />
          {P.tombol}
        </Tombol>
      ) : (
        <ol className="mt-2 flex flex-col gap-1.5">
          {langkah.map((l, i) => (
            <li key={l} className="flex items-start gap-2 text-[15px]">
              <span className="t-angka mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-grafit text-[12px] font-bold text-grafit-label">{i + 1}</span>
              <span>
                {l}
                {platform === "ios" && i === 0 ? <Share size={14} className="ml-1 inline align-[-2px]" aria-hidden /> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
