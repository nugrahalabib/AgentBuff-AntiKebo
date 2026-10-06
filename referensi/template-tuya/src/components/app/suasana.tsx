"use client";

import { Check, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Kosong, Tombol } from "@/components/ui/dasar";
import { IKON_JENIS } from "@/components/ui/ikon";
import { Lembar } from "@/components/ui/lembar";
import { tampilToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { api, useToko, type GalatApi } from "@/lib/app/toko";
import type { DataRumah, DataSuasana } from "@/lib/app/data";
import { IKON_SUASANA, IkonSuasana, WARNA_SUASANA } from "./suasana-ikon";
import { teksStatus } from "./ubin";

export function HalamanSuasana({ awal }: { awal: DataRumah }) {
  const { t } = useKamus();
  const setel = useToko((s) => s.setel);
  const data = useToko((s) => s.data) ?? awal;
  const [editor, setEditor] = useState<DataSuasana | "baru" | null>(null);
  const [jalan, setJalan] = useState<string | null>(null);
  const [hapus, setHapus] = useState<DataSuasana | null>(null);
  useEffect(() => setel(awal), [awal, setel]);

  const aktifkan = async (s: DataSuasana) => {
    setJalan(s.id);
    try {
      const r = await api<{ gagal: unknown[] }>(`/api/app/suasana/${s.id}/jalan`, { method: "POST" });
      tampilToast(r.gagal.length ? `${isi(t.suasana.dijalankan, { nama: s.nama })}. ${isi(t.suasana.sebagian, { n: r.gagal.length })}` : isi(t.suasana.dijalankan, { nama: s.nama }));
      void useToko.getState().muat();
    } catch (e) {
      tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
    }
    setJalan(null);
  };

  return (
    <div>
      <header className="muncul flex flex-wrap items-end justify-between gap-4 pr-14">
        <div>
          <h1 className="t-judul-besar">{t.suasana.judul}</h1>
          <p className="t-subjudul mt-1 max-w-[52ch] text-label-2">{t.suasana.sub}</p>
        </div>
        <Tombol onClick={() => setEditor("baru")}>
          <Plus size={18} />
          {t.suasana.baru}
        </Tombol>
      </header>

      {data.suasana.length === 0 ? (
        <div className="mt-10">
          <Kosong ikon={<Sparkles size={30} />} judul={t.suasana.kosongJudul} isi={t.suasana.kosongIsi} />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.suasana.map((s, i) => (
            <article key={s.id} className="muncul kaca flex flex-col rounded-[28px] p-5" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <div className="flex items-start gap-3.5">
                <IkonSuasana ikon={s.ikon} warna={s.warna} ukuran={52} />
                <div className="min-w-0 flex-1">
                  <h2 className="t-judul-3 truncate">{s.nama}</h2>
                  <p className="t-subjudul text-label-2">{isi(t.suasana.perangkatN, { n: s.jumlah })}</p>
                </div>
              </div>
              <p className="t-keterangan mt-4 text-label-3">{isi(t.suasana.kataAgen, { nama: s.nama })}</p>
              <div className="mt-5 flex gap-2">
                <Tombol className="flex-1" onClick={() => void aktifkan(s)} disabled={jalan === s.id}>
                  {jalan === s.id ? <span className="putar size-4 rounded-full border-2 border-white/40 border-t-white" /> : <Sparkles size={16} />}
                  {t.suasana.jalankan}
                </Tombol>
                <Tombol varian="kaca" onClick={() => setEditor(s)} aria-label={t.suasana.perbarui}>
                  <RefreshCw size={16} />
                </Tombol>
                <Tombol varian="bahaya" onClick={() => setHapus(s)} aria-label={t.umum.hapus}>
                  <Trash2 size={16} />
                </Tombol>
              </div>
            </article>
          ))}
        </div>
      )}

      {editor ? <EditorSuasana awal={editor === "baru" ? null : editor} tutup={() => setEditor(null)} /> : null}

      <Lembar
        buka={!!hapus}
        ubahBuka={(v) => !v && setHapus(null)}
        judul={hapus ? isi(t.suasana.hapusTanya, { nama: hapus.nama }) : ""}
        lebar={420}
        kaki={
          <div className="flex gap-2">
            <Tombol varian="kaca" className="flex-1" onClick={() => setHapus(null)}>
              {t.umum.batal}
            </Tombol>
            <Tombol
              className="flex-1 bg-bahaya-isi shadow-none"
              onClick={async () => {
                const s = hapus!;
                setHapus(null);
                try {
                  await api(`/api/app/suasana/${s.id}`, { method: "DELETE" });
                  void useToko.getState().muat();
                } catch (e) {
                  tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
                }
              }}
            >
              {t.umum.hapus}
            </Tombol>
          </div>
        }
      >
        <span />
      </Lembar>
    </div>
  );
}

