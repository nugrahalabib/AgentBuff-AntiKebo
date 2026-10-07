"use client";

import { Blinds, ChevronDown, Cpu, Fan, Lamp, Plug, Radar, RefreshCw, Snowflake, ToggleRight, TriangleAlert, Unplug, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { Saklar, Spanduk, TautanTombol, Tombol, Segmen } from "@/components/ui/dasar";
import { KotakIkon } from "@/components/ui/grup";
import { tampilToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";

type Perangkat = { id: string; nama: string; jenis: string; jenisLabel: string; online: boolean; nyala: boolean | null; bisa: { nyala: boolean; terang: boolean } };
type Ruangan = { id: string | null; nama: string; perangkat: Perangkat[] };
type Darurat = { aktif: boolean; menit: number; cara: "telepon" | "sms" };
export type StatusRumahTampil = { bermasalah: boolean; kunciSamar: string; wilayah: string; perangkat: number; darurat: Darurat };

async function kirim(url: string, metode: string, isiJson?: unknown) {
  const r = await fetch(url, {
    method: metode,
    headers: isiJson === undefined ? undefined : { "Content-Type": "application/json" },
    body: isiJson === undefined ? undefined : JSON.stringify(isiJson),
  });
  return { ok: r.ok, data: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

function ikonJenis(jenis: string) {
  if (jenis === "lampu") return Lamp;
  if (jenis === "ac") return Snowflake;
  if (jenis === "kipas" || jenis === "pembersih_udara") return Fan;
  if (jenis === "colokan") return Plug;
  if (jenis === "saklar") return ToggleRight;
  if (jenis === "tirai") return Blinds;
  if (jenis === "sensor" || jenis === "keamanan") return Radar;
  return Cpu;
}

/** Perangkat yang bisa ikut membangunkan (dinyalakan atau diterangkan); sensor hanya dipantau. */
const bisaDipakai = (p: Perangkat) => p.bisa.nyala || p.bisa.terang;

/**
 * Rumah pintar tersambung (PRD I2, I4, I5, I6): status sambungan, perangkat per ruangan dengan
 * status online dan tombol uji (benar-benar melapor atau belum), muat ulang, putuskan, dan lapisan
 * darurat yang tersembunyi di bagian Lanjutan.
 */
export function RumahPintar({ status, ruanganAwal }: { status: StatusRumahTampil; ruanganAwal: Ruangan[] }) {
  const { t } = useKamus();
  const R = t.rumah;
  const [ruangan, setRuangan] = useState(ruanganAwal);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [lanjutan, setLanjutan] = useState(false);
  const [darurat, setDarurat] = useState<Darurat>(status.darurat);

  const muatUlang = async () => {
    setSibuk("muat");
    const { ok, data } = await kirim("/api/app/rumah/perangkat", "POST");
    setSibuk(null);
    if (ok) setRuangan(data.ruangan as Ruangan[]);
    else tampilToast(String(data.pesan ?? t.umum.galatUmum), "galat");
  };

  const uji = async (p: Perangkat) => {
    setSibuk(p.id);
    const { ok, data } = await kirim(`/api/app/rumah/perangkat/${encodeURIComponent(p.id)}/uji`, "POST");
    setSibuk(null);
    tampilToast(String(data.pesan ?? t.umum.galatUmum), ok && data.status !== "belum_terkonfirmasi" ? "ok" : "galat");
  };

  const putuskan = async () => {
    setSibuk("putus");
    const { ok, data } = await kirim("/api/app/rumah/kunci", "DELETE");
    if (ok) window.location.reload();
    else {
      setSibuk(null);
      tampilToast(String(data.pesan ?? t.umum.galatUmum), "galat");
    }
  };

  const aturDarurat = async (baru: Darurat) => {
    const lama = darurat;
    setDarurat(baru);
    const { ok, data } = await kirim("/api/app/rumah/darurat", "PATCH", baru);
    if (!ok) {
      setDarurat(lama);
      tampilToast(String(data.pesan ?? t.umum.galatUmum), "galat");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-judul-besar muncul pt-2">{R.judul}</h1>
      {status.bermasalah ? (
        <Spanduk
          nada="bahaya"
          judul={R.spanduk.judul}
          isi={R.spanduk.isi}
          aksi={
            <TautanTombol href="/app/rumah?perbarui=1" ukuran="sedang">
              {R.perbarui}
            </TautanTombol>
          }
        />
      ) : null}

      <section aria-label={R.judul} className="kaca flex flex-col gap-3 rounded-[22px] px-4 py-3.5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="t-kepala">{isi(R.tersambung, { wilayah: status.wilayah })}</p>
          <p className="t-subjudul mt-0.5 font-mono text-label-2">{status.kunciSamar}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tombol varian="kaca" ukuran="sedang" disabled={sibuk !== null} onClick={() => void muatUlang()}>
            <RefreshCw size={16} className={cn(sibuk === "muat" && "putar")} />
            {R.muatUlang}
          </Tombol>
          <TautanTombol varian="kaca" ukuran="sedang" href="/app/rumah?perbarui=1">
            {R.perbarui}
          </TautanTombol>
        </div>
      </section>

      {ruangan.length === 0 ? <p className="kaca rounded-[22px] px-4 py-4 text-[16px] text-label-2">{R.kosong}</p> : null}
      {ruangan.map((r) => (
        <section key={r.id ?? "tanpa"} aria-label={r.nama} className="flex flex-col gap-2">
          <h2 className="t-subjudul px-4 font-semibold text-label-2">{r.nama}</h2>
          <ul className="kaca divide-y divide-pemisah rounded-[22px]">
            {r.perangkat.map((p) => (
              <li key={p.id} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
                <KotakIkon ikon={ikonJenis(p.jenis)} warna={p.online ? "#f59e0b" : "#64748b"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px]">{p.nama}</span>
                  <span className={cn("t-keterangan flex items-center gap-1", p.online ? "text-label-2" : "text-waspada")}>
                    {p.online ? <Wifi size={13} /> : <WifiOff size={13} />}
                    {`${p.jenisLabel} · ${p.online ? R.online : R.offline}${bisaDipakai(p) ? "" : ` · ${R.hanyaPantau}`}`}
                  </span>
                </span>
                {p.online && bisaDipakai(p) ? (
                  <Tombol varian="kaca" ukuran="kecil" disabled={sibuk !== null} onClick={() => void uji(p)} aria-label={`${R.uji}: ${p.nama}`}>
                    {sibuk === p.id ? t.umum.memuat : R.uji}
                  </Tombol>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setLanjutan((v) => !v)}
          aria-expanded={lanjutan}
          className="tekan flex items-center gap-1.5 self-start px-4 text-[15px] font-semibold text-label-2"
        >
          <ChevronDown size={16} className={cn("transition-transform", lanjutan && "rotate-180")} />
          {t.umum.lanjutan}
        </button>
        {lanjutan ? (
          <div className="flex flex-col gap-2">
            <div className="kaca flex flex-col gap-3 rounded-[22px] px-4 py-3.5">
              <div className="flex items-center gap-3">
                <KotakIkon ikon={TriangleAlert} warna="#dc2626" />
                <span className="min-w-0 flex-1 text-[17px]">{R.darurat.aktif}</span>
                <Saklar nyala={darurat.aktif} ubah={(v) => void aturDarurat({ ...darurat, aktif: v })} label={R.darurat.aktif} />
              </div>
              {darurat.aktif ? (
                <div className="flex flex-col gap-2 sm:pl-[42px]">
                  <p className="t-keterangan text-label-2">{R.darurat.cara}</p>
                  <Segmen
                    label={R.darurat.cara}
                    nilai={darurat.cara}
                    ubah={(v) => void aturDarurat({ ...darurat, cara: v })}
                    pilihan={[
                      { nilai: "telepon", label: R.darurat.telepon },
                      { nilai: "sms", label: R.darurat.sms },
                    ]}
                  />
                  <p className="t-keterangan text-label-2">{R.darurat.kapan}</p>
                  <Segmen
                    label={R.darurat.kapan}
                    nilai={String(darurat.menit) as "10" | "15" | "20" | "30"}
                    ubah={(v) => void aturDarurat({ ...darurat, menit: Number(v) })}
                    pilihan={(["10", "15", "20", "30"] as const).map((n) => ({ nilai: n, label: isi(R.darurat.menit, { n }) }))}
                  />
                </div>
              ) : null}
            </div>
            <p className="t-keterangan px-4 text-label-2">{R.darurat.ket}</p>
            <Tombol varian="bahaya" ukuran="sedang" className="mt-2 self-start" disabled={sibuk !== null} onClick={() => void putuskan()}>
              <Unplug size={16} />
              {R.putuskan}
            </Tombol>
            <p className="t-keterangan px-4 text-label-2">{R.putuskanKet}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
