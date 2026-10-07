"use client";

import { useCallback, useEffect, useState } from "react";
import { LayarSiaga } from "@/components/layar/siaga";
import { Tombol } from "@/components/ui/dasar";
import { Lembar } from "@/components/ui/lembar";
import { tampilToast } from "@/components/ui/toast";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { panggilApi } from "@/lib/klien/api";
import { useDetik } from "@/lib/klien/jam";
import { usePeristiwa } from "@/lib/klien/peristiwa";
import { siapMalamIni } from "@/lib/tampilan/siap";
import { waktuRelatif } from "@/lib/tampilan/uraian";

export type PerangkatKlien = {
  id: string;
  jenis: "pc" | "web";
  nama: string;
  versi: string | null;
  terakhirTerlihat: string | null;
  siaga: boolean;
  kemampuan: { dicas?: boolean | null; baterai?: number | null };
  siapSampai: string | null;
};

/**
 * Tab Siaga hidup (PRD H1, H4): daftar perangkat dari `/api/app/perangkat`, diperbarui lewat SSE
 * (`perangkat`, `cabut`) dan tiap 30 detik (status siaga bergantung waktu). Ganti nama dan putus
 * lewat lembar konfirmasi.
 */
export function TabSiaga({ awal, alarmBerikutnya, waktuServer }: { awal: PerangkatKlien[]; alarmBerikutnya: string | null; waktuServer: number }) {
  const { t } = useKamus();
  const S = t.siaga;
  const [daftar, setDaftar] = useState(awal);
  const detik = useDetik(waktuServer, 30);
  const [putusId, setPutusId] = useState<string | null>(null);
  const [namaId, setNamaId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    const r = await panggilApi<{ perangkat: PerangkatKlien[] }>("/api/app/perangkat");
    if (r.ok) setDaftar(r.data.perangkat);
  }, []);
  usePeristiwa({ perangkat: () => void muat(), cabut: () => void muat(), halo: () => void muat() });
  useEffect(() => {
    const h = setInterval(() => void muat(), 30_000);
    return () => clearInterval(h);
  }, [muat]);

  const cari = (id: string | null) => daftar.find((p) => p.id === id) ?? null;
  const dipilihPutus = cari(putusId);
  const dipilihNama = cari(namaId);

  const putus = async () => {
    if (!dipilihPutus || proses) return;
    setProses(true);
    const r = await panggilApi(`/api/app/perangkat/${dipilihPutus.id}`, "DELETE");
    setProses(false);
    if (!r.ok) return setGalat(r.pesan ?? t.umum.galatUmum);
    tampilToast(isi(S.diputus, { nama: dipilihPutus.nama }));
    setPutusId(null);
    void muat();
  };

  const simpanNama = async () => {
    if (!dipilihNama || proses) return;
    setProses(true);
    const r = await panggilApi(`/api/app/perangkat/${dipilihNama.id}`, "PATCH", { nama });
    setProses(false);
    if (!r.ok) return setGalat(r.pesan ?? t.umum.galatUmum);
    tampilToast(S.disimpan);
    setNamaId(null);
    void muat();
  };

  return (
    <>
      <LayarSiaga
        perangkat={daftar.map((p) => ({
          id: p.id,
          jenis: p.jenis,
          nama: p.nama,
          siapMalamIni: siapMalamIni(p, alarmBerikutnya),
          terakhirTerlihat: waktuRelatif(p.terakhirTerlihat, detik * 1000, t),
          dicas: p.kemampuan.dicas ?? null,
          baterai: p.kemampuan.baterai ?? null,
        }))}
        hrefUnduh="/app/unduh-pc"
        hrefJamMeja="/app/jam-meja"
        putus={(id) => {
          setGalat(null);
          setPutusId(id);
        }}
        ubahNama={(id) => {
          setGalat(null);
          setNama(cari(id)?.nama ?? "");
          setNamaId(id);
        }}
      />
      <Lembar
        buka={!!dipilihPutus}
        ubahBuka={(b) => !b && setPutusId(null)}
        judul={isi(S.putusJudul, { nama: dipilihPutus?.nama ?? "" })}
        kaki={
          <div className="flex gap-2.5">
            <Tombol varian="kaca" className="flex-1" onClick={() => setPutusId(null)}>
              {t.umum.batal}
            </Tombol>
            <Tombol varian="bahaya" className="flex-1" disabled={proses} onClick={() => void putus()}>
              {proses ? t.umum.memuat : S.putusYa}
            </Tombol>
          </div>
        }
      >
        <p className="t-isi text-label-2">{S.putusIsi}</p>
        {galat ? (
          <p role="alert" className="t-subjudul mt-3 text-bahaya">
            {galat}
          </p>
        ) : null}
      </Lembar>
      <Lembar
        buka={!!dipilihNama}
        ubahBuka={(b) => !b && setNamaId(null)}
        judul={S.gantiNamaJudul}
        kaki={
          <Tombol className="w-full" disabled={proses || !nama.trim()} onClick={() => void simpanNama()}>
            {proses ? t.umum.menyimpan : t.umum.simpan}
          </Tombol>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="t-subjudul font-semibold text-label-2">{S.namaLabel}</span>
          <input
            value={nama}
            maxLength={40}
            onChange={(e) => setNama(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void simpanNama()}
            className="h-12 rounded-[14px] bg-kaca-isi px-4 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-toska"
          />
        </label>
        {galat ? (
          <p role="alert" className="t-subjudul mt-3 text-bahaya">
            {galat}
          </p>
        ) : null}
      </Lembar>
    </>
  );
}
