"use client";

import { Check, ChevronLeft, ClipboardPaste, Copy, ExternalLink, House, KeyRound, Laptop, Plus, QrCode, ScanLine, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Tombol, TautanTombol } from "@/components/ui/dasar";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { api, type GalatApi } from "@/lib/app/toko";
import { bacaKunci } from "@/lib/tuya/wilayah";

type Hasil = { rumah: number; ruangan: number; perangkat: number; online: number; wilayah: { kode: string; nama: string } };

/** Langsung ke halaman masuk resmi (tujuan tombol "Get API Key" di tuya.ai/developer); sesudah masuk Tuya membuka Hey Tuya. */
const MASUK_TUYA = "https://auth.tuya.ai/login?loginSource=web_hey_tuya";

function berlanggananLayar(cb: () => void) {
  const m = window.matchMedia("(pointer: coarse) and (max-width: 820px)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/** Ponsel = layar sentuh kecil: QR di tuya.ai tidak bisa dipindai dari layar yang sama. */
function useDiPonsel() {
  return useSyncExternalStore(
    berlanggananLayar,
    () => window.matchMedia("(pointer: coarse) and (max-width: 820px)").matches,
    () => false,
  );
}

export function Wizard({ perbarui }: { perbarui: boolean }) {
  const { t } = useKamus();
  const W = t.sambungkan;
  const [langkah, setLangkah] = useState(perbarui ? 2 : 1);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const diPonsel = useDiPonsel();

  const judulLangkah = [W.l1.judul, W.l2.judul, W.l3.judul];
  if (hasil) return <Berhasil hasil={hasil} />;

  return (
    <div className="mx-auto max-w-[620px] pt-14 sm:pt-10">
      <div className="muncul mb-8 text-center">
        <p className="t-kapsi text-label-2 uppercase">{isi(W.langkah, { n: langkah })}</p>
        <h1 className="t-judul-besar mt-2">{perbarui ? W.perbarui.judul : W.judul}</h1>
        <p className="t-subjudul mx-auto mt-2 max-w-[46ch] text-label-2">{perbarui ? W.perbarui.sub : W.sub}</p>
        <ol className="mt-6 flex items-center justify-center gap-2" aria-label={W.judul}>
          {[1, 2, 3].map((n) => (
            <li
              key={n}
              aria-current={n === langkah ? "step" : undefined}
              aria-label={judulLangkah[n - 1]}
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: n === langkah ? 36 : 8, background: n <= langkah ? "var(--aksen-isi)" : "var(--kaca-isi)", transitionTimingFunction: "var(--ease-pegas)" }}
            />
          ))}
        </ol>
      </div>

      <div key={langkah} className="muncul kaca-kuat rounded-[32px] p-6 sm:p-8">
        {langkah === 1 ? <Langkah1 lanjut={() => setLangkah(2)} /> : null}
        {langkah === 2 ? <Langkah2 diPonsel={diPonsel} lanjut={() => setLangkah(3)} /> : null}
        {langkah === 3 ? <Langkah3 selesai={setHasil} /> : null}
      </div>

      {langkah > (perbarui ? 2 : 1) ? (
        <div className="mt-4 text-center">
          <Tombol varian="polos" ukuran="kecil" onClick={() => setLangkah((l) => l - 1)}>
            <ChevronLeft size={16} />
            {t.umum.kembali}
          </Tombol>
        </div>
      ) : null}
      <p className="t-keterangan mx-auto mt-6 max-w-[52ch] text-center text-label-3">{t.merek.bukanAfiliasi}</p>
    </div>
  );
}

// -------------------------------------------------------------- langkah 1

