"use client";

import { Bot, CalendarClock, House, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useKamus } from "@/lib/i18n/klien";
import { useToko } from "@/lib/app/toko";

/** Kerangka aplikasi: isi + bilah tab kaca melayang (iOS 26) + SSE perubahan rumah. */
export function Shell({ children, inisial }: { children: ReactNode; inisial: string }) {
  const { t } = useKamus();
  const jalur = usePathname();
  const muat = useToko((s) => s.muat);
  const [putus, setPutus] = useState(false);

  useEffect(() => {
    let es: EventSource | null = null;
    let ulang: ReturnType<typeof setTimeout> | null = null;
    const sambung = () => {
      es = new EventSource("/api/peristiwa");
      es.addEventListener("ubah", () => void muat());
      es.onopen = () => setPutus(false);
      es.onerror = () => {
        setPutus(true);
        es?.close();
        ulang = setTimeout(sambung, 4000);
      };
    };
    sambung();
    const saatKembali = () => document.visibilityState === "visible" && void muat();
    document.addEventListener("visibilitychange", saatKembali);
    return () => {
      es?.close();
      if (ulang) clearTimeout(ulang);
      document.removeEventListener("visibilitychange", saatKembali);
    };
  }, [muat]);

  const tab = [
    { href: "/app", label: t.shell.tab.rumah, ikon: House, aktif: jalur === "/app" },
    { href: "/app/suasana", label: t.shell.tab.suasana, ikon: Sparkles, aktif: jalur.startsWith("/app/suasana") },
    { href: "/app/jadwal", label: t.shell.tab.jadwal, ikon: CalendarClock, aktif: jalur.startsWith("/app/jadwal") },
    { href: "/app/agen", label: t.shell.tab.agen, ikon: Bot, aktif: jalur.startsWith("/app/agen") },
  ];
  const diWizard = jalur.startsWith("/app/sambungkan");

  return (
    <>
      <Link
        href="/app/pengaturan"
        aria-label={t.shell.pengaturan}
        className={cn("tekan kaca absolute top-[max(14px,env(safe-area-inset-top))] right-4 z-30 grid size-11 place-items-center rounded-full sm:right-6", jalur.startsWith("/app/pengaturan") && "ring-2 ring-aksen-isi")}
      >
        {inisial ? <span className="text-[15px] font-bold">{inisial}</span> : <Settings size={19} />}
      </Link>
      {putus ? (
        <p role="status" className="kaca fixed top-[max(14px,env(safe-area-inset-top))] left-1/2 z-30 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] font-medium text-label-2">
          <span className="denyut mr-2 inline-block size-2 rounded-full bg-waspada-isi" />
          {t.umum.terputus}
        </p>
      ) : null}
      <div className={cn("mx-auto max-w-[1100px] px-4 pt-6 sm:px-6", diWizard ? "pb-12" : "pb-36")}>{children}</div>
      {!diWizard ? (
        <nav aria-label={t.shell.tab.rumah} className="fixed inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
          <ul className="kaca-kuat flex gap-1 rounded-full p-1.5">
            {tab.map(({ href, label, ikon: Ikon, aktif }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={aktif ? "page" : undefined}
                  className={cn(
                    "tekan flex h-[52px] min-w-[68px] flex-col items-center justify-center gap-0.5 rounded-full px-3 text-[11px] font-semibold sm:min-w-[84px]",
                    aktif ? "bg-kaca-isi text-aksen" : "text-label-2 hover:text-label",
                  )}
                >
                  <Ikon size={21} strokeWidth={aktif ? 2.4 : 2} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </>
  );
}
