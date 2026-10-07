"use client";

import { Check, Delete } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Papan angka besar milik AntiKebo (bukan papan ketik HP): tombol ≥ 64 px supaya bisa
 * ditekan saat setengah sadar. Juga menerima ketikan angka, Backspace, dan Enter.
 */
export function PapanAngka({
  ubah,
  hapus,
  kirim,
  labelHapus,
  labelKirim,
  nonaktif,
  bisaKirim = true,
}: {
  ubah: (angka: string) => void;
  hapus: () => void;
  kirim: () => void;
  labelHapus: string;
  labelKirim: string;
  nonaktif?: boolean;
  bisaKirim?: boolean;
}) {
  const tombol = (isi: ReactNode, aksi: () => void, opsi: { label?: string; utama?: boolean; mati?: boolean } = {}) => (
    <button
      type="button"
      aria-label={opsi.label}
      disabled={nonaktif || opsi.mati}
      onClick={aksi}
      className={cn(
        "tekan t-jam grid h-16 place-items-center rounded-[20px] text-[30px] font-normal select-none disabled:opacity-35 sm:h-[72px]",
        opsi.utama ? "bg-white text-[#140403]" : "bg-white/12 text-white hover:bg-white/18",
      )}
    >
      {isi}
    </button>
  );
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((a) => (
        <span key={a} className="contents">
          {tombol(a, () => ubah(a))}
        </span>
      ))}
      {tombol(<Delete size={26} strokeWidth={1.75} />, hapus, { label: labelHapus })}
      {tombol("0", () => ubah("0"))}
      {tombol(<Check size={28} strokeWidth={2.4} />, kirim, { label: labelKirim, utama: true, mati: !bisaKirim })}
    </div>
  );
}
