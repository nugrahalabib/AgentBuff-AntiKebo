"use client";

import { Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LayarBerbunyiBersuara } from "@/components/layar/berbunyi-suara";
import { KartuSoal, type SoalLayar, type Umpan } from "@/components/layar/kartu-soal";
import { LayarMasihBangun, LayarSelamatPagi } from "@/components/layar/pagi-cek";
import { Kebo } from "@/components/ui/kebo";
import { berkasBunyi } from "@/lib/bunyi/berkas";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { panggilApi } from "@/lib/klien/api";
import { useDetik } from "@/lib/klien/jam";
import { usePeristiwa } from "@/lib/klien/peristiwa";
import type { LayarKejadianKlien } from "@/lib/tampilan/alarm-klien";

type Aktif = { id: string; status: string; jadwalUtc: string };
type HasilJawab =
  { hasil: "benar" | "salah" | "tahap" | "diganti"; soal: SoalLayar } | { hasil: "selesai"; status: "bangun" | "cek_bangun" } | { hasil: "ditunda"; sampai: string };

const STATUS_HIDUP = new Set(["berbunyi", "ditunda", "cek_bangun"]);

const ambilSoal = (kejadianId: string, tujuan: "bangun" | "tunda") =>
  panggilApi<{ soal: SoalLayar }>(`/api/kejadian/${kejadianId}/soal${tujuan === "tunda" ? "?tujuan=tunda" : ""}`);

/**
 * Layar alarm penuh untuk satu kejadian (PRD C2 sampai C5, D, E1, E2, B8): berbunyi dengan soal
 * dari server, tunda dengan soal ringan, layar tunda, Selamat pagi, Masih bangun. Kebenaran di
 * server: setiap perubahan (dari perangkat ini, PC, atau batas waktu) datang lewat SSE dan layar
 * membaca ulang keadaannya. Dua alarm bersamaan dikerjakan satu per satu ("1 dari 2").
 */
export function LayarAlarmHidup({
  awal,
  pindah,
  selesai,
  konteks,
}: {
  awal: LayarKejadianKlien;
  /** Pindah ke kejadian lain yang masih berbunyi (bawaan: halaman `/app/bunyi/<id>`). */
  pindah?: (id: string) => void;
  /** Sesudah Selamat pagi / alarm selesai (bawaan: ke Beranda). Mode Jam Meja kembali siaga. */
  selesai?: () => void;
  /** Konteks audio yang sudah dibuka (Mode Jam Meja). */
  konteks?: AudioContext;
}) {
  const router = useRouter();
  const [k, setK] = useState(awal);
  const [berbunyiLain, setBerbunyiLain] = useState<Aktif[]>([]);
  const id = awal.id;

  // Hanya bacaan terbaru yang dipakai: jawaban lama yang tiba belakangan (mis. bacaan saat SSE
  // tersambung yang lambat) tidak boleh mengembalikan layar "berbunyi" sesudah soal terjawab.
  const urutanMuat = useRef(0);
  const muat = useCallback(async () => {
    const ke = ++urutanMuat.current;
    const [r, a] = await Promise.all([panggilApi<{ kejadian: LayarKejadianKlien }>(`/api/app/kejadian/${id}`), panggilApi<{ kejadian: Aktif[] }>("/api/app/kejadian/aktif")]);
    if (ke !== urutanMuat.current) return;
    if (r.ok) setK(r.data.kejadian);
    if (a.ok) setBerbunyiLain(a.data.kejadian.filter((x) => x.status === "berbunyi").sort((x, y) => x.jadwalUtc.localeCompare(y.jadwalUtc)));
  }, [id]);

  // Keadaan awal dari server; SSE `halo` (setiap tersambung) membaca ulang keadaan dan daftar alarm lain.
  usePeristiwa({ halo: () => void muat(), berbunyi: () => void muat(), berhenti: () => void muat(), tunda: () => void muat(), cek: () => void muat() });
  // Cadangan bila SSE terputus: baca ulang tiap 15 detik selama alarm masih hidup.
  useEffect(() => {
    if (!STATUS_HIDUP.has(k.status)) return;
    const h = setInterval(() => void muat(), 15_000);
    return () => clearInterval(h);
  }, [k.status, muat]);

  // Alarm ini sudah lolos dan ada alarm lain yang masih berbunyi: langsung ke alarm itu.
  const lain = berbunyiLain.find((x) => x.id !== id);
  const sudahLolos = k.status === "bangun" || k.status === "cek_bangun";
  useEffect(() => {
    if (!sudahLolos || !lain) return;
    if (pindah) pindah(lain.id);
    else router.replace(`/app/bunyi/${lain.id}`);
  }, [sudahLolos, lain, router, pindah]);

  const keBeranda = () => {
    if (lain) return pindah ? pindah(lain.id) : router.push(`/app/bunyi/${lain.id}`);
    if (selesai) return selesai();
    router.push("/app");
  };

  if (k.status === "berbunyi") {
    const posisi = berbunyiLain.findIndex((x) => x.id === id);
    const urutan = berbunyiLain.length > 1 && posisi >= 0 ? { ke: posisi + 1, dari: berbunyiLain.length } : undefined;
    return <SaatBerbunyi key={`${k.id}-${k.tunda.terpakai}-${k.berbunyiPada}`} k={k} urutan={urutan} muat={() => void muat()} konteks={konteks} />;
  }
  if (k.status === "ditunda") return <SaatDitunda k={k} muat={() => void muat()} />;
  if (k.status === "cek_bangun") return <SaatCek k={k} muat={() => void muat()} oke={keBeranda} />;
  if (k.status === "bangun") return <Pagi k={k} oke={keBeranda} />;
  return <Selesai k={k} oke={keBeranda} />;
}

