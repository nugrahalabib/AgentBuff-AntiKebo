"use client";

import { Bot, Trash2, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Saklar } from "@/components/ui/dasar";
import { tampilToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { api, useToko, type GalatApi } from "@/lib/app/toko";
import type { DataOtomasi } from "@/lib/app/data";

/** Daftar otomasi (dibuat lewat agen): nyalakan/jeda dan hapus di sini. */
export function DaftarOtomasi({ awal }: { awal: DataOtomasi[] }) {
  const { t, b } = useKamus();
  const O = t.otomasi;
  const [daftar, setDaftar] = useState(awal);
  const [siapHapus, setSiapHapus] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      setDaftar(await api<DataOtomasi[]>("/api/app/otomasi"));
    } catch {
      /* tetap tampilkan data lama */
    }
  }, []);
  useEffect(() => useToko.subscribe((s, lama) => s.data !== lama.data && void muat()), [muat]);

  const ubahAktif = async (o: DataOtomasi, aktif: boolean) => {
    setDaftar((d) => d.map((x) => (x.id === o.id ? { ...x, aktif } : x)));
    try {
      await api(`/api/app/otomasi/${o.id}`, { method: "PATCH", json: { aktif } });
    } catch (e) {
      tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
    }
    void muat();
  };

  const hapus = async (o: DataOtomasi) => {
    if (siapHapus !== o.id) {
      setSiapHapus(o.id);
      setTimeout(() => setSiapHapus((x) => (x === o.id ? null : x)), 3000);
      return;
    }
    setSiapHapus(null);
    setDaftar((d) => d.filter((x) => x.id !== o.id));
    try {
      await api(`/api/app/otomasi/${o.id}`, { method: "DELETE" });
    } catch (e) {
      tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
      void muat();
    }
  };

  const waktu = (iso: string) =>
    new Intl.DateTimeFormat(b === "en" ? "en-GB" : "id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <section className="mt-12" aria-labelledby="judul-otomasi">
      <h2 id="judul-otomasi" className="t-judul-2">
        {O.judul}
      </h2>
      <p className="t-subjudul mt-1 text-label-2">{O.sub}</p>
      {daftar.length === 0 ? (
        <div className="kaca mt-5 flex items-start gap-4 rounded-[24px] p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-kaca-isi text-label-2">
            <Zap size={22} />
          </span>
          <div>
            <p className="t-kepala">{O.kosongJudul}</p>
            <p className="t-subjudul mt-1 text-label-2">{O.kosongIsi}</p>
          </div>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {daftar.map((o, i) => (
            <li key={o.id} className={cn("muncul kaca flex items-center gap-4 rounded-[24px] p-4 sm:p-5", !o.aktif && "opacity-70")} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <span className="grid size-12 shrink-0 place-items-center rounded-[16px] text-white" style={{ background: "linear-gradient(135deg,#30d158,#0a84ff)" }}>
                <Zap size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="t-kepala truncate">{o.nama}</p>
                <p className="t-subjudul line-clamp-2 text-label-2">{o.uraian}</p>
                <p className="t-keterangan mt-0.5 flex flex-wrap items-center gap-x-2 text-label-3">
                  {o.dibuatOleh === "agen" ? (
                    <span className="inline-flex items-center gap-1">
                      <Bot size={12} />
                      {O.olehAgen}
                    </span>
                  ) : null}
                  {!o.aktif ? <span>{O.dijeda}</span> : null}
                  {o.terakhirJalan ? (
                    <span className={cn(o.terakhirHasil && o.terakhirHasil !== "ok" && o.terakhirHasil !== "berjalan" && "text-waspada")}>
                      {isi(O.terakhir, { waktu: waktu(o.terakhirJalan) })}
                      {o.terakhirHasil && o.terakhirHasil !== "ok" && o.terakhirHasil !== "berjalan" ? ` · ${O.gagalSebagian}` : ""}
                    </span>
                  ) : null}
                </p>
              </div>
              <Saklar nyala={o.aktif} ubah={(v) => void ubahAktif(o, v)} label={o.nama} />
              <button
                type="button"
                onClick={() => void hapus(o)}
                aria-label={siapHapus === o.id ? O.hapusTanya : t.umum.hapus}
                className={cn("tekan flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold", siapHapus === o.id ? "bg-bahaya-isi px-3.5 text-white" : "w-10 text-label-2 hover:text-bahaya")}
              >
                <Trash2 size={18} />
                {siapHapus === o.id ? t.umum.hapus : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
