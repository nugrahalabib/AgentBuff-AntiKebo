"use client";

import { Bot, CalendarClock, Check, Copy, KeyRound, Monitor, Sparkles, Trash2, User, XCircle, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Tombol } from "@/components/ui/dasar";
import { tampilToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { api, useToko, type GalatApi } from "@/lib/app/toko";

type Token = { id: string; label: string; awalan: string; sumber: string; terakhirDipakai: string | null; kedaluwarsa: string | null; dibuat: string };
type Aktivitas = { id: number; sumber: string; jenis: string; ringkasan: string; berhasil: boolean; dibuat: string };
export type DataAgen = { alamatMcp: string; token: Token[]; aktivitas: Aktivitas[] };

const IKON_SUMBER: Record<string, typeof Bot> = { agen: Bot, web: User, jadwal: CalendarClock, suasana: Sparkles, otomasi: Zap, sistem: Monitor };

function lalu(iso: string, t: ReturnType<typeof useKamus>["t"]): string {
  const dtk = (Date.now() - new Date(iso).getTime()) / 1000;
  if (dtk < 60) return t.umum.baruSaja;
  if (dtk < 3600) return isi(t.umum.menitLalu, { n: Math.floor(dtk / 60) });
  if (dtk < 86400) return isi(t.umum.jamLalu, { n: Math.floor(dtk / 3600) });
  return isi(t.umum.hariLalu, { n: Math.floor(dtk / 86400) });
}

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
          /* abaikan */
        }
      }}
      className="tekan grid size-9 shrink-0 place-items-center rounded-full text-label-2 hover:bg-kaca-isi"
    >
      {ok ? <Check size={16} className="text-berhasil" /> : <Copy size={16} />}
    </button>
  );
}

export function HalamanAgen({ awal }: { awal: DataAgen }) {
  const { t } = useKamus();
  const A = t.agen;
  const [data, setData] = useState(awal);
  const [tokenBaru, setTokenBaru] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  const muat = useCallback(async () => {
    try {
      setData(await api<DataAgen>("/api/app/agen"));
    } catch {
      /* data lama tetap */
    }
  }, []);
  // Rumah berubah (SSE) -> segarkan juga daftar ini. Langganan toko = sistem luar, bukan setState di badan efek.
  useEffect(() => useToko.subscribe((s, lama) => s.data !== lama.data && void muat()), [muat]);

  const otomatis = data.token.find((x) => x.sumber === "agentbuff_otomatis");
  const manual = data.token.filter((x) => x.sumber === "manual");

  return (
    <div>
      <header className="muncul pr-14">
        <h1 className="t-judul-besar">{A.judul}</h1>
        <p className="t-subjudul mt-1 max-w-[52ch] text-label-2">{A.sub}</p>
      </header>

      <section className="muncul kaca mt-8 flex items-center gap-4 rounded-[28px] p-5 [animation-delay:60ms]">
        <span className="relative grid size-14 shrink-0 place-items-center rounded-[18px] text-white" style={{ background: "linear-gradient(135deg,#22d3ee,#6366f1 55%,#a855f7)" }}>
          <Bot size={26} />
          <span className={cn("absolute -right-1 -bottom-1 size-4 rounded-full border-[3px] border-[var(--amb-dasar)]", otomatis ? "bg-berhasil-isi" : "denyut bg-waspada-isi")} />
        </span>
        <div className="min-w-0">
          <p className="t-kepala">{otomatis ? A.statusOtomatis : A.statusMenunggu}</p>
          <p className="t-subjudul text-label-2">
            {otomatis ? (otomatis.terakhirDipakai ? isi(A.statusTerakhir, { waktu: lalu(otomatis.terakhirDipakai, t) }) : A.statusBelumDipakai) : A.statusMenungguIsi}
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="t-judul-3 mb-3">{A.cobaJudul}</h2>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {A.contoh.map((c) => (
            <li key={c} className="kaca flex items-center gap-2 rounded-[20px] py-2 pr-2 pl-4">
              <span className="min-w-0 flex-1 text-[15px]">“{c}”</span>
              <TombolSalin teks={c} label={A.cobaSalin} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="t-judul-3 mb-3">{A.aktivitas}</h2>
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
                      {(A.sumber as Record<string, string>)[a.sumber] ?? a.sumber} · {lalu(a.dibuat, t)}
                    </span>
                  </span>
                  {!a.berhasil ? <XCircle size={18} className="shrink-0 text-bahaya" /> : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <details className="kaca mt-10 rounded-[24px]">
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
            <TombolSalin teks={data.alamatMcp} label={t.umum.salin} />
          </div>

          {tokenBaru ? (
            <div className="mt-4 rounded-[16px] bg-berhasil-isi/15 p-3">
              <p className="t-kepala">{A.tokenBaru}</p>
              <p className="t-keterangan text-label-2">{A.tokenKet}</p>
              <div className="mt-2 flex items-center gap-2 rounded-[12px] bg-kaca-kuat py-1 pr-1 pl-3">
                <code className="min-w-0 flex-1 truncate text-[13px]">{tokenBaru}</code>
                <TombolSalin teks={tokenBaru} label={t.umum.salin} />
              </div>
            </div>
          ) : null}

          <form
            className="mt-4 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const r = await api<{ token: string }>("/api/app/token", { method: "POST", json: { label } });
                setTokenBaru(r.token);
                setLabel("");
                void muat();
              } catch (er) {
                tampilToast((er as GalatApi).pesan ?? t.umum.galatUmum, "galat");
              }
            }}
          >
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder={A.buatToken} aria-label={A.buatToken} className="h-11 min-w-0 flex-1 rounded-[14px] bg-kaca-isi px-3.5 text-[15px]" />
            <Tombol type="submit" disabled={!label.trim()}>
              {A.buatToken}
            </Tombol>
          </form>

          {[...(otomatis ? [otomatis] : []), ...manual].length ? (
            <ul className="mt-4 flex flex-col gap-2">
              {[...(otomatis ? [otomatis] : []), ...manual].map((x) => (
                <li key={x.id} className="flex items-center gap-3 rounded-[14px] bg-kaca-isi px-3.5 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">
                      {x.label} {x.sumber !== "manual" ? <span className="t-keterangan text-label-2">({A.otomatis})</span> : null}
                    </span>
                    <span className="t-keterangan block text-label-2">
                      <code>{x.awalan}…</code>
                      {x.kedaluwarsa ? ` · ${isi(A.berakhir, { tanggal: new Date(x.kedaluwarsa).toLocaleDateString() })}` : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={A.cabut}
                    onClick={async () => {
                      if (!window.confirm(isi(A.cabutTanya, { label: x.label }))) return;
                      try {
                        await api(`/api/app/token/${x.id}`, { method: "DELETE" });
                        void muat();
                      } catch (er) {
                        tampilToast((er as GalatApi).pesan ?? t.umum.galatUmum, "galat");
                      }
                    }}
                    className="tekan grid size-9 place-items-center rounded-full text-label-2 hover:text-bahaya"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>
    </div>
  );
}