function SaatBerbunyi({ k, urutan, muat, konteks }: { k: LayarKejadianKlien; urutan?: { ke: number; dari: number }; muat: () => void; konteks?: AudioContext }) {
  const { t, b } = useKamus();
  const T = t.bunyi;
  const [mode, setMode] = useState<"bangun" | "tunda">("bangun");
  const [soal, setSoal] = useState<SoalLayar | null>(null);
  const [umpan, setUmpan] = useState<Umpan>(null);
  const [getar, setGetar] = useState(0);
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const [mulaiCadangan] = useState(() => Date.now());
  const terapkan = useCallback(
    (r: Awaited<ReturnType<typeof ambilSoal>>) => {
      if (r.ok) {
        setGalat(null);
        setSoal(r.data.soal);
      } else {
        setGalat(r.pesan ?? t.umum.galatUmum);
        muat();
      }
    },
    [muat, t.umum.galatUmum],
  );
  const ambil = useCallback((tujuan: "bangun" | "tunda") => void ambilSoal(k.id, tujuan).then(terapkan), [k.id, terapkan]);

  useEffect(() => {
    let hidup = true;
    void ambilSoal(k.id, mode).then((r) => hidup && terapkan(r));
    return () => {
      hidup = false;
    };
  }, [k.id, mode, terapkan]);

  const kirim = async (jawaban: string) => {
    if (!soal || proses) return;
    setProses(true);
    const r = await panggilApi<HasilJawab>(`/api/kejadian/${k.id}/jawab`, "POST", { soalId: soal.id, jawaban });
    setProses(false);
    if (!r.ok) {
      setUmpan({ teks: r.pesan ?? t.umum.galatUmum, nada: "salah" });
      ambil(mode);
      return muat();
    }
    const h = r.data;
    if (h.hasil === "selesai" || h.hasil === "ditunda") return muat();
    setSoal(h.soal);
    if (h.hasil === "salah") {
      setGetar((g) => g + 1);
      setUmpan({ teks: soal.jenis === "qr" ? T.qrSalah : T.salah, nada: "salah" });
    } else if (h.hasil === "benar") setUmpan({ teks: T.benar, nada: "benar" });
    else if (h.hasil === "tahap") setUmpan({ teks: T.tahapQr, nada: "benar" });
    else setUmpan({ teks: T.diganti, nada: "salah" });
  };

  const gantiKamera = async () => {
    setProses(true);
    const r = await panggilApi<{ soal: SoalLayar }>(`/api/kejadian/${k.id}/ganti-soal`, "POST");
    setProses(false);
    if (r.ok) {
      setSoal(r.data.soal);
      setUmpan({ teks: T.diganti, nada: "salah" });
    } else setUmpan({ teks: r.pesan ?? t.umum.galatUmum, nada: "salah" });
  };

  const sisaTunda = k.tunda.jatah - k.tunda.terpakai;
  const kartu = soal ? (
    <KartuSoal
      soal={soal}
      kirim={(j) => void kirim(j)}
      gantiKamera={() => void gantiKamera()}
      umpan={umpan}
      getar={getar}
      proses={proses}
      judul={mode === "tunda" ? T.soalTunda : soal.jumlahTahap > 1 ? isi(T.tahap, { ke: soal.tahap + 1, dari: soal.jumlahTahap }) : undefined}
    />
  ) : (
    <section className="kaca-gelap grid min-h-[320px] place-items-center rounded-[32px] p-6 text-center">
      <p className="text-[16px] text-white/80">{galat ?? t.umum.memuat}</p>
    </section>
  );

  return (
    <LayarBerbunyiBersuara
      suara={{
        bunyi: berkasBunyi(k.suara.bunyi as Parameters<typeof berkasBunyi>[0]),
        omelan: k.suara.omelan,
        benih: k.suara.benih,
        mulaiMs: k.berbunyiPada ? Date.parse(k.berbunyiPada) : mulaiCadangan,
        bahasa: b,
        urlKlip: (h) => `/api/perangkat/klip/${h}`,
        konteks,
      }}
      jam={k.jam}
      judul={k.judul}
      detail={k.detail ?? undefined}
      kartu={kartu}
      perluBenar={soal?.target ?? 1}
      benarBeruntun={soal?.benarBeruntun ?? 0}
      tunda={mode === "bangun" && k.tunda.boleh ? { sisa: sisaTunda, menit: k.tunda.menit } : null}
      mintaTunda={() => {
        setUmpan(null);
        setSoal(null);
        setMode("tunda");
      }}
      aksiBawah={
        mode === "tunda" ? (
          <button
            type="button"
            onClick={() => {
              setUmpan(null);
              setSoal(null);
              setMode("bangun");
            }}
            className="tekan mx-auto flex h-12 items-center rounded-full bg-white/12 px-6 text-[16px] font-semibold text-white hover:bg-white/18"
          >
            {T.kembaliSoal}
          </button>
        ) : undefined
      }
      urutan={urutan}
      terlambatMenit={k.terlambatMenit || undefined}
    />
  );
}

