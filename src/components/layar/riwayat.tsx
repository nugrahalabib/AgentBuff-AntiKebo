"use client";

import { ChevronDown, Clock, Download, Flame, Hourglass } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Segmen, TautanTombol, Tombol } from "@/components/ui/dasar";
import { Cincin } from "@/components/ui/cincin";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import type { KejadianRiwayat } from "@/lib/tampilan/jenis";

/**
 * Riwayat (docs/04-DESAIN.md §4.9): cincin skor hari ini, hari beruntun, grafik 7/30 hari,
 * daftar kejadian. Grafik mengikuti panduan dataviz: satu seri (tanpa kotak legenda; judul
 * menamainya), batang ≤ 24 px berujung bundar 4 px, garis bantu rambut, label hanya nilai
 * terakhir, tooltip per batang (arahkan atau fokus papan ketik), tabel tersembunyi untuk pembaca layar.
 */
export function LayarRiwayat({
  skorHariIni,
  beruntun,
  rataMenit,
  totalTunda,
  skor30,
  labelHari,
  kejadian,
  ekspor,
  hrefEkspor,
  pilih,
  rincian,
}: {
  skorHariIni: number | null;
  beruntun: number;
  rataMenit: number | null;
  totalTunda: number;
  skor30: Array<number | null>;
  /** Label tanggal tiap titik skor30 (sama panjang). */
  labelHari: string[];
  kejadian: KejadianRiwayat[];
  ekspor?: () => void;
  /** Unduhan CSV (PRD K3); bila ada, dipakai sebagai tautan unduh. */
  hrefEkspor?: string;
  /** Buka/tutup rincian kejadian (PRD K1). */
  pilih?: (id: string) => void;
  rincian?: { id: string; isi: ReactNode } | null;
}) {
  const { t } = useKamus();
  const R = t.riwayat;
  const [rentang, setRentang] = useState<"7" | "30">("7");
  const n = rentang === "7" ? 7 : 30;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <h1 className="t-judul-besar muncul flex-1">{R.judul}</h1>
        {hrefEkspor ? (
          <TautanTombol href={hrefEkspor} download varian="kaca" ukuran="kecil">
            <Download size={16} />
            {R.ekspor}
          </TautanTombol>
        ) : (
          <Tombol varian="kaca" ukuran="kecil" onClick={ekspor}>
            <Download size={16} />
            {R.ekspor}
          </Tombol>
        )}
      </header>

      <section className="kaca-kuat flex flex-col items-center gap-5 rounded-[30px] p-6 sm:flex-row sm:items-center">
        <Cincin nilai={(skorHariIni ?? 0) / 100} ukuran={132} tebal={14} warna="var(--grafik)" label={`${R.skorHariIni} ${skorHariIni ?? R.belumAda}`}>
          <span className="flex flex-col items-center">
            <span className={cn("t-angka leading-none font-bold", skorHariIni === null ? "text-[22px] text-label-2" : "text-[40px]")}>{skorHariIni ?? R.belumAda}</span>
            <span className="t-keterangan mt-1 text-label-2">{R.skorHariIni}</span>
          </span>
        </Cincin>
        <dl className="grid w-full flex-1 grid-cols-1 gap-2.5 sm:grid-cols-1">
          <Statistik ikon={<Flame size={18} strokeWidth={1.75} />} label={isi(R.beruntun, { n: beruntun })} />
          <Statistik ikon={<Clock size={18} strokeWidth={1.75} />} label={R.rata} nilai={rataMenit === null ? R.belumAda : isi(t.pagi.menit, { n: rataMenit })} />
          <Statistik ikon={<Hourglass size={18} strokeWidth={1.75} />} label={R.totalTunda} nilai={String(totalTunda)} />
        </dl>
      </section>

      <section aria-labelledby="judul-grafik" className="kaca flex flex-col gap-4 rounded-[26px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="judul-grafik" className="t-judul-3">
            {R.grafik}
          </h2>
          <div className="w-[180px]">
            <Segmen
              label={R.grafik}
              nilai={rentang}
              ubah={setRentang}
              pilihan={[
                { nilai: "7", label: R.hari7 },
                { nilai: "30", label: R.hari30 },
              ]}
            />
          </div>
        </div>
        <GrafikSkor nilai={skor30.slice(-n)} label={labelHari.slice(-n)} judul={R.grafik} />
      </section>

      <section aria-labelledby="judul-kejadian" className="flex flex-col gap-2">
        <h2 id="judul-kejadian" className="t-subjudul px-1 font-semibold text-label-2">
          {R.kejadian}
        </h2>
        {kejadian.length ? (
          <ul className="kaca divide-y divide-pemisah overflow-hidden rounded-[22px]">
            {kejadian.map((k) => {
              const terbuka = rincian?.id === k.id;
              const isiBaris = (
                <>
                  <div className="w-[76px] shrink-0">
                    <p className="t-angka text-[19px] font-semibold">{k.jam}</p>
                    <p className="t-keterangan whitespace-nowrap text-label-2">{k.tanggal}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="t-kepala truncate">{k.judul}</p>
                    <p className="t-keterangan text-label-2">
                      {k.status === "terlewat"
                        ? R.status.terlewat
                        : k.status === "tidak_bangun"
                          ? isi(R.rincianTidakBangun, { tunda: k.tunda, kanal: k.pesanKanal })
                          : isi(R.rincian, { tunda: k.tunda, menit: k.menitSampaiBangun, kanal: k.pesanKanal })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold",
                      k.status === "bangun" ? "bg-berhasil-isi/15 text-berhasil" : k.status === "tidak_bangun" ? "bg-bahaya-isi/12 text-bahaya" : "bg-kaca-isi text-label-2",
                    )}
                  >
                    {k.skor !== null ? `${k.skor}` : R.status[k.status]}
                  </span>
                </>
              );
              return (
                <li key={k.id}>
                  {pilih ? (
                    <button
                      type="button"
                      aria-expanded={terbuka}
                      aria-label={`${k.judul}, ${k.jam}. ${terbuka ? R.tutupRincian : R.lihatRincian}`}
                      onClick={() => pilih(k.id)}
                      className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-kaca-isi/60"
                    >
                      {isiBaris}
                      <ChevronDown size={18} className={cn("shrink-0 text-label-3 transition-transform", terbuka && "rotate-180")} aria-hidden />
                    </button>
                  ) : (
                    <div className="flex items-center gap-4 px-4 py-3.5">{isiBaris}</div>
                  )}
                  {terbuka ? <div className="px-4 pb-4">{rincian.isi}</div> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="kaca rounded-[22px] p-5 text-[15px] text-label-2">{R.kosong}</p>
        )}
      </section>
    </div>
  );
}

function Statistik({ ikon, label, nilai }: { ikon: React.ReactNode; label: string; nilai?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-kaca-isi px-4 py-2.5">
      <span className="text-label-2">{ikon}</span>
      <dt className="flex-1 text-[15px] font-semibold">{label}</dt>
      {nilai ? <dd className="t-angka text-[17px] font-semibold">{nilai}</dd> : null}
    </div>
  );
}

const TINGGI = 180;
const ATAS = 16;
const BAWAH = 26;

/** Grafik batang skor 0..100. Satu seri, satu sumbu. */
function GrafikSkor({ nilai, label, judul }: { nilai: Array<number | null>; label: string[]; judul: string }) {
  const [sorot, setSorot] = useState<number | null>(null);
  const lebar = 640;
  const kiri = 30;
  const slot = (lebar - kiri) / nilai.length;
  const tebal = Math.min(24, slot - 2);
  const y = (v: number) => ATAS + (TINGGI - ATAS - BAWAH) * (1 - v / 100);
  const terakhir = nilai.length - 1;
  const jarangLabel = nilai.length > 10;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${lebar} ${TINGGI}`} className="h-auto w-full overflow-visible" role="img" aria-label={judul}>
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={kiri} x2={lebar} y1={y(g)} y2={y(g)} stroke="var(--grafik-garis)" strokeWidth={1} />
            <text x={kiri - 8} y={y(g) + 4} textAnchor="end" className="fill-label-2 text-[12px]">
              {g}
            </text>
          </g>
        ))}
        {nilai.map((v, i) => {
          const cx = kiri + slot * i + slot / 2;
          const tampilLabel = !jarangLabel || i % 5 === terakhir % 5;
          return (
            <g key={i}>
              {v === null ? (
                <circle cx={cx} cy={y(0) - 3} r={2.5} fill="var(--grafik-garis)" />
              ) : (
                <path
                  d={batang(cx - tebal / 2, y(v), tebal, y(0) - y(v))}
                  fill="var(--grafik)"
                  opacity={sorot === null || sorot === i ? 1 : 0.55}
                  style={{ transition: "opacity 0.15s" }}
                />
              )}
              {/* Sasaran sentuh/arah selebar slot, lebih besar dari batangnya. */}
              <rect
                x={kiri + slot * i}
                y={ATAS}
                width={slot}
                height={TINGGI - ATAS - BAWAH}
                fill="transparent"
                tabIndex={v === null ? -1 : 0}
                aria-label={`${label[i]}: ${v ?? "-"}`}
                onPointerEnter={() => setSorot(i)}
                onPointerLeave={() => setSorot(null)}
                onFocus={() => setSorot(i)}
                onBlur={() => setSorot(null)}
              />
              {tampilLabel ? (
                <text x={cx} y={TINGGI - 6} textAnchor="middle" className="fill-label-2 text-[12px]">
                  {label[i]}
                </text>
              ) : null}
              {i === terakhir && v !== null ? (
                <text x={cx} y={y(v) - 6} textAnchor="middle" className="fill-label text-[12px] font-semibold">
                  {v}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {sorot !== null && nilai[sorot] !== null ? (
        <div
          role="status"
          className="kaca-kuat pointer-events-none absolute top-0 rounded-[12px] px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap"
          style={{ left: `${((kiri + slot * sorot + slot / 2) / lebar) * 100}%`, transform: "translateX(-50%)" }}
        >
          {label[sorot]} · {nilai[sorot]}
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{judul}</caption>
        <tbody>
          {nilai.map((v, i) => (
            <tr key={i}>
              <th scope="row">{label[i]}</th>
              <td>{v ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Batang dengan ujung atas membulat 4 px dan dasar persegi. */
function batang(x: number, yAtas: number, l: number, t: number): string {
  const r = Math.min(4, l / 2, t);
  return `M${x},${yAtas + t}V${yAtas + r}Q${x},${yAtas} ${x + r},${yAtas}H${x + l - r}Q${x + l},${yAtas} ${x + l},${yAtas + r}V${yAtas + t}Z`;
}
