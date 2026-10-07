"use client";

import { AlarmClock, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useKamus } from "@/lib/i18n/klien";

/**
 * Kerangka aplikasi: isi + bilah tab kaca melayang. Tab Siaga dan Riwayat ditambahkan
 * bersama halamannya (P11); bilah samping laptop dan rancangan lengkap di P1/P8.
 */
export function Shell({ children }: { children: ReactNode }) {
  const { t } = useKamus();
  const jalur = usePathname();
  const tab = [
    { href: "/app", label: t.shell.tab.alarm, ikon: AlarmClock, aktif: jalur === "/app" },
    { href: "/app/pengaturan", label: t.shell.tab.pengaturan, ikon: Settings, aktif: jalur.startsWith("/app/pengaturan") },
  ];

  return (
    <>
      <div className="mx-auto max-w-[720px] px-4 pt-6 pb-36 sm:px-6">{children}</div>
      <nav aria-label={t.shell.navigasi} className="fixed inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
        <ul className="kaca-kuat flex gap-1 rounded-full p-1.5">
          {tab.map(({ href, label, ikon: Ikon, aktif }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "tekan flex h-[52px] min-w-[84px] flex-col items-center justify-center gap-0.5 rounded-full px-3 text-[13px] font-semibold",
                  aktif ? "bg-kaca-isi text-toska" : "text-label-2 hover:text-label",
                )}
              >
                <Ikon size={21} strokeWidth={aktif ? 2.4 : 1.75} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
