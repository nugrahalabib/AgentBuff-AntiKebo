"use client";

import { useState } from "react";
import { LayarRiwayat } from "@/components/layar/riwayat";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { panggilApi } from "@/lib/klien/api";
import type { KejadianRiwayat } from "@/lib/tampilan/jenis";
import { tanggalPendek } from "@/lib/tampilan/uraian";

export type RingkasanKlien = {
  skorHariIni: number | null;
  beruntun: number;
  rataMenit: number | null;
  totalTunda: number;
  skor30: (number | null)[];
  hari30: string[];
  kejadian: KejadianRiwayat[];
};

type Rincian = {
  id: string;
  berbunyi: string | null;
  bangun: string | null;
  terlambatDtk: number | null;
  gagalCek: boolean;
  selesaiOleh: string | null;
  perangkat: string | null;
  perangkatBerbunyi: Array<{ nama: string; jenis: "pc" | "web" }>;
  rumah: Array<{ nama: string | null; hasil: "jalan" | "offline" | "gagal" }>;
  soal: Array<{ jenis: string; tingkat: string; tujuan: string; status: string }>;
  kiriman: Array<{ kanalId: string; platform: string | null; jenis: string; ke: number | null; status: string; waktu: string }>;
};

/** Tab Riwayat (PRD K1 sampai K3): statistik + grafik 7/30 hari + rincian per kejadian + ekspor CSV. */
export function TabRiwayat({ ringkasan }: { ringkasan: RingkasanKlien }) {
  const { t, b } = useKamus();
  const R = t.riwayat;
  const [pilihan, setPilihan] = useState<string | null>(null);
  const [rincian, setRincian] = useState<Rincian | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const pilih = async (id: string) => {
    if (pilihan === id) {
      setPilihan(null);
      return;
    }
    setPilihan(id);
    setRincian(null);
    setGalat(null);
    const r = await panggilApi<{ rincian: Rincian }>(`/api/app/riwayat/${id}`);
    if (r.ok) setRincian(r.data.rincian);
    else setGalat(r.pesan ?? t.umum.galatUmum);
  };

  const label = (s: string) => {
    const [, m, d] = s.split("-");
    return `${Number(d)}/${Number(m)}`;
  };
  const jenisSoal = (j: string) => (t.ubah.soalJenis as Record<string, string>)[j] ?? j;

  const isiRincian = !pilihan ? null : galat ? (
    <p role="alert" className="t-subjudul text-bahaya">
      {galat}
    </p>
  ) : !rincian || rincian.id !== pilihan ? (
    <p className="t-subjudul text-label-2">{t.umum.memuat}</p>
  ) : (
    <div className="flex flex-col gap-3 rounded-[16px] bg-kaca-isi p-4 text-[15px]">
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        {rincian.berbunyi ? <span>{isi(R.berbunyi, { jam: rincian.berbunyi })}</span> : null}
        {rincian.bangun ? <span>{isi(R.bangun, { jam: rincian.bangun })}</span> : null}
        {(rincian.terlambatDtk ?? 0) >= 5 ? <span className="text-waspada">{isi(R.terlambat, { n: rincian.terlambatDtk ?? 0 })}</span> : null}
        {rincian.gagalCek ? <span className="text-waspada">{R.gagalCek}</span> : null}
      </p>
      {rincian.selesaiOleh ? (
        <p>
          <span className="text-label-2">{R.dihentikan} </span>
          {(R.oleh as Record<string, string>)[rincian.selesaiOleh] ?? rincian.selesaiOleh}
          {rincian.perangkat ? ` (${rincian.perangkat})` : null}
        </p>
      ) : null}
      <p>
        <span className="text-label-2">{R.perangkatSiaga} </span>
        {rincian.perangkatBerbunyi.length ? rincian.perangkatBerbunyi.map((p) => p.nama).join(", ") : R.perangkatKosong}
      </p>
      {rincian.soal.length ? (
        <div>
          <p className="t-subjudul font-semibold text-label-2">{R.soal}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {rincian.soal.map((s, i) => (
              <li key={i}>
                {jenisSoal(s.jenis)} · {(t.ubah.tingkat as Record<string, string>)[s.tingkat] ?? s.tingkat}
                {s.tujuan === "tunda" ? ` · ${R.soalTunda}` : null} · {(R.soalStatus as Record<string, string>)[s.status] ?? s.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <p className="t-subjudul font-semibold text-label-2">{R.kiriman}</p>
        {rincian.kiriman.length ? (
          <ul className="mt-1 flex flex-col gap-0.5">
            {rincian.kiriman.map((k, i) => (
              <li key={i}>
                {(R.kirimanJenis as Record<string, string>)[k.jenis] ?? k.jenis}
                {k.ke ? ` #${k.ke}` : null} · {k.platform ?? k.kanalId} ·{" "}
                <span className={k.status === "gagal" ? "text-bahaya" : undefined}>{(R.kirimanStatus as Record<string, string>)[k.status] ?? k.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-label-2">{R.kirimanKosong}</p>
        )}
      </div>
      {rincian.rumah.length ? (
        <div>
          <p className="t-subjudul font-semibold text-label-2">{R.rumah}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {rincian.rumah.map((r, i) => (
              <li key={i}>
                {r.nama ?? R.rumahHilang} · <span className={r.hasil === "jalan" ? undefined : "text-waspada"}>{R.rumahHasil[r.hasil]}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  return (
    <LayarRiwayat
      skorHariIni={ringkasan.skorHariIni}
      beruntun={ringkasan.beruntun}
      rataMenit={ringkasan.rataMenit}
      totalTunda={ringkasan.totalTunda}
      skor30={ringkasan.skor30}
      labelHari={ringkasan.hari30.map(label)}
      kejadian={ringkasan.kejadian.map((k) => ({ ...k, tanggal: tanggalPendek(k.tanggal, t, b), jam: b === "id" ? k.jam.replace(":", ".") : k.jam }))}
      hrefEkspor="/api/app/riwayat/csv"
      pilih={(id) => void pilih(id)}
      rincian={pilihan ? { id: pilihan, isi: isiRincian } : null}
    />
  );
}
