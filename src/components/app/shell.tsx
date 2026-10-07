"use client";

import { AlarmClock, History, MonitorSmartphone, Plus, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/ikon";
import { cn } from "@/lib/cn";
import { useKamus } from "@/lib/i18n/klien";

export type IdTab = "alarm" | "siaga" | "riwayat" | "pengaturan";

const IKON: Record<IdTab, LucideIcon> = { alarm: AlarmClock, siaga: MonitorSmartphone, riwayat: History, pengaturan: Settings };
const HREF_APP: Record<IdTab, string> = { alarm: "/app", siaga: "/app/siaga", riwayat: "/app/riwayat", pengaturan: "/app/pengaturan" };

/**
 * Kerangka aplikasi (docs/04-DESAIN.md §3): HP = bilah tab kaca di bawah, laptop = bilah samping
 * kaca, isi di tengah selebar 720 px. Tab yang ditampilkan dipilih pemakai (halaman yang belum
 * ada tidak diberi tab). Layar penuh (berbunyi, Jam Meja, dst.) tidak memakai kerangka ini.
 */
export function Shell({
  children,
  tab = ["alarm", "pengaturan"],
  href = HREF_APP,
  aktif: aktifPaksa,
  tambahHref,
}: {
  children: ReactNode;
  tab?: IdTab[];
  href?: Record<IdTab, string>;
  /** Paksa tab aktif (prototipe); bawaan dari jalur sekarang. */
  aktif?: IdTab;
  /** Tujuan tombol "Alarm baru" di bilah samping laptop. */
  tambahHref?: string;
}) {
  const { t } = useKamus();
  const jalur = usePathname();
  const aktif = aktifPaksa ?? (jalur === href.alarm ? "alarm" : (tab.find((id) => id !== "alarm" && jalur.startsWith(href[id])) ?? "alarm"));
  const daftar = tab.map((id) => ({ id, label: t.navigasi[id], ikon: IKON[id], href: href[id], aktif: id === aktif }));

  return (
    <>
      <aside className="kaca fixed inset-y-3 left-3 z-30 hidden w-[248px] flex-col rounded-[28px] p-3 lg:flex">
        <Link href={href.alarm} className="flex items-center gap-2.5 px-2 pt-1 pb-4">
          <Logo ukuran={34} />
          <span className="leading-none">
            <span className="block text-[16px] font-bold tracking-tight">{t.merek.nama}</span>
            <span className="t-keterangan text-label-2">{t.merek.oleh}</span>
          </span>
        </Link>
        <nav aria-label={t.navigasi.utama}>
          <ul className="flex flex-col gap-1">
            {daftar.map(({ id, label, ikon: Ikon, href: tujuan, aktif: ya }) => (
              <li key={id}>
                <Link
                  href={tujuan}
                  aria-current={ya ? "page" : undefined}
                  className={cn(
                    "tekan flex h-11 items-center gap-3 rounded-[14px] px-3 text-[15px] font-semibold",
                    ya ? "bg-kaca-isi text-label" : "text-label-2 hover:bg-kaca-isi hover:text-label",
                  )}
                >
                  <Ikon size={20} strokeWidth={ya ? 2.2 : 1.75} className={ya ? "text-toska" : undefined} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {tambahHref ? (
          <Link href={tambahHref} className="tekan mt-auto flex h-11 items-center justify-center gap-2 rounded-full bg-grafit text-[15px] font-semibold text-grafit-label">
            <Plus size={18} strokeWidth={2.4} />
            {t.navigasi.tambah}
          </Link>
        ) : null}
      </aside>

      <div className="mx-auto max-w-[720px] px-4 pt-6 pb-36 sm:px-6 lg:pb-16 lg:pl-[272px] lg:max-w-[992px]">
        <div className="mx-auto max-w-[720px]">{children}</div>
      </div>

      <nav aria-label={t.navigasi.utama} className="fixed inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))] z-30 flex justify-center px-4 lg:hidden">
        <ul className="kaca-kuat flex gap-1 rounded-full p-1.5">
          {daftar.map(({ id, label, ikon: Ikon, href: tujuan, aktif: ya }) => (
            <li key={id}>
              <Link
                href={tujuan}
                aria-current={ya ? "page" : undefined}
                className={cn(
                  "tekan flex h-[54px] min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-full px-2.5 text-[13px] font-semibold sm:min-w-[84px]",
                  ya ? "bg-kaca-isi text-label" : "text-label-2 hover:text-label",
                )}
              >
                <Ikon size={21} strokeWidth={ya ? 2.2 : 1.75} className={ya ? "text-toska" : undefined} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
