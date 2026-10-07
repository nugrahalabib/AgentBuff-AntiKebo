import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Varian = "utama" | "kaca" | "polos" | "bahaya";
type Ukuran = "besar" | "sedang" | "kecil";

const VARIAN: Record<Varian, string> = {
  // Tombol utama grafit berbentuk pil (docs/04-DESAIN.md §1.6).
  utama: "bg-grafit text-grafit-label shadow-[0_8px_24px_-10px_rgba(0,0,0,0.45)] hover:brightness-125",
  kaca: "kaca text-label hover:brightness-[1.03]",
  polos: "bg-transparent text-aksen hover:bg-kaca-isi",
  bahaya: "bg-kaca-isi text-bahaya hover:bg-bahaya-isi/15",
};
const UKURAN: Record<Ukuran, string> = {
  besar: "h-[52px] px-7 text-[17px] rounded-full",
  sedang: "h-11 px-5 text-[15px] rounded-full",
  kecil: "h-9 px-3.5 text-[14px] rounded-full",
};

export function kelasTombol(varian: Varian = "utama", ukuran: Ukuran = "sedang", ekstra?: string) {
  return cn(
    "tekan inline-flex select-none items-center justify-center gap-2 font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-45",
    VARIAN[varian],
    UKURAN[ukuran],
    ekstra,
  );
}

export function Tombol({ varian, ukuran, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { varian?: Varian; ukuran?: Ukuran }) {
  return <button type="button" className={kelasTombol(varian, ukuran, className)} {...p} />;
}

export function TautanTombol({ varian, ukuran, className, href, ...p }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; varian?: Varian; ukuran?: Ukuran }) {
  const luar = /^https?:\/\//.test(href);
  if (luar) return <a href={href} className={kelasTombol(varian, ukuran, className)} target="_blank" rel="noopener noreferrer" {...p} />;
  // Rute handler (masuk AgentBuff) WAJIB navigasi penuh: Link mengambilnya
  // sebagai RSC (?_rsc=) lalu tersandung pengalihan lintas asal ke agentbuff.id.
  if (/^\/(auth|api)\//.test(href)) return <a href={href} className={kelasTombol(varian, ukuran, className)} {...p} />;
  return <Link href={href} className={kelasTombol(varian, ukuran, className)} {...p} />;
}

/** Saklar gaya iOS. Toska = hidup/aktif. */
export function Saklar({
  nyala,
  ubah,
  label,
  nonaktif,
  warna = "var(--toska-isi)",
}: {
  nyala: boolean;
  ubah: (v: boolean) => void;
  label: string;
  nonaktif?: boolean;
  warna?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={nyala}
      aria-label={label}
      disabled={nonaktif}
      onClick={() => ubah(!nyala)}
      className="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 disabled:opacity-40"
      style={{ background: nyala ? warna : "var(--kaca-isi)" }}
    >
      <span
        className="absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)] transition-transform duration-300"
        style={{ transform: nyala ? "translateX(20px)" : "none", transitionTimingFunction: "var(--ease-pegas)" }}
      />
    </button>
  );
}

/** Kontrol tersegmen gaya iOS. */
export function Segmen<T extends string>({ pilihan, nilai, ubah, label }: { pilihan: Array<{ nilai: T; label: string }>; nilai: T | null; ubah: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-[14px] bg-kaca-isi p-1">
      {pilihan.map((p) => (
        <button
          key={p.nilai}
          type="button"
          role="radio"
          aria-checked={nilai === p.nilai}
          onClick={() => ubah(p.nilai)}
          className={cn("tekan min-h-9 flex-1 rounded-[10px] px-2 text-[14px] font-semibold", nilai === p.nilai ? "kaca-kuat text-label" : "text-label-2 hover:text-label")}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function Kosong({ ikon, judul, isi, aksi }: { ikon: ReactNode; judul: string; isi: string; aksi?: ReactNode }) {
  return (
    <div className="muncul kaca mx-auto flex max-w-md flex-col items-center rounded-[28px] px-6 py-10 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-[20px] bg-kaca-isi text-label-2">{ikon}</div>
      <h2 className="t-judul-3">{judul}</h2>
      <p className="t-subjudul mt-2 text-label-2">{isi}</p>
      {aksi ? <div className="mt-6">{aksi}</div> : null}
    </div>
  );
}

export function Spanduk({ nada = "waspada", judul, isi, aksi }: { nada?: "waspada" | "info" | "bahaya"; judul: string; isi?: string; aksi?: ReactNode }) {
  const warna = nada === "bahaya" ? "var(--bahaya-isi)" : nada === "info" ? "var(--aksen-isi)" : "var(--waspada-isi)";
  return (
    <div role="status" className="muncul kaca flex flex-col gap-3 rounded-[22px] p-4 sm:flex-row sm:items-center">
      <span aria-hidden className="h-10 w-1.5 shrink-0 rounded-full max-sm:hidden" style={{ background: warna }} />
      <div className="min-w-0 flex-1">
        <p className="t-kepala">{judul}</p>
        {isi ? <p className="t-subjudul mt-0.5 text-label-2">{isi}</p> : null}
      </div>
      {aksi}
    </div>
  );
}

/** Penghitung (stepper) gaya iOS: kurang, nilai, tambah. */
export function Penghitung({
  nilai,
  ubah,
  min,
  maks,
  label,
  labelKurang,
  labelTambah,
  satuan,
}: {
  nilai: number;
  ubah: (v: number) => void;
  min: number;
  maks: number;
  label: string;
  labelKurang: string;
  labelTambah: string;
  satuan?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 rounded-full bg-kaca-isi p-1">
      <button
        type="button"
        aria-label={labelKurang}
        disabled={nilai <= min}
        onClick={() => ubah(nilai - 1)}
        className="tekan grid size-9 place-items-center rounded-full text-[20px] font-semibold disabled:opacity-35"
      >
        −
      </button>
      <output aria-live="polite" className="t-angka min-w-[3ch] text-center text-[17px] font-semibold">
        {satuan ?? nilai}
      </output>
      <button
        type="button"
        aria-label={labelTambah}
        disabled={nilai >= maks}
        onClick={() => ubah(nilai + 1)}
        className="tekan grid size-9 place-items-center rounded-full text-[20px] font-semibold disabled:opacity-35"
      >
        +
      </button>
    </div>
  );
}

/** Cip pilihan (hari, kanal): pil yang bisa dinyalakan; nyala = toska karena "aktif". */
export function Cip({ nyala, ubah, children, label, nonaktif }: { nyala: boolean; ubah: (v: boolean) => void; children: ReactNode; label?: string; nonaktif?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={nyala}
      aria-label={label}
      disabled={nonaktif}
      onClick={() => ubah(!nyala)}
      className={cn(
        "tekan h-11 min-w-11 rounded-full px-3.5 text-[15px] font-semibold disabled:opacity-40",
        nyala ? "bg-toska-isi text-[#04211f]" : "bg-kaca-isi text-label-2 hover:text-label",
      )}
    >
      {children}
    </button>
  );
}
