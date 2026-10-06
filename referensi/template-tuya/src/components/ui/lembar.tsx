"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useKamus } from "@/lib/i18n/klien";

/**
 * Lembar: bawah layar di ponsel (dengan pegangan), panel tengah di desktop.
 * Radix Dialog terkontrol tanpa Trigger memfokus "trigger" kosong saat ditutup
 * (pelajaran BYM) - fokus dikembalikan manual ke elemen yang membuka.
 */
export function Lembar({
  buka,
  ubahBuka,
  judul,
  sub,
  children,
  kaki,
  lebar = 520,
  aksen,
}: {
  buka: boolean;
  ubahBuka: (v: boolean) => void;
  judul: string;
  sub?: string;
  children: ReactNode;
  kaki?: ReactNode;
  lebar?: number;
  aksen?: ReactNode;
}) {
  const pemicu = useRef<HTMLElement | null>(null);
  const { t } = useKamus();
  return (
    <Dialog.Root
      open={buka}
      onOpenChange={(v) => {
        if (v && typeof document !== "undefined") pemicu.current = document.activeElement as HTMLElement | null;
        ubahBuka(v);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="muncul-pudar fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            pemicu.current = (document.activeElement as HTMLElement | null) ?? pemicu.current;
            e.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            pemicu.current?.focus?.();
          }}
          style={{ ["--lebar" as string]: `${lebar}px` }}
          className={cn(
            "kaca-kuat fixed z-50 flex max-h-[92dvh] flex-col outline-none",
            "inset-x-0 bottom-0 rounded-t-[30px] pb-[env(safe-area-inset-bottom)] [animation:lembar-naik_0.5s_var(--ease-pegas)_both]",
            "md:inset-auto md:top-1/2 md:left-1/2 md:w-[min(var(--lebar),calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[30px] md:pb-0 md:[animation:lembar-skala_0.4s_var(--ease-pegas)_both]",
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-label-3/40 md:hidden" />
          <div className="flex items-start gap-3 px-6 pt-4 pb-2 md:pt-6">
            {aksen}
            <div className="min-w-0 flex-1">
              <Dialog.Title className="t-judul-3 truncate">{judul}</Dialog.Title>
              {sub ? <Dialog.Description className="t-subjudul mt-0.5 text-label-2">{sub}</Dialog.Description> : <Dialog.Description className="sr-only">{judul}</Dialog.Description>}
            </div>
            <Dialog.Close className="tekan grid size-9 shrink-0 place-items-center rounded-full bg-kaca-isi text-label-2 hover:text-label" aria-label={t.umum.tutup}>
              <X size={18} strokeWidth={2.4} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-2 pb-6">{children}</div>
          {kaki ? <div className="border-t border-pemisah px-6 py-4">{kaki}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
