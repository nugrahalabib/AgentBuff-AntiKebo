"use client";

import { Lamp, Lock, MessageCircle, Monitor, Plus, Smartphone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Saklar, Spanduk, TautanTombol } from "@/components/ui/dasar";
import { Kebo } from "@/components/ui/kebo";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { WARNA_KARAKTER, type RingkasAlarm, type RingkasPerangkat, type StatusSuara } from "@/lib/tampilan/jenis";

/**
 * Beranda / tab Alarm (docs/04-DESAIN.md §4.1): sapaan, kartu alarm berikutnya (jam sangat besar,
 * judul agenda, hitung mundur, status perangkat siaga), lalu alarm lainnya dengan sakelar.
 */
export function LayarBeranda({
  sapaan,
  berikutnya,
  sisa,
  lainnya,
  perangkat,
  hrefTambah,
  hrefSiaga,
  ubahAktif,
}: {
  sapaan: string;
  berikutnya: RingkasAlarm | null;
  sisa: { jam: number; menit: number } | null;
  lainnya: RingkasAlarm[];
  perangkat: RingkasPerangkat[];
  hrefTambah: string;
  hrefSiaga: string;
  ubahAktif?: (id: string, aktif: boolean) => void;
}) {
  const { t } = useKamus();
  const B = t.beranda;
  const tanpaSiaga = perangkat.every((p) => !p.siapMalamIni);
  const kosong = !berikutnya && lainnya.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <h1 className="t-judul-besar muncul min-w-0 flex-1">{sapaan}</h1>
        <Link href={hrefTambah} aria-label={t.navigasi.tambah} className="tekan grid size-11 shrink-0 place-items-center rounded-full bg-grafit text-grafit-label lg:hidden">
          <Plus size={22} strokeWidth={2.4} />
        </Link>
      </header>

      {!kosong && tanpaSiaga ? (
        <Spanduk
          judul={B.tanpaSiagaJudul}
          isi={B.tanpaSiagaIsi}
          aksi={
            <TautanTombol href={hrefSiaga} ukuran="sedang">
              {B.tanpaSiagaTombol}
            </TautanTombol>
          }
        />
      ) : null}

      {kosong ? (
        <div className="muncul flex flex-col items-center px-6 py-14 text-center">
          <Kebo pose="tidur" ukuran={132} />
          <h2 className="t-judul-2 mt-6">{B.kosongJudul}</h2>
          <p className="t-isi mt-2 max-w-[32ch] text-label-2">{B.kosongIsi}</p>
          <TautanTombol href={hrefTambah} ukuran="besar" className="mt-7">
            <Plus size={20} strokeWidth={2.4} />
            {B.pasang}
          </TautanTombol>
        </div>
      ) : null}

      {berikutnya ? (
        <section aria-labelledby="judul-berikutnya" className="muncul kaca-kuat rounded-[30px] p-6 sm:p-7">
          <h2 id="judul-berikutnya" className="t-subjudul font-semibold text-label-2">
            {B.berikutnya}
          </h2>
          <p className="t-jam mt-2 text-[88px] sm:text-[104px]">{berikutnya.jam}</p>
          <p className="t-judul-2 mt-1">{berikutnya.judul}</p>
          {sisa ? <p className="t-isi mt-1 text-label-2">{sisa.jam > 0 ? isi(B.lagiJam, { jam: sisa.jam, menit: sisa.menit }) : isi(B.lagiMenit, { menit: sisa.menit })}</p> : null}
          <ul className="mt-5 flex flex-wrap gap-2">
            {perangkat.map((p) => (
              <li key={p.id} className="flex h-9 items-center gap-2 rounded-full bg-kaca-isi px-3.5 text-[14px] font-semibold">
                <span aria-hidden className={cn("size-2.5 rounded-full", p.siapMalamIni ? "bg-toska-isi" : "bg-label-3/50")} />
                {p.jenis === "pc" ? <Monitor size={15} strokeWidth={1.75} /> : <Smartphone size={15} strokeWidth={1.75} />}
                <span className={p.siapMalamIni ? "text-label" : "text-label-2"}>{isi(p.siapMalamIni ? B.siaga : B.belumSiaga, { nama: p.nama })}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Rincian alarm={berikutnya} />
          </div>
        </section>
      ) : null}

      {lainnya.length ? (
        <section aria-labelledby="judul-lainnya" className="flex flex-col gap-2">
          <h2 id="judul-lainnya" className="t-subjudul px-1 font-semibold text-label-2">
            {B.lainnya}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {lainnya.map((a) => (
              <KartuAlarm key={a.id} alarm={a} ubahAktif={ubahAktif} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function KartuAlarm({ alarm, ubahAktif }: { alarm: RingkasAlarm; ubahAktif?: (id: string, aktif: boolean) => void }) {
  const { t } = useKamus();
  const [aktif, setAktif] = useState(alarm.aktif);
  return (
    <li className={cn("kaca flex items-center gap-4 rounded-[22px] py-4 pr-4 pl-5", !aktif && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <p className="t-jam text-[40px]">{alarm.jam}</p>
        <p className="t-kepala truncate">{alarm.judul}</p>
        <p className="t-subjudul truncate text-label-2">{alarm.uraianUlang}</p>
        <div className="mt-2">
          <Rincian alarm={alarm} ringkas />
        </div>
      </div>
      <Saklar
        nyala={aktif}
        label={isi(t.beranda.aktifkan, { judul: alarm.judul })}
        nonaktif={!!alarm.terkunciSampai}
        ubah={(v) => {
          setAktif(v);
          ubahAktif?.(alarm.id, v);
        }}
      />
    </li>
  );
}

/** Ikon kecil: karakter suara, kanal, lampu, gembok Komitmen + status suara. */
function Rincian({ alarm, ringkas }: { alarm: RingkasAlarm; ringkas?: boolean }) {
  const { t } = useKamus();
  const B = t.beranda;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-medium text-label-2">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-[4px]" style={{ background: WARNA_KARAKTER[alarm.karakter] }} />
        {t.karakter[alarm.karakter].nama}
      </span>
      {alarm.jumlahKanal ? (
        <span className="flex items-center gap-1">
          <MessageCircle size={14} strokeWidth={1.75} />
          {isi(B.kanal, { n: alarm.jumlahKanal })}
        </span>
      ) : null}
      {alarm.tuya ? (
        <span className="flex items-center gap-1">
          <Lamp size={14} strokeWidth={1.75} />
          {B.lampu}
        </span>
      ) : null}
      {alarm.terkunciSampai ? (
        <span className="flex items-center gap-1">
          <Lock size={14} strokeWidth={1.75} />
          {isi(B.terkunci, { jam: alarm.terkunciSampai })}
        </span>
      ) : null}
      <StatusSuaraTeks suara={alarm.suara} ringkas={ringkas} />
    </div>
  );
}

function StatusSuaraTeks({ suara, ringkas }: { suara: StatusSuara; ringkas?: boolean }) {
  const { t } = useKamus();
  if (suara.status === "siap") return <span className="text-toska">{t.beranda.suaraSiap}</span>;
  if (suara.status === "dibuat") return <span>{isi(t.beranda.suaraDibuat, { n: suara.n, total: suara.total })}</span>;
  return <span className={cn("text-waspada", ringkas && "basis-full")}>{t.beranda.suaraBelum}</span>;
}