function EditorSuasana({ awal, tutup }: { awal: DataSuasana | null; tutup: () => void }) {
  const { t } = useKamus();
  const perangkat = useToko((s) => s.data?.perangkat ?? []).filter((p) => !p.hilang && (p.kontrol.daya || p.kontrol.saluran.length || p.kontrol.suhuTarget || p.kontrol.posisi));
  const [nama, setNama] = useState(awal?.nama ?? "");
  const [ikon, setIkon] = useState(awal?.ikon ?? "sparkles");
  const [warna, setWarna] = useState(awal?.warna ?? "nila");
  const [pilih, setPilih] = useState<Set<string>>(new Set(awal?.perangkat ?? perangkat.filter((p) => p.online && p.keadaan.nyala).map((p) => p.id)));
  const [simpan, setSimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const kirim = async () => {
    setSimpan(true);
    setGalat(null);
    try {
      await api("/api/app/suasana", { method: "POST", json: { id: awal?.id, nama, ikon, warna, perangkat: [...pilih] } });
      tampilToast(`${nama} ✓`);
      void useToko.getState().muat();
      tutup();
    } catch (e) {
      setGalat((e as GalatApi).pesan ?? t.umum.galatUmum);
      setSimpan(false);
    }
  };

  return (
    <Lembar
      buka
      ubahBuka={(v) => !v && tutup()}
      judul={awal ? awal.nama : t.suasana.baru}
      sub={t.suasana.pilihKet}
      lebar={560}
      kaki={
        <div>
          {galat ? (
            <p data-pesan-galat className="t-subjudul mb-3 text-bahaya">
              {galat}
            </p>
          ) : null}
          <Tombol ukuran="besar" className="w-full" disabled={simpan || !nama.trim() || pilih.size === 0} onClick={kirim}>
            {simpan ? t.umum.menyimpan : awal ? t.suasana.perbarui : t.suasana.simpan}
          </Tombol>
        </div>
      }
    >
      <label htmlFor="nama-suasana" className="t-kapsi block text-label-2 uppercase">
        {t.suasana.nama}
      </label>
      <input
        id="nama-suasana"
        value={nama}
        onChange={(e) => setNama(e.target.value)}
        maxLength={40}
        placeholder={t.suasana.namaContoh}
        className="mt-2 h-12 w-full rounded-[16px] bg-kaca-isi px-4 text-[17px] outline-none focus:ring-2 focus:ring-aksen-isi"
      />

      <p className="t-kapsi mt-5 text-label-2 uppercase">{t.suasana.ikon}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.keys(IKON_SUASANA).map((k) => {
          const I = IKON_SUASANA[k];
          return (
            <button key={k} type="button" aria-label={k} aria-pressed={ikon === k} onClick={() => setIkon(k)} className={cn("tekan grid size-11 place-items-center rounded-[14px]", ikon === k ? "bg-label text-[var(--amb-dasar)]" : "bg-kaca-isi text-label-2")}>
              <I size={19} />
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.keys(WARNA_SUASANA).map((w) => (
          <button key={w} type="button" aria-label={w} aria-pressed={warna === w} onClick={() => setWarna(w)} className={cn("tekan size-9 rounded-full", warna === w && "ring-[3px] ring-label ring-offset-2 ring-offset-transparent")} style={{ background: WARNA_SUASANA[w] }} />
        ))}
      </div>

      <p className="t-kapsi mt-6 text-label-2 uppercase">{t.suasana.pilihPerangkat}</p>
      <ul className="mt-2 flex flex-col divide-y divide-pemisah overflow-hidden rounded-[20px] bg-kaca-isi">
        {perangkat.map((p) => {
          const I = IKON_JENIS[p.jenis];
          const dipilih = pilih.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={dipilih}
                onClick={() =>
                  setPilih((s) => {
                    const n = new Set(s);
                    if (n.has(p.id)) n.delete(p.id);
                    else n.add(p.id);
                    return n;
                  })
                }
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <I size={19} className="shrink-0 text-label-2" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{p.nama}</span>
                  <span className="t-keterangan block truncate text-label-2">{[p.ruangan, teksStatus(t, p)].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={cn("grid size-6 place-items-center rounded-full border-2", dipilih ? "border-aksen-isi bg-aksen-isi text-white" : "border-label-3/50")}>{dipilih ? <Check size={14} strokeWidth={3} /> : null}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Lembar>
  );
}
