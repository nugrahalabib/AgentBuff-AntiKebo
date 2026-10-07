import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Daftar bergrup gaya Pengaturan iOS: judul kecil, baris dalam satu kaca, pemisah tipis. */
export function Grup({ judul, catatan, children, id }: { judul?: string; catatan?: string; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={judul && id ? id : undefined} className="flex flex-col gap-2">
      {judul ? (
        <h2 id={id} className="t-subjudul px-4 font-semibold text-label-2">
          {judul}
        </h2>
      ) : null}
      <ul className="kaca divide-y divide-pemisah overflow-hidden rounded-[22px]">{children}</ul>
      {catatan ? <p className="t-keterangan px-4 text-label-2">{catatan}</p> : null}
    </section>
  );
}

/** Kotak ikon gaya iOS (squircle berwarna). */
export function KotakIkon({ ikon: Ikon, warna }: { ikon: LucideIcon; warna: string }) {
  return (
    <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] text-white" style={{ background: warna }}>
      <Ikon size={17} strokeWidth={2} />
    </span>
  );
}

export function BarisGrup({
  ikon,
  warnaIkon = "var(--grafit)",
  label,
  sub,
  nilai,
  href,
  kanan,
  bahaya,
}: {
  ikon?: LucideIcon;
  warnaIkon?: string;
  label: string;
  sub?: string;
  nilai?: string;
  href?: string;
  kanan?: ReactNode;
  bahaya?: boolean;
}) {
  const isi = (
    <>
      {ikon ? <KotakIkon ikon={ikon} warna={warnaIkon} /> : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[17px]", bahaya && "text-bahaya")}>{label}</span>
        {sub ? <span className="t-keterangan block truncate text-label-2">{sub}</span> : null}
      </span>
      {nilai ? <span className="max-w-[45%] truncate text-[15px] text-label-2">{nilai}</span> : null}
      {kanan}
      {href ? <ChevronRight size={18} className="shrink-0 text-label-3" /> : null}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="tekan flex min-h-[52px] items-center gap-3 px-4 py-2.5 hover:bg-kaca-isi">
          {isi}
        </Link>
      ) : (
        <div className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">{isi}</div>
      )}
    </li>
  );
}
