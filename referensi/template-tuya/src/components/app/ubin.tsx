"use client";

import { Ellipsis, WifiOff } from "lucide-react";
import { IKON_JENIS, WARNA_JENIS } from "@/components/ui/ikon";
import { cn } from "@/lib/cn";
import { isi, type Kamus } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import type { PerangkatRamah } from "@/lib/layanan/rumah";

export function namaMode(t: Kamus, m: string | number | null | undefined): string {
  if (m === null || m === undefined) return "";
  const k = String(m).toLowerCase();
  return (t.perangkat.modeNama as Record<string, string>)[k] ?? String(m);
}

/** Satu baris status manusiawi untuk ubin & daftar. */
export function teksStatus(t: Kamus, p: PerangkatRamah): string {
  if (!p.online) return t.umum.offline;
  // AC remote tanpa kode: keadaan di cermin hanya tebakan, jangan ditampilkan seolah nyata.
  if (p.kontrol.inframerah && !p.kontrol.kodeIr) return t.ir.belumDipasang;
  const s = p.keadaan;
  if (s.nyala === null && p.jenis === "tirai" && s.posisiPersen != null) return s.posisiPersen > 0 ? `${t.perangkat.buka} ${s.posisiPersen}%` : t.perangkat.tutup;
  if (s.nyala === null) {
    const bacaan = [s.suhuRuang != null ? `${s.suhuRuang}°` : "", s.kelembapan != null ? `${s.kelembapan}%` : "", s.bateraiPersen != null ? isi(t.perangkat.baterai, { n: s.bateraiPersen }) : ""].filter(Boolean);
    return bacaan.join(" · ") || t.perangkat.namaJenis[p.jenis];
  }
  if (!s.nyala) return t.umum.mati;
  const b: string[] = [];
  if (s.saluran && s.saluran.length > 1) b.push(`${s.saluran.filter((x) => x.nyala).length}/${s.saluran.length}`);
  if (s.terangPersen != null) b.push(`${s.terangPersen}%`);
  if (s.suhuTarget != null) b.push(`${s.suhuTarget}°`);
  if (s.modeAc) b.push(namaMode(t, s.modeAc));
  if (s.posisiPersen != null && p.jenis === "tirai") b.push(`${s.posisiPersen}%`);
  if (s.watt != null && s.watt > 0) b.push(`${s.watt} W`);
  return b.length ? b.join(" · ") : t.umum.nyala;
}

/** Warna cahaya ubin: warna lampu sebenarnya bila mode warna, selain itu warna khas jenis. */
export function warnaCahaya(p: PerangkatRamah): string {
  if (p.keadaan.warnaHex && p.keadaan.modeKerja === "colour") return p.keadaan.warnaHex;
  return WARNA_JENIS[p.jenis];
}

export function bisaDisaklar(p: PerangkatRamah): boolean {
  if (p.kontrol.inframerah && !p.kontrol.kodeIr) return false; // ketuk = buka pemasangan kode
  return p.kontrol.daya || p.kontrol.saluran.length > 0;
}

export function UbinPerangkat({ p, sibuk, saklar, buka }: { p: PerangkatRamah; sibuk: boolean; saklar: () => void; buka: () => void }) {
  const { t } = useKamus();
  const Ikon = IKON_JENIS[p.jenis];
  const nyala = p.online && p.keadaan.nyala === true && !(p.kontrol.inframerah && !p.kontrol.kodeIr);
  const warna = warnaCahaya(p);
  const bisa = p.online && bisaDisaklar(p);

  return (
    <div
      className={cn(
        "tekan group relative flex aspect-[1.12] min-h-[124px] flex-col justify-between rounded-[24px] p-3.5 sm:aspect-[1.3] sm:p-4",
        nyala ? "kaca-nyala" : "ubin-mati",
        !p.online && "opacity-60",
      )}
      style={nyala ? { ["--cahaya" as string]: `color-mix(in srgb, ${warna} 55%, transparent)` } : undefined}
      data-perangkat={p.id}
      data-nyala={nyala ? "1" : "0"}
    >
      <button
        type="button"
        onClick={bisa ? saklar : buka}
        aria-pressed={bisa ? nyala : undefined}
        aria-label={`${p.nama}, ${teksStatus(t, p)}`}
        className="absolute inset-0 rounded-[24px]"
      />
      <span className="pointer-events-none relative flex items-start justify-between">
        <span
          className="grid size-11 place-items-center rounded-full transition-colors duration-500"
          style={{ background: nyala ? warna : "var(--kaca-isi)", color: nyala ? "#fff" : "var(--label-2)", boxShadow: nyala ? `0 6px 18px -6px ${warna}` : undefined }}
        >
          {p.online ? <Ikon size={21} strokeWidth={2.2} /> : <WifiOff size={19} />}
        </span>
        {sibuk ? <span className="putar mt-1 size-4 rounded-full border-2 border-current border-t-transparent opacity-50" /> : null}
      </span>
      <button
        type="button"
        onClick={buka}
        aria-label={`${t.perangkat.info}: ${p.nama}`}
        className={cn("absolute top-2 right-2 grid size-10 place-items-center rounded-full transition", nyala ? "text-nyala-label-2 hover:bg-black/5" : "text-label-2 hover:bg-kaca-isi")}
      >
        <Ellipsis size={20} />
      </button>
      <span className="pointer-events-none relative min-w-0">
        <span className={cn("line-clamp-2 block text-[15px] leading-[1.2] font-semibold", nyala ? "text-nyala-label" : "text-label")}>{p.nama}</span>
        <span className={cn("t-keterangan mt-0.5 block truncate", nyala ? "text-nyala-label-2" : "text-label-2")}>
          {teksStatus(t, p)}
          {p.sensitif && !nyala ? ` · ${t.rumah.sensitif}` : ""}
        </span>
      </span>
    </div>
  );
}

export function ringkasNyala(t: Kamus, daftar: PerangkatRamah[]): string {
  const n = daftar.filter((p) => p.online && p.keadaan.nyala).length;
  const off = daftar.filter((p) => !p.online).length;
  const bag = [n ? isi(t.rumah.ringkasNyala, { n }) : t.rumah.ringkasSemuaMati];
  if (off) bag.push(isi(t.rumah.ringkasOffline, { n: off }));
  return bag.join(" · ");
}
