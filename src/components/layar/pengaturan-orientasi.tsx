"use client";

import {
  Bell,
  Bot,
  Check,
  ChevronLeft,
  Globe,
  Languages,
  Lamp,
  MessageCircle,
  Mic,
  Minus,
  Monitor,
  Moon,
  Palette,
  Play,
  QrCode,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Smartphone,
  Square,
  Trash2,
  User,
  Volume2,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Saklar, Tombol } from "@/components/ui/dasar";
import { BarisGrup, Grup } from "@/components/ui/grup";
import { Kebo } from "@/components/ui/kebo";
import { Logo } from "@/components/ui/ikon";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { useDengarContoh } from "@/lib/klien/dengar";
import { DAFTAR_KARAKTER, WARNA_KARAKTER, type IdKarakter } from "@/lib/tampilan/jenis";
import { gerakRadio } from "@/lib/klien/radio";

/** Pengaturan lengkap (docs/04-DESAIN.md §4.10): daftar bergrup gaya iOS. */
export function LayarPengaturan({
  nama,
  zona,
  bahasa,
  jamTidur,
  tema,
  karakter,
  jumlahKanal,
  tuya,
  jumlahQr,
  jumlahToken,
  href,
}: {
  nama: string;
  zona: string;
  bahasa: string;
  jamTidur: string;
  tema: "sistem" | "terang" | "gelap";
  karakter: IdKarakter;
  jumlahKanal: number;
  tuya: boolean;
  jumlahQr: number;
  jumlahToken: number;
  href: (bagian: string) => string;
}) {
  const { t } = useKamus();
  const P = t.pengaturanLengkap;
  const [malam, setMalam] = useState(true);
  return (
    <div className="flex flex-col gap-7">
      <h1 className="t-judul-besar muncul pt-2">{t.pengaturan.judul}</h1>

      <Grup judul={P.kamu} id="g-kamu">
        <BarisGrup ikon={User} warnaIkon="#6366f1" label={P.namaPanggilan} nilai={nama} href={href("nama")} />
        <BarisGrup ikon={Globe} warnaIkon="#0ea5e9" label={P.zona} nilai={zona} href={href("zona")} />
        <BarisGrup ikon={Languages} warnaIkon="#10b981" label={P.bahasa} nilai={bahasa} href={href("bahasa")} />
        <BarisGrup ikon={Moon} warnaIkon="#4338ca" label={P.jamTidur} nilai={jamTidur} href={href("tidur")} />
        <BarisGrup ikon={Palette} warnaIkon="#ec4899" label={P.tema} nilai={P.temaPilihan[tema]} href={href("tema")} />
      </Grup>

      <Grup judul={P.bawaan} id="g-bawaan">
        <BarisGrup ikon={SlidersHorizontal} warnaIkon="#f59e0b" label={P.bawaan} nilai={t.karakter[karakter].nama} href={href("bawaan")} />
        <BarisGrup ikon={Bell} warnaIkon="#ef4444" label={P.pengingatMalam} kanan={<Saklar nyala={malam} ubah={setMalam} label={P.pengingatMalam} />} />
      </Grup>

      <Grup judul={t.navigasi.siaga} id="g-sambungan">
        <BarisGrup ikon={MessageCircle} warnaIkon="#0284c7" label={P.kanal} nilai={String(jumlahKanal)} href={href("kanal")} />
        <BarisGrup ikon={Mic} warnaIkon="#7c3aed" label={P.suara} href={href("suara")} />
        <BarisGrup ikon={Lamp} warnaIkon="#eab308" label={P.rumah} nilai={tuya ? P.tersambung : P.belumTersambung} href={href("rumah")} />
        <BarisGrup ikon={QrCode} warnaIkon="#334155" label={P.kodeQr} nilai={String(jumlahQr)} href={href("qr")} />
        <BarisGrup ikon={Bot} warnaIkon="#0f766e" label={P.agen} nilai={String(jumlahToken)} href={href("agen")} />
      </Grup>

      <Grup>
        <BarisGrup ikon={RotateCcw} warnaIkon="#64748b" label={P.ulangOrientasi} href={href("orientasi")} />
        <BarisGrup ikon={Shield} warnaIkon="#16a34a" label={P.privasi} href={href("privasi")} />
        <BarisGrup ikon={Trash2} warnaIkon="#dc2626" label={P.hapusData} bahaya href={href("hapus")} />
      </Grup>
    </div>
  );
}

/** Isi yang disimpan per langkah orientasi. */
export type IsiOrientasi = { nama: string; karakter: IdKarakter };

