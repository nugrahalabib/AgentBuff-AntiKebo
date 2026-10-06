"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Penggeser tebal gaya Apple (Pusat Kendali). Nilai ditampilkan langsung saat
 * digeser; `komit` dipanggil SEKALI saat dilepas - Tuya tidak dibanjiri perintah.
 */
export function Penggeser({
  nilai,
  min = 0,
  max = 100,
  langkah = 1,
  label,
  satuan = "%",
  ikon,
  latar,
  komit,
  nonaktif,
}: {
  nilai: number | null | undefined;
  min?: number;
  max?: number;
  langkah?: number;
  label: string;
  satuan?: string;
  ikon?: ReactNode;
  latar?: string;
  komit: (v: number) => void;
  nonaktif?: boolean;
}) {
  const [lokal, setLokal] = useState<number | null>(null);
  const tampil = lokal ?? nilai ?? min;
  const persen = ((tampil - min) / (max - min || 1)) * 100;
  const terakhirKomit = useRef<number | null>(null);

  const lepas = () => {
    if (lokal !== null && lokal !== terakhirKomit.current) {
      terakhirKomit.current = lokal;
      komit(lokal);
    }
    setLokal(null);
  };

  return (
    <div className={cn("relative h-14 overflow-hidden rounded-[18px] bg-kaca-isi", nonaktif && "opacity-50")} style={latar ? { background: latar } : undefined}>
      {!latar ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 bg-white/95 transition-[width] duration-150 dark:bg-white/85" style={{ width: `${Math.max(persen, 0)}%` }} />
      ) : (
        <div className="pointer-events-none absolute inset-y-1 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.15)]" style={{ left: `${Math.min(Math.max(persen, 2), 98)}%` }} />
      )}
      <div className={cn("pointer-events-none absolute inset-0 flex items-center justify-between px-4 text-[15px] font-semibold", latar ? "text-black/80" : persen > 55 ? "text-nyala-label" : "text-label")}>
        <span className="flex items-center gap-2">
          {ikon}
          {label}
        </span>
        <span className="t-angka">
          {Math.round(tampil * 10) / 10}
          {satuan}
        </span>
      </div>
      <input
        type="range"
        className="penggeser absolute inset-0"
        min={min}
        max={max}
        step={langkah}
        value={tampil}
        disabled={nonaktif}
        aria-label={label}
        onChange={(e) => setLokal(Number(e.target.value))}
        onPointerUp={lepas}
        onKeyUp={lepas}
        onTouchEnd={lepas}
        onBlur={lepas}
      />
    </div>
  );
}

/** Suhu besar dengan tombol - / + (AC, pemanas). Komit tertunda 700 ms supaya ketukan beruntun jadi satu perintah. */
export function PengaturSuhu({ nilai, min, max, langkah, komit, labelKurang, labelTambah }: { nilai: number | null; min: number; max: number; langkah: number; komit: (v: number) => void; labelKurang: string; labelTambah: string }) {
  const [lokal, setLokal] = useState<number | null>(null);
  const tunda = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tampil = lokal ?? nilai ?? Math.round((min + max) / 2);
  const ubah = (d: number) => {
    const v = Math.min(max, Math.max(min, Math.round((tampil + d) / langkah) * langkah));
    setLokal(v);
    if (tunda.current) clearTimeout(tunda.current);
    tunda.current = setTimeout(() => {
      komit(v);
      setLokal(null);
    }, 700);
  };
  useEffect(
    () => () => {
      if (tunda.current) clearTimeout(tunda.current);
    },
    [],
  );
  const l = Math.max(langkah, 0.5);
  return (
    <div className="flex items-center justify-between gap-4 rounded-[24px] bg-kaca-isi p-3">
      <button type="button" aria-label={labelKurang} onClick={() => ubah(-l)} disabled={tampil <= min} className="tekan grid size-14 place-items-center rounded-full bg-kaca-kuat disabled:opacity-40">
        <Minus size={24} />
      </button>
      <p className="t-angka text-[56px] leading-none font-semibold tracking-tight" aria-live="polite">
        {Number.isInteger(tampil) ? tampil : tampil.toFixed(1)}
        <span className="align-top text-[24px] text-label-2">°</span>
      </p>
      <button type="button" aria-label={labelTambah} onClick={() => ubah(l)} disabled={tampil >= max} className="tekan grid size-14 place-items-center rounded-full bg-kaca-kuat disabled:opacity-40">
        <Plus size={24} />
      </button>
    </div>
  );
}

export function Bagian({ judul, children, ket }: { judul: string; children: ReactNode; ket?: string }) {
  return (
    <section className="mt-6 first:mt-2">
      <h3 className="t-kapsi mb-2 px-1 text-label-2 uppercase">{judul}</h3>
      {children}
      {ket ? <p className="t-keterangan mt-2 px-1 text-label-3">{ket}</p> : null}
    </section>
  );
}