/** Detik tersisa sampai `sampai` (teks ISO); render server dan hidrasi memakai jam server data ini. */
function useSisaDetik(sampai: string | null, waktuServer: string): number {
  const detik = useDetik(Date.parse(waktuServer));
  return sampai ? Math.max(0, Math.floor(Date.parse(sampai) / 1000) - detik) : 0;
}

function SaatDitunda({ k, muat }: { k: LayarKejadianKlien; muat: () => void }) {
  const { t } = useKamus();
  const T = t.bunyi;
  const sisa = useSisaDetik(k.tundaSampai, k.waktuServer);
  const muatTerbaru = useRef(muat);
  useEffect(() => {
    muatTerbaru.current = muat;
  });
  useEffect(() => {
    if (sisa === 0) {
      const h = setTimeout(() => muatTerbaru.current(), 1_500);
      return () => clearTimeout(h);
    }
  }, [sisa]);
  const mm = String(Math.floor(sisa / 60)).padStart(2, "0");
  const ss = String(sisa % 60).padStart(2, "0");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#07070a] px-6 text-center text-white">
      <Kebo pose="tidur" ukuran={120} />
      <h1 className="t-judul-1 mt-6">{T.ditundaJudul}</h1>
      <p className="t-jam mt-4 text-[72px] text-amber-200" aria-live="off">
        {mm}:{ss}
      </p>
      <p className="t-subjudul mt-2 max-w-[34ch] text-white/75">{isi(T.ditundaIsi, { judul: k.judul })}</p>
      <p className="mt-6 flex items-center gap-2 text-[14px] text-white/55">
        <Moon size={15} />
        {k.tunda.jatah - k.tunda.terpakai > 0 ? isi(T.ditundaSisa, { n: k.tunda.jatah - k.tunda.terpakai }) : T.tundaHabis}
      </p>
    </main>
  );
}