function Langkah1({ lanjut }: { lanjut: () => void }) {
  const { t } = useKamus();
  const L = t.sambungkan.l1;
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-6 h-[150px] w-[118px] rounded-[28px] bg-label/90 p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] dark:bg-white/15">
        <div className="grid h-full grid-cols-2 content-start gap-2 rounded-[21px] bg-[linear-gradient(160deg,#e8f1ff,#f6ecff)] p-2.5">
          <span className="grid aspect-square place-items-center rounded-[12px] bg-[#1d8cf8] text-white shadow-md">
            <House size={20} />
          </span>
          <span className="grid aspect-square place-items-center rounded-[12px] bg-[#ff5a00] text-[15px] font-black text-white shadow-md">T</span>
          <span className="col-span-2 mt-1 h-2 rounded-full bg-black/10" />
          <span className="col-span-2 h-2 w-2/3 rounded-full bg-black/10" />
        </div>
      </div>
      <h2 className="t-judul-2">{L.judul}</h2>
      <p className="t-isi mt-3 max-w-[44ch] text-label-2">{L.isi}</p>
      <div className="mt-4 flex gap-2">
        <span className="kaca rounded-full px-3 py-1 text-[13px] font-semibold">{L.app1}</span>
        <span className="kaca rounded-full px-3 py-1 text-[13px] font-semibold">{L.app2}</span>
      </div>
      <Tombol ukuran="besar" className="mt-8 w-full sm:w-auto" onClick={lanjut}>
        <Check size={18} />
        {L.tombol}
      </Tombol>
      <p className="t-keterangan mt-4 max-w-[44ch] text-label-3">{L.belum}</p>
    </div>
  );
}

// -------------------------------------------------------------- langkah 2

/** Label tombol di tuya.ai apa adanya (bahasa Inggris di situs Tuya) - sengaja tidak diterjemahkan. */
const LABEL_TUYA = { appTuya: "Tuya APP", appSmartLife: "SmartLife APP", toolbox: "Toolbox", apiKey: "API Key", hey: "Hey Tuya", buat: "Create", contohKunci: "sk-SG••••" };

/** Ilustrasi kecil per sub-langkah tuya.ai (bukan tangkapan layar: tidak basi saat tuya.ai berubah warna). */
function Ilustrasi({ n }: { n: number }) {
  const bingkai = "grid h-[72px] w-[92px] shrink-0 place-items-center rounded-[16px] bg-[linear-gradient(150deg,#16162a,#262650)] text-white";
  const terang = "bg-[linear-gradient(150deg,#f3f3fb,#e8ecff)] text-black";
  if (n === 0)
    return (
      <span className={cn(bingkai, terang, "gap-1 px-2")} aria-hidden>
        <span className="w-full rounded-full bg-white px-2 py-0.5 text-center text-[9px] font-semibold shadow-sm">{LABEL_TUYA.appTuya}</span>
        <span className="w-full rounded-full bg-white px-2 py-0.5 text-center text-[9px] font-semibold text-[#1d8cf8] shadow-sm ring-2 ring-[#1d8cf8]">{LABEL_TUYA.appSmartLife}</span>
      </span>
    );
  if (n === 1)
    return (
      <span className={cn(bingkai, terang, "relative")} aria-hidden>
        <QrCode size={34} />
        <span className="absolute -right-1.5 -bottom-1.5 grid size-8 place-items-center rounded-[10px] bg-[#1d8cf8] text-white shadow-md">
          <ScanLine size={16} />
        </span>
      </span>
    );
  if (n === 2)
    return (
      <span className={cn(bingkai, "flex flex-col items-stretch justify-center gap-1 px-2")} aria-hidden>
        <span className="rounded-[6px] px-1.5 py-0.5 text-[9px] text-white/60">{LABEL_TUYA.hey}</span>
        <span className="rounded-[6px] bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold">{LABEL_TUYA.toolbox}</span>
        <span className="ml-2 rounded-[6px] bg-[#8b7cff] px-1.5 py-0.5 text-[9px] font-bold">{LABEL_TUYA.apiKey}</span>
      </span>
    );
  if (n === 3)
    return (
      <span className={bingkai} aria-hidden>
        <span className="flex items-center gap-1 rounded-full bg-[#8b7cff] px-2.5 py-1 text-[10px] font-bold">
          <Plus size={11} />
          {LABEL_TUYA.buat}
        </span>
      </span>
    );
  return (
    <span className={cn(bingkai, "flex gap-1.5 px-2")} aria-hidden>
      <span className="font-mono text-[11px]">{LABEL_TUYA.contohKunci}</span>
      <Copy size={13} />
    </span>
  );
}

