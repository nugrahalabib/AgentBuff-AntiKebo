"use client";

import { AlarmClock, Download, Monitor, ShieldAlert, Smartphone } from "lucide-react";
import { TautanTombol, Tombol } from "@/components/ui/dasar";
import { Logo } from "@/components/ui/ikon";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import type { RingkasPerangkat } from "@/lib/tampilan/jenis";

/** Tab Siaga (docs/04-DESAIN.md §4.7): perangkat yang membunyikan alarm + cara menambah. */
export function LayarSiaga({ perangkat, hrefUnduh, hrefJamMeja, putus }: { perangkat: RingkasPerangkat[]; hrefUnduh: string; hrefJamMeja: string; putus?: (id: string) => void }) {
  const { t } = useKamus();
  const S = t.siaga;
  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <h1 className="t-judul-besar muncul">{S.judul}</h1>
        <p className="t-isi mt-1 text-label-2">{S.sub}</p>
      </header>

      {perangkat.length ? (
        <ul className="flex flex-col gap-2.5">
          {perangkat.map((p) => (
            <li key={p.id} className="kaca flex items-center gap-4 rounded-[22px] p-4">
              <span className={cn("grid size-12 shrink-0 place-items-center rounded-[15px]", p.siapMalamIni ? "bg-toska-isi/20 text-toska" : "bg-kaca-isi text-label-2")}>
                {p.jenis === "pc" ? <Monitor size={24} strokeWidth={1.75} /> : <Smartphone size={24} strokeWidth={1.75} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="t-kepala block truncate">{p.nama}</span>
                <span className="t-keterangan block text-label-2">
                  {S.jenis[p.jenis]} · {isi(S.terakhirTerlihat, { waktu: p.terakhirTerlihat })}
                </span>
                <span
                  className={cn(
                    "mt-1.5 inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold",
                    p.siapMalamIni ? "bg-toska-isi/15 text-toska" : "bg-waspada-isi/15 text-waspada",
                  )}
                >
                  <span aria-hidden className={cn("size-2 rounded-full", p.siapMalamIni ? "bg-toska-isi" : "bg-waspada-isi")} />
                  {p.siapMalamIni ? S.siapMalamIni : S.belumSiap}
                </span>
              </span>
              <Tombol varian="polos" ukuran="kecil" onClick={() => putus?.(p.id)}>
                {S.putus}
              </Tombol>
            </li>
          ))}
        </ul>
      ) : (
        <p className="kaca rounded-[22px] p-5 text-[15px] text-label-2">{S.kosong}</p>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <TautanTombol href={hrefUnduh} ukuran="besar" className="sm:flex-1">
          <Monitor size={19} />
          {S.pasangPc}
        </TautanTombol>
        <TautanTombol href={hrefJamMeja} varian="kaca" ukuran="besar" className="sm:flex-1">
          <AlarmClock size={19} />
          {S.jadikanJamMeja}
        </TautanTombol>
      </div>
    </div>
  );
}

/** Halaman unduh PC: tombol unduh, panduan layar biru Windows bergambar 3 langkah, sidik SHA-256. */
export function LayarUnduhPc({ hrefUnduh, ukuranMb, sha256 }: { hrefUnduh: string; ukuranMb: number; sha256: string }) {
  const { t } = useKamus();
  const U = t.unduh;
  const W = t.layarBiru;
  return (
    <div className="flex flex-col gap-6">
      <section className="muncul kaca-kuat flex flex-col items-center rounded-[30px] px-6 py-9 text-center">
        <Logo ukuran={72} />
        <h1 className="t-judul-1 mt-5">{U.judul}</h1>
        <p className="t-isi mt-2 max-w-[44ch] text-label-2">{U.sub}</p>
        <a href={hrefUnduh} className="tekan mt-7 inline-flex h-[52px] items-center gap-2 rounded-full bg-grafit px-7 text-[17px] font-semibold text-grafit-label">
          <Download size={19} />
          {U.tombol}
        </a>
        <p className="t-keterangan mt-3 text-label-2">{isi(U.ukuran, { mb: ukuranMb })}</p>
      </section>

      <section aria-labelledby="judul-panduan" className="flex flex-col gap-3">
        <div className="px-1">
          <h2 id="judul-panduan" className="t-judul-3">
            {U.panduanJudul}
          </h2>
          <p className="t-subjudul mt-0.5 text-label-2">{U.panduanSub}</p>
        </div>
        <ol className="grid gap-3 md:grid-cols-3">
          {U.langkah.map((l, i) => (
            <li key={l} className="kaca flex flex-col gap-3 rounded-[22px] p-4">
              <div aria-hidden className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-[#0b5cad] p-3 text-left text-white">
                <ShieldAlert size={22} className="opacity-90" />
                <p className="mt-2 text-[14px] leading-tight font-semibold">{W.judul}</p>
                {i === 0 ? (
                  <p className="mt-1.5 text-[12px] underline decoration-2 underline-offset-2 ring-2 ring-amber-300 ring-offset-2 ring-offset-[#0b5cad] inline-block rounded-sm">
                    {W.info}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[12px] opacity-80">{W.aplikasi}</p>
                )}
                {i >= 1 ? (
                  <div className="absolute right-3 bottom-3 flex gap-1.5">
                    <span className={cn("rounded-[4px] border border-white/70 px-2 py-1 text-[12px]", i === 1 && "ring-2 ring-amber-300 ring-offset-2 ring-offset-[#0b5cad]")}>
                      {W.jalankan}
                    </span>
                    <span className="rounded-[4px] bg-white/20 px-2 py-1 text-[12px]">{W.jangan}</span>
                  </div>
                ) : null}
              </div>
              <p className="flex items-start gap-2.5 text-[15px]">
                <span className="t-angka grid size-6 shrink-0 place-items-center rounded-full bg-grafit text-[13px] font-bold text-grafit-label">{i + 1}</span>
                {l}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="kaca rounded-[22px] p-4">
        <h2 className="t-subjudul font-semibold text-label-2">{U.sidik}</h2>
        <p className="mt-1 font-mono text-[13px] break-all">{sha256}</p>
      </section>
    </div>
  );
}