function SaatCek({ k, muat, oke }: { k: LayarKejadianKlien; muat: () => void; oke: () => void }) {
  const { t } = useKamus();
  const sampaiCek = useSisaDetik(k.cekPada, k.waktuServer);
  const sisa = useSisaDetik(k.cekBatas, k.waktuServer);
  const [proses, setProses] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const muatTerbaru = useRef(muat);
  useEffect(() => {
    muatTerbaru.current = muat;
  });
  // Batas mengetuk lewat: server membunyikan alarm lagi; baca ulang keadaannya.
  useEffect(() => {
    if (k.cekPada && sampaiCek === 0 && sisa === 0) {
      const h = setTimeout(() => muatTerbaru.current(), 2_000);
      return () => clearTimeout(h);
    }
  }, [k.cekPada, sampaiCek, sisa]);

  if (sampaiCek > 0) return <Pagi k={k} oke={oke} cekMenit={Math.max(1, Math.ceil(sampaiCek / 60))} />;
  return (
    <>
      <LayarMasihBangun
        sisaDetik={sisa}
        totalDetik={k.masihBangun.batasDtk}
        konfirmasi={async () => {
          if (proses) return;
          setProses(true);
          const r = await panggilApi(`/api/kejadian/${k.id}/masih-bangun`, "POST");
          setProses(false);
          if (!r.ok) setPesan(r.pesan ?? t.umum.galatUmum);
          muat();
        }}
      />
      {pesan ? (
        <p role="alert" className="fixed inset-x-0 bottom-[max(24px,env(safe-area-inset-bottom))] px-6 text-center text-[15px] font-semibold text-amber-200">
          {pesan}
        </p>
      ) : null}
    </>
  );
}

function Pagi({ k, oke, cekMenit = null }: { k: LayarKejadianKlien; oke: () => void; cekMenit?: number | null }) {
  const p = k.pagi;
  return (
    <LayarSelamatPagi
      nama={k.nama}
      jamBangun={p?.jamBangun ?? k.jam}
      agenda={k.uji ? null : { judul: k.judul, detail: k.detail ?? undefined }}
      skor={p?.skor ?? null}
      tunda={p?.tunda ?? 0}
      menit={p?.menit ?? 0}
      cekMenit={cekMenit}
      oke={oke}
    />
  );
}

function Selesai({ k, oke }: { k: LayarKejadianKlien; oke: () => void }) {
  const { t } = useKamus();
  const T = t.bunyi;
  const teks = k.status === "menunggu" ? T.belumBerbunyi : k.status === "tidak_bangun" ? T.tidakBangun : T.sudahSelesai;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#07070a] px-6 text-center text-white">
      <Kebo pose={k.status === "tidak_bangun" ? "tidur" : "netral"} ukuran={120} />
      <h1 className="t-judul-1 mt-6 max-w-[22ch]">{k.judul}</h1>
      <p className="t-subjudul mt-2 max-w-[34ch] text-white/75">{teks}</p>
      <button type="button" onClick={oke} className="tekan mt-8 h-14 w-full max-w-[320px] rounded-full bg-white text-[17px] font-semibold text-[#07070a]">
        {T.keBeranda}
      </button>
    </main>
  );
}