/**
 * Orientasi (docs/04-DESAIN.md §4.11, PRD J): satu ide per halaman, titik kemajuan, "Nanti" di
 * langkah opsional (3 sampai 6). Presentasional: isi langkah perangkat, kanal, dan rumah lewat slot;
 * penyimpanan lewat `simpan` (false = tetap di langkah ini) dan `selesai` (uji = bunyikan alarm uji).
 */
export function LayarOrientasi({
  langkah: awal = 0,
  nama: namaAwal = "",
  karakter: karakterAwal = "pelatih_tentara",
  perangkat,
  kanal,
  rumah,
  simpan,
  selesai,
  ubahLangkah,
  proses = false,
  galat = null,
}: {
  langkah?: number;
  nama?: string;
  karakter?: IdKarakter;
  perangkat?: ReactNode;
  kanal?: ReactNode;
  rumah?: ReactNode;
  simpan?: (langkah: number, isi: IsiOrientasi) => Promise<boolean>;
  selesai?: (uji: boolean) => void;
  ubahLangkah?: (langkah: number) => void;
  proses?: boolean;
  galat?: string | null;
}) {
  const { t, b } = useKamus();
  const O = t.orientasi;
  const [langkah, setLangkah] = useState(awal);
  const [nama, setNama] = useState(namaAwal);
  const [karakter, setKarakter] = useState<IdKarakter>(karakterAwal);
  const { diputar, dengar } = useDengarContoh(b);
  const total = 6;
  const terakhir = langkah === total - 1;
  const opsional = langkah >= 2;

  const pindah = (l: number) => {
    setLangkah(l);
    ubahLangkah?.(l);
  };
  const lanjut = async () => {
    if (terakhir) return selesai?.(true);
    if (simpan && !(await simpan(langkah, { nama: nama.trim(), karakter }))) return;
    pindah(langkah + 1);
  };
  const nanti = () => (terakhir ? selesai?.(false) : pindah(langkah + 1));

  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col px-5 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {langkah > 0 ? (
            <button type="button" onClick={() => pindah(langkah - 1)} aria-label={t.umum.kembali} className="tekan -ml-2 grid size-11 place-items-center rounded-full text-label-2">
              <ChevronLeft size={22} />
            </button>
          ) : null}
          <div className="flex gap-1.5" role="img" aria-label={isi(O.langkahKe, { ke: langkah + 1, dari: total })}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={cn("h-2 rounded-full transition-all", i === langkah ? "w-6 bg-grafit" : "w-2 bg-label-3/40")} />
            ))}
          </div>
        </div>
        {opsional ? (
          <Tombol varian="polos" ukuran="kecil" disabled={proses} onClick={nanti}>
            {O.nanti}
          </Tombol>
        ) : null}
      </div>

      <div className="muncul flex flex-1 flex-col items-center justify-center py-8 text-center" key={langkah}>
        {langkah === 0 ? (
          <>
            <Kebo pose="segar" ukuran={150} />
            <h1 className="t-judul-1 mt-6">{O.sambutanJudul}</h1>
            <p className="t-isi mt-2 max-w-[34ch] text-label-2">{O.sambutanIsi}</p>
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nama.trim()) void lanjut();
              }}
              maxLength={30}
              placeholder={O.namaContoh}
              aria-label={O.namaContoh}
              className="kaca mt-7 h-14 w-full max-w-[340px] rounded-[18px] px-5 text-center text-[20px] font-semibold outline-none placeholder:font-normal placeholder:text-label-2 focus-visible:ring-2 focus-visible:ring-aksen-isi"
            />
          </>
        ) : langkah === 1 ? (
          <>
            <h1 className="t-judul-1">{O.karakterJudul}</h1>
            <ul role="radiogroup" onKeyDown={gerakRadio} aria-label={O.karakterJudul} className="mt-6 grid w-full grid-cols-2 gap-2.5">
              {DAFTAR_KARAKTER.filter((k) => k !== "kustom").map((id) => {
                const contoh = isi(t.karakter[id].contoh, { nama: nama.trim() || O.kamu });
                return (
                  <li key={id} className="relative">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={karakter === id}
                      onClick={() => setKarakter(id)}
                      className={cn(
                        "tekan flex h-full w-full flex-col items-start rounded-[20px] p-4 pb-14 text-left",
                        karakter === id ? "kaca-kuat outline-2 outline-toska-isi" : "kaca",
                      )}
                    >
                      <span aria-hidden className="size-8 rounded-[10px]" style={{ background: WARNA_KARAKTER[id] }} />
                      <span className="mt-2 text-[15px] font-semibold">{t.karakter[id].nama}</span>
                      <span className="t-keterangan text-label-2">{contoh}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => dengar(id, contoh)}
                      aria-label={isi(t.ubah.dengar, { nama: t.karakter[id].nama })}
                      className="tekan absolute bottom-3 left-4 grid size-9 place-items-center rounded-full bg-grafit text-grafit-label"
                    >
                      {diputar === id ? <Square size={13} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : langkah === 2 ? (
          <>
            <h1 className="t-judul-1">{O.perangkatJudul}</h1>
            {perangkat ?? (
              <div className="mt-6 flex w-full flex-col gap-2.5">
                <Tombol ukuran="besar">
                  <Monitor size={19} />
                  {t.siaga.pasangPc}
                </Tombol>
                <Tombol ukuran="besar" varian="kaca">
                  <Smartphone size={19} />
                  {t.siaga.jadikanJamMeja}
                </Tombol>
              </div>
            )}
          </>
        ) : langkah === 3 ? (
          <>
            <h1 className="t-judul-1">{O.kanalJudul}</h1>
            {kanal}
          </>
        ) : langkah === 4 ? (
          <>
            <h1 className="t-judul-1">{O.rumahJudul}</h1>
            {rumah}
          </>
        ) : (
          <>
            <Kebo pose="kaget" ukuran={130} />
            <h1 className="t-judul-1 mt-6">{O.ujiJudul}</h1>
            <p className="t-isi mt-2 max-w-[34ch] text-label-2">{O.ujiIsi}</p>
          </>
        )}
      </div>

      {galat ? (
        <p role="alert" data-pesan-galat className="t-subjudul mb-3 text-center text-bahaya">
          {galat}
        </p>
      ) : null}
      <Tombol ukuran="besar" className="w-full" onClick={() => void lanjut()} disabled={proses || (langkah === 0 && !nama.trim())}>
        {proses ? t.umum.menyimpan : terakhir ? O.ujiTombol : O.lanjut}
      </Tombol>
    </main>
  );
}

/** Jendela pengaturan kecil AntiKebo untuk PC (docs/04-DESAIN.md §4.8). Ditampilkan dalam bingkai jendela. */
export function JendelaPc({ akun, versi, tersambung }: { akun: string; versi: string; tersambung: boolean }) {
  const { t } = useKamus();
  const C = t.pc;
  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[14px] bg-[#f5f5f7] text-[#1d1d1f] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/10 dark:bg-[#1c1c1e] dark:text-white dark:ring-white/10">
      <div aria-hidden className="flex h-9 items-center justify-between bg-black/5 px-3 dark:bg-white/5">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <Logo ukuran={18} />
          {C.judul}
        </span>
        <span className="flex gap-3 opacity-60">
          <Minus size={14} />
          <X size={14} />
        </span>
      </div>
      <div className="flex flex-col items-center px-6 pt-7 pb-6 text-center">
        <Logo ukuran={64} />
        {tersambung ? (
          <p className="mt-4 flex items-center gap-2 text-[16px] font-semibold text-[#0b6e69] dark:text-[#5eead4]">
            <Check size={18} strokeWidth={2.8} />
            {isi(C.tersambung, { nama: akun })}
          </p>
        ) : (
          <button type="button" className="tekan mt-5 h-11 rounded-full bg-[#1d1d1f] px-6 text-[15px] font-semibold text-white dark:bg-white dark:text-[#111]">
            {C.sambung}
          </button>
        )}
        <section className="mt-6 w-full text-left">
          <h2 className="text-[13px] font-semibold opacity-70">{C.periksa}</h2>
          <ul className="mt-2 divide-y divide-black/10 rounded-[12px] bg-white dark:divide-white/10 dark:bg-white/5">
            {[C.mulaiWindows, C.tidakTidur].map((b) => (
              <li key={b} className="flex items-center gap-2.5 px-3.5 py-3 text-[14px]">
                <span className="grid size-5 place-items-center rounded-full bg-[#14b8a6] text-white">
                  <Check size={13} strokeWidth={3} />
                </span>
                {b}
              </li>
            ))}
            <li className="flex items-center gap-2.5 px-3.5 py-3 text-[14px]">
              <Volume2 size={18} strokeWidth={1.75} />
              <span className="flex-1">{C.dengar}</span>
              <button type="button" className="tekan rounded-full bg-[#1d1d1f] px-3 py-1.5 text-[13px] font-semibold text-white dark:bg-white dark:text-[#111]">
                {C.ya}
              </button>
              <button type="button" className="tekan rounded-full bg-black/8 px-3 py-1.5 text-[13px] font-semibold dark:bg-white/10">
                {C.tidak}
              </button>
            </li>
          </ul>
        </section>
        <p className="mt-5 text-[13px] opacity-60">{isi(C.versi, { v: versi })}</p>
      </div>
    </div>
  );
}
