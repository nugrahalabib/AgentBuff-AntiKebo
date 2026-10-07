"use client";

import { Bot, Check, Copy, Cpu, KeyRound, Monitor, Trash2, User, XCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { Tombol } from "@/components/ui/dasar";
import { Lembar } from "@/components/ui/lembar";
import { tampilToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { panggilApi } from "@/lib/klien/api";
import { useDetik } from "@/lib/klien/jam";
import { waktuRelatif } from "@/lib/tampilan/uraian";

type Token = { id: string; label: string; awalan: string; sumber: string; terakhirDipakai: string | null; kedaluwarsa: string | null; dibuat: string };
type Aktivitas = { id: number; sumber: string; jenis: string; ringkasan: string; berhasil: boolean; dibuat: string };
export type DataAgen = { alamatMcp: string; token: Token[]; aktivitas: Aktivitas[] };

const IKON_SUMBER: Record<string, typeof Bot> = { agen: Bot, web: User, perangkat: Cpu, worker: Monitor, sistem: Monitor };

function TombolSalin({ teks, label }: { teks: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(teks);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          // Papan klip tidak diizinkan: abaikan.
        }
      }}
      className="tekan grid size-9 shrink-0 place-items-center rounded-full text-label-2 hover:bg-kaca-isi"
    >
      {ok ? <Check size={16} className="text-berhasil" /> : <Copy size={16} />}
    </button>
  );
}

/**
 * Halaman Agen (PRD L3, pola template Tuya): status sambung otomatis AgentBuff, contoh kalimat,
 * aktivitas terbaru (termasuk perubahan lewat agen), dan token manual untuk klien MCP lain.
 */
