"use client";

import { ChevronRight, Lamp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Penghitung, Saklar, Segmen } from "@/components/ui/dasar";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import type { AturanTuya } from "@/lib/tampilan/alarm-klien";

export type BisaPerangkat = { nyala: boolean; terang: boolean; warna: boolean; suhuPutih: boolean; suhuAc: { min: number; max: number } | null; modeAc: string[] };
export type PerangkatAturan = { id: string; nama: string; ruang: string; online: boolean; bisa: BisaPerangkat };
export type DataRumah = { status: "memuat" } | { status: "belum" } | { status: "ada"; perangkat: PerangkatAturan[] } | { status: "galat"; pesan: string };

type ModeAc = NonNullable<AturanTuya["aksi"]["modeAc"]>;
/** Makna mode AC dari Tuya (cold, hot, ...) -> pilihan aturan berbahasa Indonesia. */
const MODE_AC: Record<string, ModeAc> = {
  cold: "dingin",
  cool: "dingin",
  hot: "panas",
  heat: "panas",
  wind: "kipas",
  fan: "kipas",
  dry: "kering",
  wet: "kering",
  auto: "otomatis",
};
const MENIT_SEBELUM = ["5", "10", "15", "30"] as const;

export const bisaDipakai = (p: PerangkatAturan) => p.bisa.nyala || p.bisa.terang;

function aturanBaru(p: PerangkatAturan): AturanTuya {
  return { perangkatId: p.id, kapan: "bareng", menitSebelum: null, aksi: { nyala: true, ...(p.bisa.terang ? { terang: 100 } : {}) }, kedip: false, sesudahBangun: "kembalikan" };
}

/**
 * Rumah pintar per alarm (PRD I3): satu aturan per perangkat. Kapan (sebelum X menit naik bertahap,
 * saat berbunyi, saat tunda, sesudah bangun), aksi sesuai kemampuan perangkat, kedip, dan apa yang
 * terjadi sesudah bangun. Belum tersambung = satu baris menuju wizard.
 */
