"use client";

import { Lamp, Lock, MessageCircle, Monitor, Plus, SkipForward, Smartphone, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { kelasTombol, Saklar, Spanduk, TautanTombol } from "@/components/ui/dasar";
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
  spanduk,
  buka,
  tambah,
  aksiKartu,
}: {
  sapaan: string;
  berikutnya: RingkasAlarm | null;
  sisa: { jam: number; menit: number } | null;
  lainnya: RingkasAlarm[];
  perangkat: RingkasPerangkat[];
  hrefTambah: string;
  hrefSiaga?: string;
  ubahAktif?: (id: string, aktif: boolean) => void;
  /** Spanduk masalah lain (izin AgentBuff, kunci rumah pintar) di atas kartu. */
  spanduk?: ReactNode;
  /** Buka lembar Ubah alarm untuk kartu ini. */
  buka?: (id: string) => void;
  /** Buka lembar alarm baru (tanpa pindah halaman). */
  tambah?: () => void;
  /** Geser kartu di HP: lewati sekali dan hapus. */
  aksiKartu?: { lewati: (id: string) => void; hapus: (id: string) => void };
}) {
  const { t } = useKamus();
  const B = t.beranda;
  const tanpaSiaga = perangkat.every((p) => !p.siapMalamIni);
  const kosong = !berikutnya && lainnya.length === 0;
  const tombolTambah = (kelas: string, isiTombol: ReactNode, label?: string) =>
    tambah ? (
      <button type="button" onClick={tambah} aria-label={label} className={kelas}>
        {isiTombol}
      </button>
    ) : (
      <Link href={hrefTambah} aria-label={label} className={kelas}>
        {isiTombol}
      </Link>
    );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <h1 className="t-judul-besar muncul min-w-0 flex-1">{sapaan}</h1>
        {tombolTambah("tekan grid size-11 shrink-0 place-items-center rounded-full bg-grafit text-grafit-label lg:hidden", <Plus size={22} strokeWidth={2.4} />, t.navigasi.tambah)}
      </header>

      {spanduk}
      {!kosong && tanpaSiaga ? (
        <Spanduk
          judul={B.tanpaSiagaJudul}
          isi={B.tanpaSiagaIsi}
          aksi={
            hrefSiaga ? (
              <TautanTombol href={hrefSiaga} ukuran="sedang">
                {B.tanpaSiagaTombol}
              </TautanTombol>
            ) : undefined
          }
        />
      ) : null}

      {kosong ? (
        <div className="muncul flex flex-col items-center px-6 py-14 text-center">
          <Kebo pose="tidur" ukuran={132} />
          <h2 className="t-judul-2 mt-6">{B.kosongJudul}</h2>
          <p className="t-isi mt-2 max-w-[32ch] text-label-2">{B.kosongIsi}</p>
          {tombolTambah(
            kelasTombol("utama", "besar", "mt-7"),
            <>
              <Plus size={20} strokeWidth={2.4} />
              {B.pasang}
            </>,
          )}
        </div>
      ) : null}

      {berikutnya ? (
        <section aria-labelledby="judul-berikutnya" className="muncul kaca-kuat relative rounded-[30px] p-6 sm:p-7">
          {buka ? (
            <button type="button" onClick={() => buka(berikutnya.id)} aria-label={isi(B.ubahAlarm, { judul: berikutnya.judul })} className="absolute inset-0 rounded-[30px]" />
          ) : null}
          <div className="flex items-start gap-3">
            <h2 id="judul-berikutnya" className="t-subjudul min-w-0 flex-1 font-semibold text-label-2">
              {B.berikutnya}
            </h2>
            {ubahAktif ? (
              <span className="relative">
                <SaklarAlarm alarm={berikutnya} ubahAktif={ubahAktif} />
              </span>
            ) : null}
          </div>
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
              <KartuAlarm key={a.id} alarm={a} ubahAktif={ubahAktif} buka={buka} aksi={aksiKartu} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SaklarAlarm({ alarm, ubahAktif }: { alarm: RingkasAlarm; ubahAktif?: (id: string, aktif: boolean) => void }) {
  const { t } = useKamus();
  return (
    <Saklar nyala={alarm.aktif} label={isi(t.beranda.aktifkan, { judul: alarm.judul })} nonaktif={!!alarm.terkunciSampai && alarm.aktif} ubah={(v) => ubahAktif?.(alarm.id, v)} />
  );
}

const LEBAR_AKSI = 168;

function KartuAlarm({
  alarm,
  ubahAktif,
  buka,
  aksi,
}: {
  alarm: RingkasAlarm;
  ubahAktif?: (id: string, aktif: boolean) => void;
  buka?: (id: string) => void;
  aksi?: { lewati: (id: string) => void; hapus: (id: string) => void };
}) {
  const { t } = useKamus();
  const B = t.beranda;
  const [geser, setGeser] = useState(0);
  const awal = useRef<{ x: number; y: number; geser: number; arah: "x" | "y" | null } | null>(null);
  const terbuka = geser <= -LEBAR_AKSI / 2;

  // Geser ke kiri di layar sentuh (docs/04-DESAIN.md §4.1) membuka "Lewati sekali" dan "Hapus".
  const sentuh = aksi
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          if (e.pointerType !== "touch") return;
          awal.current = { x: e.clientX, y: e.clientY, geser, arah: null };
        },
        onPointerMove: (e: React.PointerEvent) => {
          const a = awal.current;
          if (!a) return;
          const dx = e.clientX - a.x;
          if (!a.arah) a.arah = Math.abs(dx) > Math.abs(e.clientY - a.y) + 4 ? "x" : Math.abs(e.clientY - a.y) > 8 ? "y" : null;
          if (a.arah === "x") setGeser(Math.max(-LEBAR_AKSI, Math.min(0, a.geser + dx)));
        },
        onPointerUp: () => {
          if (awal.current?.arah === "x") setGeser((g) => (g < -LEBAR_AKSI / 3 ? -LEBAR_AKSI : 0));
          awal.current = null;
        },
        onPointerCancel: () => {
          awal.current = null;
          setGeser((g) => (g < -LEBAR_AKSI / 3 ? -LEBAR_AKSI : 0));
        },
      }
    : {};

  return (
    <li className="relative">
      {aksi && geser < 0 ? (
        <div className="absolute inset-y-0 right-0 flex items-stretch gap-1.5 py-1" style={{ width: LEBAR_AKSI }}>
          <button
            type="button"
            tabIndex={terbuka ? 0 : -1}
            onClick={() => (setGeser(0), aksi.lewati(alarm.id))}
            className="tekan flex flex-1 flex-col items-center justify-center gap-1 rounded-[18px] bg-waspada-isi text-[13px] font-semibold text-[#2b1700]"
          >
            <SkipForward size={18} />
            {B.lewati}
          </button>
          <button
            type="button"
            tabIndex={terbuka ? 0 : -1}
            onClick={() => (setGeser(0), aksi.hapus(alarm.id))}
            className="tekan flex flex-1 flex-col items-center justify-center gap-1 rounded-[18px] bg-bahaya-isi text-[13px] font-semibold text-white"
          >
            <Trash2 size={18} />
            {B.hapus}
          </button>
        </div>
      ) : null}
      <div
        {...sentuh}
        style={geser ? { transform: `translateX(${geser}px)` } : undefined}
        className={cn("kaca relative flex touch-pan-y items-center gap-4 rounded-[22px] py-4 pr-4 pl-5 transition-transform duration-200", !alarm.aktif && "opacity-60")}
      >
        {buka ? (
          <button
            type="button"
            onClick={() => (geser ? setGeser(0) : buka(alarm.id))}
            aria-label={isi(B.ubahAlarm, { judul: alarm.judul })}
            className="absolute inset-0 rounded-[22px]"
          />
        ) : null}
        <div className="pointer-events-none relative min-w-0 flex-1">
          <p className="t-jam text-[40px]">{alarm.jam}</p>
          <p className="t-kepala truncate">{alarm.judul}</p>
          <p className="t-subjudul truncate text-label-2">{alarm.uraianUlang}</p>
          <div className="mt-2">
            <Rincian alarm={alarm} ringkas />
          </div>
        </div>
        <span className="relative">
          <SaklarAlarm alarm={alarm} ubahAktif={ubahAktif} />
        </span>
      </div>
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