export function HalamanAgen({ awal, waktuServer, zona }: { awal: DataAgen; waktuServer: number; zona: string }) {
  const { t, b } = useKamus();
  const A = t.agen;
  const detik = useDetik(waktuServer, 30);
  const [data, setData] = useState(awal);
  const [tokenBaru, setTokenBaru] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [cabutId, setCabutId] = useState<string | null>(null);
  const [proses, setProses] = useState(false);
  const lalu = (iso: string) => waktuRelatif(iso, detik * 1000, t);

  const muat = useCallback(async () => {
    const r = await panggilApi<DataAgen>("/api/app/agen");
    if (r.ok) setData(r.data);
  }, []);

  const otomatis = data.token.find((x) => x.sumber === "agentbuff_otomatis");
  const semuaToken = [...(otomatis ? [otomatis] : []), ...data.token.filter((x) => x.sumber === "manual")];
  const dipilih = data.token.find((x) => x.id === cabutId) ?? null;

  const buat = async () => {
    setProses(true);
    const r = await panggilApi<{ token: string }>("/api/app/token", "POST", { label });
    setProses(false);
    if (!r.ok) return void tampilToast(r.pesan ?? t.umum.galatUmum, "galat");
    setTokenBaru(r.data.token);
    setLabel("");
    void muat();
  };

  const cabut = async () => {
    if (!dipilih) return;
    setProses(true);
    const r = await panggilApi(`/api/app/token/${dipilih.id}`, "DELETE");
    setProses(false);
    if (!r.ok) return void tampilToast(r.pesan ?? t.umum.galatUmum, "galat");
    setCabutId(null);
    tampilToast(A.dicabut);
    void muat();
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="muncul pt-2">
        <h1 className="t-judul-besar">{A.judul}</h1>
        <p className="t-subjudul mt-1 max-w-[56ch] text-label-2">{A.sub}</p>
      </header>

      <section className="kaca flex items-center gap-4 rounded-[28px] p-5">
        <span className="relative grid size-14 shrink-0 place-items-center rounded-[18px] text-white" style={{ background: "linear-gradient(135deg,#14b8a6,#4338ca 60%,#7c3aed)" }}>
          <Bot size={26} />
          <span className={cn("absolute -right-1 -bottom-1 size-4 rounded-full border-[3px] border-[var(--amb-dasar)]", otomatis ? "bg-berhasil-isi" : "bg-waspada-isi")} />
        </span>
        <div className="min-w-0">
          <p className="t-kepala">{otomatis ? A.statusOtomatis : A.statusMenunggu}</p>
          <p className="t-subjudul text-label-2">
            {otomatis ? (otomatis.terakhirDipakai ? isi(A.statusTerakhir, { waktu: lalu(otomatis.terakhirDipakai) }) : A.statusBelumDipakai) : A.statusMenungguIsi}
          </p>
        </div>
      </section>

      <section aria-labelledby="judul-coba">
        <h2 id="judul-coba" className="t-judul-3 mb-3">
          {A.cobaJudul}
        </h2>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {A.contoh.map((c) => (
            <li key={c} className="kaca flex items-center gap-2 rounded-[20px] py-2 pr-2 pl-4">
              <span className="min-w-0 flex-1 text-[15px]">{`\u201c${c}\u201d`}</span>
              <TombolSalin teks={c} label={`${A.salin}: ${c}`} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="judul-aktivitas">
        <h2 id="judul-aktivitas" className="t-judul-3 mb-3">
          {A.aktivitas}
        </h2>
        {data.aktivitas.length === 0 ? (
          <p className="t-subjudul text-label-2">{A.aktivitasKosong}</p>
        ) : (
          <ol className="kaca flex flex-col divide-y divide-pemisah overflow-hidden rounded-[24px]">
            {data.aktivitas.map((a) => {
              const I = IKON_SUMBER[a.sumber] ?? Monitor;
              return (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", a.sumber === "agen" ? "bg-aksen-isi text-white" : "bg-kaca-isi text-label-2")}>
                    <I size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{a.ringkasan}</span>
                    <span className="t-keterangan block text-label-2">
                      {(A.sumber as Record<string, string>)[a.sumber] ?? a.sumber} · {lalu(a.dibuat)}
                    </span>
                  </span>
                  {!a.berhasil ? <XCircle size={18} className="shrink-0 text-bahaya" /> : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <details className="kaca rounded-[24px]">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
          <KeyRound size={19} className="text-label-2" />
          <span>
            <span className="block text-[15px] font-semibold">{A.lanjutan}</span>
            <span className="t-keterangan block text-label-2">{A.lanjutanKet}</span>
          </span>
        </summary>
        <div className="border-t border-pemisah px-5 py-4">
          <p className="t-kapsi text-label-2 uppercase">{A.alamat}</p>
          <div className="mt-1.5 flex items-center gap-2 rounded-[14px] bg-kaca-isi py-1 pr-1 pl-3">
            <code className="min-w-0 flex-1 truncate text-[14px]">{data.alamatMcp}</code>
            <TombolSalin teks={data.alamatMcp} label={`${A.salin}: ${A.alamat}`} />
          </div>

          {tokenBaru ? (
            <div className="mt-4 rounded-[16px] bg-berhasil-isi/15 p-3" role="status">
              <p className="t-kepala">{A.tokenBaru}</p>
              <p className="t-keterangan text-label-2">{A.tokenKet}</p>
              <div className="mt-2 flex items-center gap-2 rounded-[12px] bg-kaca-kuat py-1 pr-1 pl-3">
                <code className="min-w-0 flex-1 truncate text-[13px]" data-token-baru>
                  {tokenBaru}
                </code>
                <TombolSalin teks={tokenBaru} label={`${A.salin}: ${A.tokenBaru}`} />
              </div>
            </div>
          ) : null}

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void buat();
            }}
          >
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={60}
              placeholder={A.label}
              aria-label={A.label}
              className="h-11 min-w-0 flex-1 rounded-[14px] bg-kaca-isi px-3.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-aksen-isi"
            />
            <Tombol type="submit" disabled={!label.trim() || proses}>
              {A.buatToken}
            </Tombol>
          </form>

          {semuaToken.length ? (
            <ul className="mt-4 flex flex-col gap-2">
              {semuaToken.map((x) => (
                <li key={x.id} className="flex items-center gap-3 rounded-[14px] bg-kaca-isi px-3.5 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">
                      {x.label} {x.sumber !== "manual" ? <span className="t-keterangan text-label-2">({A.otomatis})</span> : null}
                    </span>
                    <span className="t-keterangan block text-label-2">
                      <code>{x.awalan}…</code>
                      {x.kedaluwarsa
                        ? ` · ${isi(A.berakhir, { tanggal: new Intl.DateTimeFormat(b === "id" ? "id-ID" : "en-US", { timeZone: zona, day: "numeric", month: "short", year: "numeric" }).format(new Date(x.kedaluwarsa)) })}`
                        : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`${A.cabut}: ${x.label}`}
                    onClick={() => setCabutId(x.id)}
                    className="tekan grid size-10 place-items-center rounded-full text-label-2 hover:text-bahaya"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>

      <Lembar
        buka={!!dipilih}
        ubahBuka={(v) => !v && setCabutId(null)}
        judul={isi(A.cabutJudul, { label: dipilih?.label ?? "" })}
        kaki={
          <div className="flex gap-2.5">
            <Tombol varian="kaca" className="flex-1" onClick={() => setCabutId(null)}>
              {t.umum.batal}
            </Tombol>
            <Tombol varian="bahaya" className="flex-1" disabled={proses} onClick={() => void cabut()}>
              {proses ? t.umum.memuat : A.cabutYa}
            </Tombol>
          </div>
        }
      >
        <p className="t-isi text-label-2">{A.cabutIsi}</p>
      </Lembar>
    </div>
  );
}
