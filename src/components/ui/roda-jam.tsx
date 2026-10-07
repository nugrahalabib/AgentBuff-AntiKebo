"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

const TINGGI = 46; // tinggi satu baris (px), ≥ 44 px target sentuh

/**
 * Roda pemilih jam gaya iOS: dua kolom gulir dengan magnet (scroll-snap).
 * Papan ketik: panah atas/bawah, Page Up/Down (±5), Home/End. Pembaca layar
 * melihat `spinbutton` dengan nilai sekarang.
 */
export function RodaJam({
  jam,
  menit,
  ubah,
  labelJam,
  labelMenit,
  langkahMenit = 1,
  gelap,
}: {
  jam: number;
  menit: number;
  ubah: (v: { jam: number; menit: number }) => void;
  labelJam: string;
  labelMenit: string;
  langkahMenit?: number;
  gelap?: boolean;
}) {
  const daftarMenit = Array.from({ length: Math.ceil(60 / langkahMenit) }, (_, i) => i * langkahMenit);
  return (
    <div className="relative mx-auto flex w-full max-w-[280px] items-center justify-center gap-2" style={{ height: TINGGI * 5 }}>
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-[14px]", gelap ? "bg-white/10" : "bg-kaca-isi")}
        style={{ height: TINGGI }}
      />
      <Kolom nilai={jam} pilihan={Array.from({ length: 24 }, (_, i) => i)} ubah={(j) => ubah({ jam: j, menit })} label={labelJam} />
      <span aria-hidden className="t-jam relative text-[34px]">
        .
      </span>
      <Kolom nilai={menit} pilihan={daftarMenit} ubah={(m) => ubah({ jam, menit: m })} label={labelMenit} />
    </div>
  );
}

function Kolom({ nilai, pilihan, ubah, label }: { nilai: number; pilihan: number[]; ubah: (v: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const tunda = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indeks = Math.max(0, pilihan.indexOf(nilai));

  // Posisikan roda ke nilai sekarang (awal & bila nilai diubah dari luar/papan ketik).
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / TINGGI) !== indeks) el.scrollTo({ top: indeks * TINGGI, behavior: "auto" });
  }, [indeks]);

  const pilih = (i: number) => {
    const j = Math.min(pilihan.length - 1, Math.max(0, i));
    if (pilihan[j] !== nilai) ubah(pilihan[j]);
  };

  const tombol = (e: KeyboardEvent) => {
    const geser: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 };
    if (e.key in geser) pilih(indeks + geser[e.key]);
    else if (e.key === "Home") pilih(0);
    else if (e.key === "End") pilih(pilihan.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={pilihan[0]}
      aria-valuemax={pilihan[pilihan.length - 1]}
      aria-valuenow={nilai}
      aria-valuetext={String(nilai).padStart(2, "0")}
      onKeyDown={tombol}
      onScroll={(e) => {
        const el = e.currentTarget;
        if (tunda.current) clearTimeout(tunda.current);
        tunda.current = setTimeout(() => pilih(Math.round(el.scrollTop / TINGGI)), 90);
      }}
      className="roda tanpa-gulir relative h-full w-[92px] overflow-y-scroll rounded-[14px] outline-none"
      style={{ paddingBlock: TINGGI * 2 }}
    >
      {pilihan.map((v) => (
        <div
          key={v}
          onClick={() => pilih(pilihan.indexOf(v))}
          className={cn("t-jam flex cursor-pointer items-center justify-center text-[30px] transition-opacity", v === nilai ? "opacity-100" : "opacity-40")}
          style={{ height: TINGGI }}
        >
          {String(v).padStart(2, "0")}
        </div>
      ))}
    </div>
  );
}
