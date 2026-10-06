"use client";

import { Check, CloudSun, House, Power, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Kosong, Spanduk, Tombol, TautanTombol } from "@/components/ui/dasar";
import { tampilToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { api, useToko, type GalatApi } from "@/lib/app/toko";
import type { DataRumah } from "@/lib/app/data";
import type { PerangkatRamah } from "@/lib/layanan/rumah";
import { LembarPerangkat } from "./lembar-perangkat";
import { IkonSuasana } from "./suasana-ikon";
import { ringkasNyala, UbinPerangkat } from "./ubin";

type Cuaca = { suhu: number | null; kondisi: string | null };

export function Rumah({ awal, sapaan }: { awal: DataRumah; sapaan: string }) {
  const { t } = useKamus();
  const setel = useToko((s) => s.setel);
  const data = useToko((s) => s.data) ?? awal;
  const sibuk = useToko((s) => s.sibuk);
  const kendali = useToko((s) => s.kendali);
  const [rumahId, setRumahId] = useState<string | null>(awal.struktur?.rumah[0]?.id ?? null);
  const [dibuka, setDibuka] = useState<string | null>(null);
  const [cuaca, setCuaca] = useState<Cuaca | null>(null);
  const [sinkron, setSinkron] = useState(false);
  const [suasanaJalan, setSuasanaJalan] = useState<{ id: string; selesai: boolean } | null>(null);

  useEffect(() => setel(awal), [awal, setel]);
  useEffect(() => {
    let batal = false;
    api<Cuaca>(`/api/app/cuaca${rumahId ? `?rumah=${encodeURIComponent(rumahId)}` : ""}`)
      .then((c) => !batal && setCuaca(c))
      .catch(() => !batal && setCuaca(null));
    return () => {
      batal = true;
    };
  }, [rumahId]);

  const rumahDaftar = useMemo(() => data.struktur?.rumah ?? [], [data.struktur]);
  const tampil = useMemo(() => data.perangkat.filter((p) => !p.disembunyikan && !p.hilang && (rumahDaftar.length < 2 || !rumahId || p.rumahId === rumahId)), [data.perangkat, rumahDaftar.length, rumahId]);

  // Kelompok per ruangan, urut sesuai urutan ruangan di app Smart Life; tanpa ruangan -> "Lainnya".
  const kelompok = useMemo(() => {
    const ruang = rumahDaftar.find((r) => r.id === rumahId)?.ruangan ?? rumahDaftar.flatMap((r) => r.ruangan);
    const urut = new Map(ruang.map((r, i) => [r.id, i]));
    const peta = new Map<string, { nama: string; urut: number; daftar: PerangkatRamah[] }>();
    for (const p of tampil) {
      const kunci = p.ruanganId && p.ruangan ? p.ruanganId : "_lain";
      if (!peta.has(kunci)) peta.set(kunci, { nama: kunci === "_lain" ? t.rumah.ruangLain : p.ruangan!, urut: urut.get(kunci) ?? 999, daftar: [] });
      peta.get(kunci)!.daftar.push(p);
    }
    return [...peta.entries()].sort((a, b) => a[1].urut - b[1].urut).map(([id, v]) => ({ id, ...v }));
  }, [tampil, rumahDaftar, rumahId, t.rumah.ruangLain]);

  const saklar = async (p: PerangkatRamah) => {
    const r = await kendali(p.id, { nyala: !(p.keadaan.nyala === true) });
    if (!r.ok) tampilToast(isi(t.rumah.gagalKendali, { nama: p.nama, alasan: r.galat.pesan }), "galat");
  };

  const matikanRuang = async (daftar: PerangkatRamah[]) => {
    const ids = daftar.filter((p) => p.online && p.keadaan.nyala).map((p) => p.id);
    for (const p of daftar) if (ids.includes(p.id)) useToko.getState().ganti({ ...p, keadaan: { ...p.keadaan, nyala: false } });
    try {
      await api("/api/app/matikan", { method: "POST", json: { ids } });
    } catch (e) {
      tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
    }
    void useToko.getState().muat();
  };

  const jalankanSuasana = async (id: string, nama: string) => {
    setSuasanaJalan({ id, selesai: false });
    try {
      const r = await api<{ gagal: unknown[] }>(`/api/app/suasana/${id}/jalan`, { method: "POST" });
      setSuasanaJalan({ id, selesai: true });
      tampilToast(r.gagal.length ? `${isi(t.suasana.dijalankan, { nama })}. ${isi(t.suasana.sebagian, { n: r.gagal.length })}` : isi(t.suasana.dijalankan, { nama }));
      void useToko.getState().muat();
    } catch (e) {
      tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
      setSuasanaJalan(null);
    }
    setTimeout(() => setSuasanaJalan((s) => (s?.id === id ? null : s)), 1600);
  };

  const muatUlang = async () => {
    setSinkron(true);
    try {
      await api("/api/app/sinkron", { method: "POST" });
      await useToko.getState().muat();
    } catch (e) {
      tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
    }
    setSinkron(false);
  };

  return (
    <div>
      <header className="muncul pr-14">
        <p className="t-subjudul text-label-2">{sapaan}</p>
        <h1 className="t-judul-besar mt-0.5">{rumahDaftar.find((r) => r.id === rumahId)?.nama ?? t.rumah.judul}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="kaca inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold">
            <Power size={14} className="text-[var(--ikon-lampu)]" />
            {ringkasNyala(t, tampil)}
          </span>
          {cuaca?.suhu != null ? (
            <span className="kaca inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold">
              <CloudSun size={15} className="text-[var(--ikon-ac)]" />
              {isi(t.rumah.cuaca, { kondisi: cuaca.kondisi ?? "", suhu: cuaca.suhu })}
            </span>
          ) : null}
        </div>
        {rumahDaftar.length > 1 ? (
          <div role="tablist" aria-label={t.rumah.pilihRumah} className="tanpa-gulir mt-4 flex gap-2 overflow-x-auto">
            {rumahDaftar.map((r) => (
              <button
                key={r.id}
                role="tab"
                aria-selected={r.id === rumahId}
                onClick={() => setRumahId(r.id)}
                className={cn("tekan h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold", r.id === rumahId ? "bg-label text-[var(--amb-dasar)]" : "kaca text-label-2")}
              >
                {r.nama}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {data.sambungan?.status === "kunci_bermasalah" ? (
        <div className="mt-6">
          <Spanduk
            nada="bahaya"
            judul={t.rumah.kunciBermasalahJudul}
            isi={t.rumah.kunciBermasalahIsi}
            aksi={
              <TautanTombol href="/app/sambungkan" ukuran="kecil">
                {t.rumah.kunciBermasalahTombol}
              </TautanTombol>
            }
          />
        </div>
      ) : null}

      {data.suasana.length ? (
        <section aria-labelledby="judul-suasana" className="mt-8">
          <h2 id="judul-suasana" className="t-judul-3 mb-3">
            {t.rumah.suasana}
          </h2>
          <div className="tanpa-gulir -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
            {data.suasana.map((s) => {
              const jalan = suasanaJalan?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void jalankanSuasana(s.id, s.nama)}
                  className={cn("tekan flex h-16 shrink-0 items-center gap-3 rounded-[20px] pr-5 pl-2.5", jalan ? "kaca-nyala [--cahaya:rgba(94,92,230,0.45)]" : "kaca")}
                >
                  <IkonSuasana ikon={s.ikon} warna={s.warna} />
                  <span className="text-left">
                    <span className={cn("block text-[15px] font-semibold", jalan && "text-nyala-label")}>{s.nama}</span>
                    <span className={cn("t-keterangan block", jalan ? "text-nyala-label-2" : "text-label-2")}>{isi(t.suasana.perangkatN, { n: s.jumlah })}</span>
                  </span>
                  {jalan ? suasanaJalan.selesai ? <Check size={18} className="text-berhasil" /> : <span className="putar size-4 rounded-full border-2 border-current border-t-transparent opacity-50" /> : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {tampil.length === 0 ? (
        <div className="mt-10">
          <Kosong
            ikon={<House size={30} />}
            judul={t.rumah.kosongJudul}
            isi={t.rumah.kosongIsi}
            aksi={
              <Tombol onClick={muatUlang} disabled={sinkron}>
                <RefreshCw size={16} className={sinkron ? "putar" : ""} />
                {sinkron ? t.rumah.memuatUlang : t.rumah.muatUlang}
              </Tombol>
            }
          />
        </div>
      ) : (
        kelompok.map((g, gi) => {
          const adaNyala = g.daftar.some((p) => p.online && p.keadaan.nyala);
          return (
            <section key={g.id} aria-labelledby={`ruang-${g.id}`} className="muncul mt-9" style={{ animationDelay: `${Math.min(gi, 6) * 50}ms` }}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id={`ruang-${g.id}`} className="t-judul-3">
                  {g.nama}
                </h2>
                {adaNyala ? (
                  <Tombol varian="polos" ukuran="kecil" onClick={() => void matikanRuang(g.daftar)}>
                    <Power size={14} />
                    {t.rumah.matikanRuang}
                  </Tombol>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {g.daftar.map((p) => (
                  <UbinPerangkat key={p.id} p={p} sibuk={!!sibuk[p.id]} saklar={() => void saklar(p)} buka={() => setDibuka(p.id)} />
                ))}
              </div>
            </section>
          );
        })
      )}

      {tampil.length ? (
        <div className="mt-12 flex justify-center">
          <Tombol varian="kaca" ukuran="kecil" onClick={muatUlang} disabled={sinkron}>
            <RefreshCw size={14} className={sinkron ? "putar" : ""} />
            {sinkron ? t.rumah.memuatUlang : t.rumah.muatUlang}
          </Tombol>
        </div>
      ) : null}

      <LembarPerangkat id={dibuka} tutup={() => setDibuka(null)} bukaLain={setDibuka} />
    </div>
  );
}