export function EditorAturanRumah({ aturan, ubah, data }: { aturan: AturanTuya[]; ubah: (a: AturanTuya[]) => void; data: DataRumah }) {
  const { t } = useKamus();
  const R = t.ubah.rumahAturan;
  const [buka, setBuka] = useState<number | null>(null);
  const [memilih, setMemilih] = useState(false);

  if (data.status === "belum")
    return (
      <Link href="/app/rumah" className="tekan flex h-12 w-full items-center gap-3 rounded-[16px] bg-kaca-isi px-3.5 text-left text-[15px] font-semibold">
        <Lamp size={18} strokeWidth={1.75} className="text-label-2" />
        <span className="flex-1">{t.ubah.rumahSambung}</span>
        <ChevronRight size={18} className="text-label-3" />
      </Link>
    );
  if (data.status === "memuat") return <p className="t-keterangan text-label-2">{t.umum.memuat}</p>;
  if (data.status === "galat") return <p className="t-keterangan text-waspada">{data.pesan}</p>;

  const perangkat = data.perangkat.filter(bisaDipakai);
  const cari = (id: string) => data.perangkat.find((p) => p.id === id);
  const ganti = (i: number, a: AturanTuya) => ubah(aturan.map((x, j) => (j === i ? a : x)));
  const belumDipakai = perangkat.filter((p) => !aturan.some((a) => a.perangkatId === p.id));

  const ringkas = (a: AturanTuya) => {
    const p = cari(a.perangkatId);
    const kapan = a.kapan === "sebelum" ? isi(R.menitSebelum, { n: a.menitSebelum ?? 10 }) : R.kapan[a.kapan];
    const aksi = a.aksi.nyala === false ? R.mati : a.aksi.terang !== undefined ? isi(R.terangN, { n: a.aksi.terang }) : R.nyala;
    return { nama: p?.nama ?? R.hilang, teks: `${kapan} · ${aksi}${a.kedip ? ` · ${R.kedipPendek}` : ""}` };
  };

  return (
    <div className="flex flex-col gap-2">
      {aturan.map((a, i) => {
        const p = cari(a.perangkatId);
        const r = ringkas(a);
        const terbuka = buka === i;
        return (
          <div key={`${a.perangkatId}-${i}`} className="rounded-[16px] bg-kaca-isi">
            <button type="button" aria-expanded={terbuka} onClick={() => setBuka(terbuka ? null : i)} className="tekan flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
              <Lamp size={18} strokeWidth={1.75} className={p?.online === false ? "text-label-3" : "text-amber-500"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{r.nama}</span>
                <span className="t-keterangan block truncate text-label-2">{r.teks}</span>
              </span>
              <ChevronRight size={18} className={cn("text-label-3 transition-transform", terbuka && "rotate-90")} />
            </button>
            {terbuka && p ? <IsianAturan a={a} p={p} ubah={(x) => ganti(i, x)} hapus={() => (ubah(aturan.filter((_, j) => j !== i)), setBuka(null))} /> : null}
            {terbuka && !p ? (
              <div className="px-3.5 pb-3">
                <p className="t-keterangan text-waspada">{R.hilangKet}</p>
                <button
                  type="button"
                  onClick={() => (ubah(aturan.filter((_, j) => j !== i)), setBuka(null))}
                  className="tekan mt-2 flex h-10 items-center gap-1.5 text-[15px] font-semibold text-bahaya"
                >
                  <Trash2 size={16} />
                  {R.hapus}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
      {memilih ? (
        <div className="rounded-[16px] bg-kaca-isi p-2">
          <p className="t-keterangan px-1.5 pb-1 text-label-2">{R.pilih}</p>
          <ul className="flex flex-col">
            {belumDipakai.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    ubah([...aturan, aturanBaru(p)]);
                    setBuka(aturan.length);
                    setMemilih(false);
                  }}
                  className="tekan flex min-h-11 w-full items-center gap-2 rounded-[12px] px-2 text-left text-[15px] hover:bg-kaca-isi"
                >
                  <span className="min-w-0 flex-1 truncate">{p.nama}</span>
                  <span className="t-keterangan text-label-2">{p.online ? p.ruang : t.rumah.offline}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {perangkat.length === 0 ? (
        <p className="t-keterangan text-label-2">{R.kosong}</p>
      ) : belumDipakai.length && !memilih && aturan.length < 20 ? (
        <button type="button" onClick={() => setMemilih(true)} className="tekan flex h-11 items-center gap-1.5 self-start text-[15px] font-semibold text-aksen">
          <Plus size={17} strokeWidth={2.4} />
          {R.tambah}
        </button>
      ) : null}
    </div>
  );
}

function IsianAturan({ a, p, ubah, hapus }: { a: AturanTuya; p: PerangkatAturan; ubah: (a: AturanTuya) => void; hapus: () => void }) {
  const { t } = useKamus();
  const R = t.ubah.rumahAturan;
  const aksi = (x: Partial<AturanTuya["aksi"]>) => ubah({ ...a, aksi: { ...a.aksi, ...x } });
  const modeAc = [...new Set(p.bisa.modeAc.map((m) => MODE_AC[m.toLowerCase()]).filter((m): m is ModeAc => !!m))];
  const nyala = a.aksi.nyala !== false;
  return (
    <div className="flex flex-col gap-3 border-t border-pemisah px-3.5 pt-3 pb-3.5">
      <Segmen
        label={R.kapanLabel}
        nilai={a.kapan}
        ubah={(k) => ubah({ ...a, kapan: k, menitSebelum: k === "sebelum" ? (a.menitSebelum ?? 10) : null })}
        pilihan={(["sebelum", "bareng", "tunda", "sesudah"] as const).map((k) => ({ nilai: k, label: R.kapanPendek[k] }))}
      />
      {a.kapan === "sebelum" ? (
        <Segmen
          label={R.kapanLabel}
          nilai={String(a.menitSebelum ?? 10) as (typeof MENIT_SEBELUM)[number]}
          ubah={(m) => ubah({ ...a, menitSebelum: Number(m) })}
          pilihan={MENIT_SEBELUM.map((m) => ({ nilai: m, label: isi(R.menitPendek, { n: m }) }))}
        />
      ) : null}
      {a.kapan === "sebelum" && p.bisa.terang ? <p className="t-keterangan text-label-2">{R.naikKet}</p> : null}
      <Baris label={nyala ? R.nyala : R.mati}>
        <Saklar
          nyala={nyala}
          label={R.nyala}
          ubah={(v) => aksi(v ? { nyala: true } : { nyala: false, terang: undefined, warna: undefined, suhuPutih: undefined, suhuAc: undefined, modeAc: undefined })}
        />
      </Baris>
      {nyala && p.bisa.terang ? (
        <Geser label={isi(R.terangN, { n: a.aksi.terang ?? 100 })} nilai={a.aksi.terang ?? 100} min={1} maks={100} ubah={(n) => aksi({ terang: n })} />
      ) : null}
      {nyala && p.bisa.suhuPutih ? (
        <Geser
          label={R.suhuPutih}
          nilai={a.aksi.suhuPutih ?? 50}
          min={0}
          maks={100}
          ubah={(n) => aksi({ suhuPutih: n, warna: undefined })}
          kosong={a.aksi.suhuPutih === undefined}
          hapus={() => aksi({ suhuPutih: undefined })}
        />
      ) : null}
      {nyala && p.bisa.warna ? (
        <Baris label={R.warna}>
          <span className="flex items-center gap-2">
            {a.aksi.warna ? (
              <button type="button" onClick={() => aksi({ warna: undefined })} className="tekan text-[14px] font-semibold text-label-2">
                {R.tanpaWarna}
              </button>
            ) : null}
            <input
              type="color"
              aria-label={R.warna}
              value={a.aksi.warna ?? "#ffb347"}
              onChange={(e) => aksi({ warna: e.target.value, suhuPutih: undefined })}
              className="h-10 w-14 cursor-pointer rounded-[10px] bg-transparent"
            />
          </span>
        </Baris>
      ) : null}
      {nyala && p.bisa.suhuAc ? (
        <Baris label={R.suhuAc}>
          <Penghitung
            nilai={a.aksi.suhuAc ?? 24}
            min={Math.max(16, Math.ceil(p.bisa.suhuAc.min))}
            maks={Math.min(30, Math.floor(p.bisa.suhuAc.max))}
            ubah={(n) => aksi({ suhuAc: n })}
            label={R.suhuAc}
            labelKurang={t.umum.kurangi}
            labelTambah={t.umum.tambah}
            satuan={`${a.aksi.suhuAc ?? 24}°`}
          />
        </Baris>
      ) : null}
      {nyala && modeAc.length ? (
        <Segmen label={R.modeAcLabel} nilai={a.aksi.modeAc ?? null} ubah={(m) => aksi({ modeAc: m })} pilihan={modeAc.map((m) => ({ nilai: m, label: R.modeAc[m] }))} />
      ) : null}
      {p.bisa.terang && a.kapan !== "sesudah" ? (
        <Baris label={R.kedip} keterangan={R.kedipKet}>
          <Saklar nyala={a.kedip} label={R.kedip} ubah={(v) => ubah({ ...a, kedip: v, aksi: v ? { ...a.aksi, nyala: true } : a.aksi })} />
        </Baris>
      ) : null}
      {a.kapan !== "sesudah" ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[15px]">{R.sesudahBangun}</span>
          <Segmen
            label={R.sesudahBangun}
            nilai={a.sesudahBangun}
            ubah={(s) => ubah({ ...a, sesudahBangun: s })}
            pilihan={(p.bisa.terang ? (["kembalikan", "suasana_pagi", "biarkan"] as const) : (["kembalikan", "biarkan"] as const)).map((s) => ({ nilai: s, label: R.sesudah[s] }))}
          />
        </div>
      ) : null}
      <button type="button" onClick={hapus} className="tekan flex h-10 items-center gap-1.5 self-start text-[15px] font-semibold text-bahaya">
        <Trash2 size={16} />
        {R.hapus}
      </button>
    </div>
  );
}

function Baris({ label, keterangan, children }: { label: string; keterangan?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        {keterangan ? <span className="t-keterangan block text-label-2">{keterangan}</span> : null}
      </span>
      {children}
    </div>
  );
}

function Geser({
  label,
  nilai,
  min,
  maks,
  ubah,
  kosong,
  hapus,
}: {
  label: string;
  nilai: number;
  min: number;
  maks: number;
  ubah: (n: number) => void;
  kosong?: boolean;
  hapus?: () => void;
}) {
  const { t } = useKamus();
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-[15px]">
        {label}
        {hapus && !kosong ? (
          <button type="button" onClick={hapus} className="tekan text-[14px] font-semibold text-label-2">
            {t.ubah.rumahAturan.tanpaWarna}
          </button>
        ) : null}
      </span>
      <input
        type="range"
        min={min}
        max={maks}
        value={nilai}
        onChange={(e) => ubah(Number(e.target.value))}
        className={cn("h-11 w-full accent-[var(--toska-isi)]", kosong && "opacity-50")}
      />
    </label>
  );
}