function Langkah2({ lanjut, diPonsel }: { lanjut: () => void; diPonsel: boolean }) {
  const { t } = useKamus();
  const L = t.sambungkan.l2;
  const [tersalin, setTersalin] = useState(false);
  const salinTautan = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      /* clipboard ditolak: tautan tetap terlihat di bilah alamat */
    }
  };
  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-[18px] text-white" style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
          <KeyRound size={26} />
        </span>
        <div>
          <h2 className="t-judul-2">{L.judul}</h2>
          <p className="t-subjudul mt-1 text-label-2">{L.isi}</p>
        </div>
      </div>

      {diPonsel ? (
        <div className="mt-6 flex gap-3 rounded-[20px] bg-waspada-isi/15 p-4">
          <Laptop size={22} className="mt-0.5 shrink-0 text-waspada" />
          <div className="min-w-0">
            <p className="t-kepala">{L.hpJudul}</p>
            <p className="t-subjudul mt-1 text-label-2">{L.hpIsi}</p>
            <Tombol varian="kaca" ukuran="kecil" className="mt-3" onClick={salinTautan}>
              {tersalin ? <Check size={15} /> : <Copy size={15} />}
              {tersalin ? t.umum.tersalin : L.hpSalin}
            </Tombol>
          </div>
        </div>
      ) : null}

      <TautanTombol href={MASUK_TUYA} ukuran="besar" className="mt-6 w-full">
        {L.tombol}
        <ExternalLink size={17} />
      </TautanTombol>
      <p className="t-keterangan mt-2 text-center text-label-2">{L.tombolKet}</p>

      <ol className="mt-6 flex flex-col gap-3">
        {L.langkah.map((s, i) => (
          <li key={s.judul} className="flex items-center gap-4 rounded-[20px] bg-kaca-isi p-3">
            <Ilustrasi n={i} />
            <div className="min-w-0">
              <p className="t-kepala">
                <span className="t-angka mr-1.5 text-aksen">{i + 1}.</span>
                {s.judul}
              </p>
              <p className="t-subjudul mt-0.5 text-label-2">{s.isi}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-[20px] bg-kaca-isi p-4">
        <p className="t-kepala">{L.tersesatJudul}</p>
        <p className="t-subjudul mt-1 text-label-2">{L.tersesatIsi}</p>
      </div>
      <p className="t-keterangan mt-4 flex gap-2 text-label-2">
        <Smartphone size={15} className="mt-0.5 shrink-0" />
        {L.google}
      </p>
      <Tombol ukuran="besar" varian="kaca" className="mt-6 w-full" onClick={lanjut}>
        {L.sudah}
      </Tombol>
    </div>
  );
}

// -------------------------------------------------------------- langkah 3

function Langkah3({ selesai }: { selesai: (h: Hasil) => void }) {
  const { t, b } = useKamus();
  const L = t.sambungkan.l3;
  const [kunci, setKunci] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [kirim, setKirim] = useState(false);
  const masukan = useRef<HTMLInputElement>(null);
  const baca = bacaKunci(kunci);

  useEffect(() => {
    masukan.current?.focus();
  }, []);

  const sambungkan = async (nilai: string) => {
    if (kirim) return;
    setGalat(null);
    setKirim(true);
    try {
      selesai(await api<Hasil>("/api/app/sambungan", { method: "POST", json: { kunci: nilai } }));
    } catch (e) {
      setGalat((e as GalatApi).pesan ?? t.umum.galatUmum);
      setKirim(false);
    }
  };

  // Kunci valid ditempel -> langsung disambungkan (pengguna sudah melakukan bagian tersulitnya).
  const ubah = (nilai: string, dariTempel: boolean) => {
    setKunci(nilai);
    setGalat(null);
    if (dariTempel && bacaKunci(nilai).ok) void sambungkan(nilai);
  };

  const tempel = async () => {
    try {
      ubah((await navigator.clipboard.readText()).trim(), true);
    } catch {
      setGalat(L.tempelGagal);
      masukan.current?.focus();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void sambungkan(kunci);
      }}
    >
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-[18px] text-white" style={{ background: "linear-gradient(135deg,#0ea5e9,#22d3ee)" }}>
          <ClipboardPaste size={26} />
        </span>
        <div>
          <h2 className="t-judul-2">{L.judul}</h2>
          <p className="t-subjudul mt-1 text-label-2">{L.isi}</p>
        </div>
      </div>

      <label htmlFor="kunci-rumah" className="t-kapsi mt-7 block text-label-2">
        {L.label}
      </label>
      <div className={cn("mt-2 flex items-center gap-2 rounded-[18px] bg-kaca-isi p-1.5 pl-4 ring-2 transition", galat ? "ring-bahaya-isi" : baca.ok ? "ring-berhasil-isi" : "ring-transparent")}>
        <input
          id="kunci-rumah"
          ref={masukan}
          value={kunci}
          onChange={(e) => ubah(e.target.value, false)}
          onPaste={(e) => {
            const teks = e.clipboardData.getData("text").trim();
            if (teks) {
              e.preventDefault();
              ubah(teks, true);
            }
          }}
          placeholder={L.placeholder}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          disabled={kirim}
          aria-invalid={!!galat}
          aria-describedby="kunci-ket"
          className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-[16px] outline-none placeholder:text-label-3"
        />
        <Tombol varian="kaca" ukuran="kecil" onClick={tempel} disabled={kirim}>
          <ClipboardPaste size={15} />
          {L.tempel}
        </Tombol>
      </div>
      <div id="kunci-ket" className="mt-2 min-h-6" aria-live="polite">
        {galat ? (
          <p data-pesan-galat className="t-subjudul text-bahaya">
            {galat}
          </p>
        ) : baca.ok ? (
          <p className="t-subjudul flex items-center gap-1.5 text-berhasil">
            <Check size={15} strokeWidth={3} />
            {isi(L.wilayah, { wilayah: baca.wilayah.nama[b] })}
          </p>
        ) : null}
      </div>

      <Tombol type="submit" ukuran="besar" className="mt-4 w-full" disabled={kirim || !kunci.trim()}>
        {kirim ? <span className="putar size-5 rounded-full border-[2.5px] border-white/40 border-t-white" /> : null}
        {kirim ? L.memeriksa : L.tombol}
      </Tombol>
      <p className="t-keterangan mt-4 flex gap-2 text-label-2">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-berhasil" />
        {L.aman}
      </p>
    </form>
  );
}

// -------------------------------------------------------------- berhasil

function Berhasil({ hasil }: { hasil: Hasil }) {
  const { t } = useKamus();
  const B = t.sambungkan.berhasil;
  const [tersalin, setTersalin] = useState(false);
  return (
    <div className="mx-auto max-w-[560px] pt-16 text-center">
      <div className="muncul mx-auto grid size-24 place-items-center rounded-full bg-berhasil-isi text-white shadow-[0_20px_50px_-12px_rgba(48,209,88,0.7)]">
        <Check size={46} strokeWidth={3} />
      </div>
      <h1 className="t-judul-besar muncul mt-7 [animation-delay:80ms]">{B.judul}</h1>
      <p className="t-isi muncul mt-3 text-label-2 [animation-delay:140ms]">
        {hasil.perangkat ? isi(B.ringkas, { perangkat: hasil.perangkat, rumah: hasil.rumah, ruangan: hasil.ruangan }) : B.kosong}
      </p>
      <div className="muncul kaca mt-8 rounded-[28px] p-6 text-left [animation-delay:220ms]">
        <p className="t-kepala">{B.agenJudul}</p>
        <p className="t-subjudul mt-1 text-label-2">{B.agenIsi}</p>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(B.contoh);
              setTersalin(true);
              setTimeout(() => setTersalin(false), 2000);
            } catch {
              /* abaikan */
            }
          }}
          className="tekan mt-4 flex w-full items-center gap-3 rounded-[18px] bg-kaca-isi px-4 py-3 text-left"
        >
          <span className="min-w-0 flex-1 text-[16px] font-medium">“{B.contoh}”</span>
          {tersalin ? <Check size={17} className="text-berhasil" /> : <Copy size={17} className="text-label-2" />}
        </button>
      </div>
      <Link href="/app" className="muncul mt-8 inline-flex [animation-delay:300ms]">
        <span className="tekan inline-flex h-[52px] items-center rounded-[16px] bg-aksen-isi px-7 text-[17px] font-semibold text-white">{B.tombol}</span>
      </Link>
    </div>
  );
}
