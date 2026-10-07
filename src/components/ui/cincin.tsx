import type { ReactNode } from "react";

/** Cincin kemajuan (skor, hitung mundur Masih bangun). `nilai` 0..1. */
export function Cincin({
  nilai,
  ukuran = 120,
  tebal = 12,
  warna = "var(--toska-isi)",
  jalur = "var(--kaca-isi)",
  children,
  label,
}: {
  nilai: number;
  ukuran?: number;
  tebal?: number;
  warna?: string;
  jalur?: string;
  children?: ReactNode;
  label?: string;
}) {
  const r = (ukuran - tebal) / 2;
  const keliling = 2 * Math.PI * r;
  const isi = Math.min(1, Math.max(0, nilai));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: ukuran, height: ukuran }} role={label ? "img" : undefined} aria-label={label}>
      <svg width={ukuran} height={ukuran} className="-rotate-90" aria-hidden>
        <circle cx={ukuran / 2} cy={ukuran / 2} r={r} fill="none" stroke={jalur} strokeWidth={tebal} />
        <circle
          cx={ukuran / 2}
          cy={ukuran / 2}
          r={r}
          fill="none"
          stroke={warna}
          strokeWidth={tebal}
          strokeLinecap="round"
          strokeDasharray={keliling}
          strokeDashoffset={keliling * (1 - isi)}
          style={{ transition: "stroke-dashoffset 0.6s var(--ease-pegas)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
