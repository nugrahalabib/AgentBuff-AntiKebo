"use client";

import { Bot, CalendarClock, Plus, Timer, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Kosong, Saklar, Segmen, Tombol } from "@/components/ui/dasar";
import { Lembar } from "@/components/ui/lembar";
import { tampilToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { api, useToko, type GalatApi } from "@/lib/app/toko";
import type { DataJadwal, DataOtomasi, DataRumah } from "@/lib/app/data";
import { DaftarOtomasi } from "./otomasi";

function waktuRelatif(iso: string | null, b: "id" | "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(b === "en" ? "en-GB" : "id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function HalamanJadwal({ awalRumah, awalJadwal, awalOtomasi }: { awalRumah: DataRumah; awalJadwal: DataJadwal[]; awalOtomasi: DataOtomasi[] }) {
  const { t, b } = useKamus();
  const setel = useToko((s) => s.setel);
  const [jadwal, setJadwal] = useState(awalJadwal);
  const [baru, setBaru] = useState(false);
  useEffect(() => setel(awalRumah), [awalRumah, setel]);

  const muat = useCallback(async () => {
    try {
      setJadwal(await api<DataJadwal[]>("/api/app/jadwal"));
    } catch {
      /* tetap tampilkan data lama */
    }
  }, []);
  // Rumah berubah (SSE) -> segarkan juga daftar ini. Langganan toko = sistem luar, bukan setState di badan efek.
  useEffect(() => useToko.subscribe((s, lama) => s.data !== lama.data && void muat()), [muat]);

  const ubahAktif = async (j: DataJadwal, aktif: boolean) => {
    setJadwal((d) => d.map((x) => (x.id === j.id ? { ...x, aktif } : x)));
    try {
      await api(`/api/app/jadwal/${j.id}`, { method: "PATCH", json: { aktif } });
    } catch (e) {
      tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
    }
    void muat();
  };

  // Hapus dua ketukan: ketukan pertama mengubah tombol jadi "Hapus", kedua menghapus.
  const [siapHapus, setSiapHapus] = useState<string | null>(null);
  const hapus = async (j: DataJadwal) => {
    if (siapHapus !== j.id) {
      setSiapHapus(j.id);
      setTimeout(() => setSiapHapus((x) => (x === j.id ? null : x)), 3000);
      return;
    }
    setSiapHapus(null);
    setJadwal((d) => d.filter((x) => x.id !== j.id));
    try {
      await api(`/api/app/jadwal/${j.id}`, { method: "DELETE" });
    } catch (e) {
      tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
      void muat();
    }
  };

  return (
    <div>
      <header className="muncul flex flex-wrap items-end justify-between gap-4 pr-14">
        <div>
          <h1 className="t-judul-besar">{t.jadwal.judul}</h1>
          <p className="t-subjudul mt-1 text-label-2">{t.jadwal.sub}</p>
        </div>
        <Tombol onClick={() => setBaru(true)}>
          <Plus size={18} />
          {t.jadwal.baru}
        </Tombol>
      </header>

      {jadwal.length === 0 ? (
        <div className="mt-10">
          <Kosong ikon={<CalendarClock size={30} />} judul={t.jadwal.kosongJudul} isi={t.jadwal.kosongIsi} />
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {jadwal.map((j, i) => (
            <li key={j.id} className={cn("muncul kaca flex items-center gap-4 rounded-[24px] p-4 sm:p-5", !j.aktif && "opacity-70")} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <span className="grid size-12 shrink-0 place-items-center rounded-[16px] text-white" style={{ background: j.sekali ? "linear-gradient(135deg,#f97316,#fb923c)" : "linear-gradient(135deg,#0a84ff,#5e5ce6)" }}>
                {j.sekali ? <Timer size={22} /> : <CalendarClock size={22} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="t-kepala truncate">{j.nama}</p>
                <p className="t-subjudul truncate text-label-2">
                  {j.uraian}
                  {j.aktif && j.berikutnya ? ` · ${isi(t.jadwal.berikutnya, { waktu: waktuRelatif(j.berikutnya, b) })}` : !j.aktif ? ` · ${t.jadwal.nonaktif}` : ""}
                </p>
                <p className="t-keterangan mt-0.5 flex flex-wrap items-center gap-x-2 text-label-3">
                  {j.dibuatOleh === "agen" ? (
                    <span className="inline-flex items-center gap-1">
                      <Bot size={12} />
                      {t.jadwal.oleh.agen}
                    </span>
                  ) : null}
                  {j.terakhirHasil ? <span className="truncate">{isi(t.jadwal.terakhir, { hasil: j.terakhirHasil === "ok" ? t.jadwal.hasilOk : j.terakhirHasil })}</span> : null}
                </p>
              </div>
              <Saklar nyala={j.aktif} ubah={(v) => void ubahAktif(j, v)} label={j.nama} />
              <button
                type="button"
                onClick={() => void hapus(j)}
                aria-label={siapHapus === j.id ? t.jadwal.hapusTanya : t.umum.hapus}
                className={cn("tekan flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold", siapHapus === j.id ? "bg-bahaya-isi px-3.5 text-white" : "w-10 text-label-2 hover:text-bahaya")}
              >
                <Trash2 size={18} />
                {siapHapus === j.id ? t.umum.hapus : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <DaftarOtomasi awal={awalOtomasi} />

      {baru ? (
        <PembuatJadwal
          tutup={() => setBaru(false)}
          selesai={() => {
            setBaru(false);
            void muat();
          }}
        />
      ) : null}
    </div>
  );
}

function PembuatJadwal({ tutup, selesai }: { tutup: () => void; selesai: () => void }) {
  const { t } = useKamus();
  const J = t.jadwal;
  const data = useToko((s) => s.data);
  const perangkat = (data?.perangkat ?? []).filter((p) => !p.hilang && (p.kontrol.daya || p.kontrol.saluran.length));
  const suasana = data?.suasana ?? [];
  const [kapan, setKapan] = useState<"timer" | "jam">("jam");
  const [menit, setMenit] = useState(30);
  const [jam, setJam] = useState("23:00");
  const [hari, setHari] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [jenis, setJenis] = useState<"perangkat" | "suasana">("perangkat");
  const [target, setTarget] = useState(perangkat[0]?.id ?? "");
  const [targetSuasana, setTargetSuasana] = useState(suasana[0]?.id ?? "");
  const [nyala, setNyala] = useState<"nyala" | "mati">("mati");
  const [kirim, setKirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const simpan = async () => {
    setKirim(true);
    setGalat(null);
    try {
      await api("/api/app/jadwal", {
        method: "POST",
        json: {
          ...(kapan === "timer" ? { dalamMenit: menit } : { jam, hari: hari.length === 7 ? undefined : hari }),
          ...(jenis === "perangkat" ? { perangkat: target, nyala: nyala === "nyala" } : { suasana: targetSuasana }),
        },
      });
      selesai();
    } catch (e) {
      setGalat((e as GalatApi).pesan ?? t.umum.galatUmum);
      setKirim(false);
    }
  };

  const pilihGaya = "h-12 w-full rounded-[16px] bg-kaca-isi px-4 text-[16px] outline-none focus:ring-2 focus:ring-aksen-isi";
  return (
    <Lembar
      buka
      ubahBuka={(v) => !v && tutup()}
      judul={J.baru}
      lebar={540}
      kaki={
        <div>
          {galat ? (
            <p data-pesan-galat className="t-subjudul mb-3 text-bahaya">
              {galat}
            </p>
          ) : null}
          <Tombol ukuran="besar" className="w-full" onClick={simpan} disabled={kirim || (jenis === "perangkat" ? !target : !targetSuasana) || (kapan === "jam" && hari.length === 0)}>
            {kirim ? t.umum.menyimpan : J.simpan}
          </Tombol>
        </div>
      }
    >
      <p className="t-kapsi text-label-2 uppercase">{J.kapan}</p>
      <div className="mt-2">
        <Segmen label={J.kapan} nilai={kapan} ubah={setKapan} pilihan={[{ nilai: "jam", label: J.jenisJam }, { nilai: "timer", label: J.jenisTimer }]} />
      </div>
      {kapan === "timer" ? (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {[15, 30, 60, 120].map((m) => (
              <button key={m} type="button" onClick={() => setMenit(m)} className={cn("tekan h-10 rounded-full px-4 text-[15px] font-semibold", menit === m ? "bg-aksen-isi text-white" : "bg-kaca-isi")}>
                {m} {J.menit}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-3">
            <span className="t-subjudul text-label-2">{J.dalam}</span>
            <input type="number" min={1} max={10080} value={menit} onChange={(e) => setMenit(Math.max(1, Number(e.target.value) || 1))} className="t-angka h-11 w-24 rounded-[14px] bg-kaca-isi px-3 text-[17px]" />
            <span className="t-subjudul text-label-2">{J.menit}</span>
          </label>
        </div>
      ) : (
        <div className="mt-3">
          <label className="flex items-center gap-3">
            <span className="t-subjudul w-14 text-label-2">{J.jam}</span>
            <input type="time" value={jam} onChange={(e) => setJam(e.target.value)} className="t-angka h-12 rounded-[16px] bg-kaca-isi px-4 text-[20px] font-semibold" />
          </label>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={J.hari}>
            {J.namaHari.map((h, i) => {
              const aktif = hari.includes(i);
              return (
                <button key={h} type="button" aria-pressed={aktif} onClick={() => setHari((d) => (aktif ? d.filter((x) => x !== i) : [...d, i]))} className={cn("tekan size-11 rounded-full text-[13px] font-semibold", aktif ? "bg-aksen-isi text-white" : "bg-kaca-isi text-label-2")}>
                  {h}
                </button>
              );
            })}
          </div>
          {hari.length === 7 ? <p className="t-keterangan mt-2 text-label-2">{J.setiapHari}</p> : null}
        </div>
      )}

      <p className="t-kapsi mt-6 text-label-2 uppercase">{J.apa}</p>
      <div className="mt-2">
        <Segmen label={J.apa} nilai={jenis} ubah={setJenis} pilihan={[{ nilai: "perangkat", label: J.targetPerangkat }, ...(suasana.length ? [{ nilai: "suasana" as const, label: J.targetSuasana }] : [])]} />
      </div>
      {jenis === "perangkat" ? (
        <div className="mt-3 flex flex-col gap-3">
          <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label={J.pilihPerangkat} className={pilihGaya}>
            {perangkat.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
                {p.ruangan ? ` · ${p.ruangan}` : ""}
              </option>
            ))}
          </select>
          <Segmen label={J.apa} nilai={nyala} ubah={setNyala} pilihan={[{ nilai: "nyala", label: J.aksiNyalakan }, { nilai: "mati", label: J.aksiMatikan }]} />
        </div>
      ) : (
        <select value={targetSuasana} onChange={(e) => setTargetSuasana(e.target.value)} aria-label={J.pilihSuasana} className={cn(pilihGaya, "mt-3")}>
          {suasana.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nama}
            </option>
          ))}
        </select>
      )}
    </Lembar>
  );
}
