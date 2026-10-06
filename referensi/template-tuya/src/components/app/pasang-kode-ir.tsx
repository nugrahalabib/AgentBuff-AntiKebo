"use client";

import { Check, ChevronLeft, ChevronRight, Hand, Power, Radio, Search, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tombol } from "@/components/ui/dasar";
import { tampilToast } from "@/components/ui/toast";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { api, useToko, type GalatApi } from "@/lib/app/toko";
import type { PerangkatRamah } from "@/lib/layanan/rumah";

type Merek = { merek: string; jumlah: number };
type Kode = { id: string; urutan: number; model: string[]; dibangun: boolean };
type Pemancar = { id: string; nama: string; online: boolean };
type HasilModel = { merek: string; id: string; model: string; cocok: "persis" | "mirip" };

/**
 * Memasangkan kode remote ke AC lewat pemancar IR: pilih merek -> satu tes
 * lengkap per kode (nyala, 27 derajat, kipas kencang, ayunan) -> simpan bila
 * SEMUANYA berubah. Kami tidak bisa melihat AC, jadi jawabannya dari pengguna.
 * (Rekam dari remote tidak mungkin lewat kunci rumah Tuya: lihat src/lib/layanan/ir.ts.)
 */
export function PasangKodeIr({ p }: { p: PerangkatRamah }) {
  const { t } = useKamus();
  const T = t.ir;
  const terpasang = p.kontrol.kodeIr;
  const [buka, setBuka] = useState(!terpasang);
  const [daftarMerek, setDaftarMerek] = useState<Merek[] | null>(null);
  const [cari, setCari] = useState("");
  const [merek, setMerek] = useState<string | null>(null);
  const [kode, setKode] = useState<Kode[]>([]);
  const [i, setI] = useState(0);
  const [pemancar, setPemancar] = useState<Pemancar[]>([]);
  const [pemancarId, setPemancarId] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [diuji, setDiuji] = useState(false);
  const [ujiTersimpan, setUjiTersimpan] = useState(false);
  const [kueriModel, setKueriModel] = useState("");
  const [hasilModel, setHasilModel] = useState<HasilModel[] | null>(null);
  const [otomatis, setOtomatis] = useState<"diam" | "jalan" | "berhenti" | "habis">("diam");
  const henti = useRef(false);

  const url = `/api/app/perangkat/${encodeURIComponent(p.id)}/ir`;
  const galatUmum = t.umum.galatUmum;
  const galat = (e: unknown) => tampilToast((e as GalatApi).pesan ?? galatUmum, "galat");

  useEffect(() => {
    if (!buka) return;
    let batal = false;
    Promise.all([api<{ merek: Merek[] }>("/api/app/ir/merek"), api<{ pemancar: Pemancar[] }>(url)])
      .then(([m, h]) => {
        if (batal) return;
        setDaftarMerek(m.merek);
        setPemancar(h.pemancar);
        setPemancarId((x) => x ?? h.pemancar.find((y) => y.online)?.id ?? h.pemancar[0]?.id ?? null);
      })
      .catch((e) => !batal && tampilToast((e as GalatApi).pesan ?? galatUmum, "galat"));
    return () => {
      batal = true;
    };
  }, [buka, url, galatUmum]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (daftarMerek ?? []).filter((m) => !q || m.merek.toLowerCase().includes(q));
  }, [daftarMerek, cari]);

  const pilihMerek = async (m: string) => {
    try {
      const r = await api<{ merek: string; kode: Kode[] }>(`/api/app/ir/merek/${encodeURIComponent(m)}`);
      setMerek(r.merek);
      setKode(r.kode);
      setI(0);
      setDiuji(false);
    } catch (e) {
      galat(e);
    }
  };

  const kirimUji = (pustaka: string | null) => api(url, { method: "POST", json: { aksi: "uji", pustaka, uji: "lengkap", pemancar: pustaka ? pemancarId : null } });

  /** Cari otomatis: kirim kode satu per satu (jeda 5 dtk) sampai pengguna menekan BERHENTI. */
  const cariOtomatis = async () => {
    henti.current = false;
    setOtomatis("jalan");
    setDiuji(false);
    for (let j = i; j < kode.length; j++) {
      if (henti.current) break;
      setI(j);
      try {
        await kirimUji(kode[j].id);
      } catch (e) {
        galat(e);
        setOtomatis("diam");
        return;
      }
      for (let w = 0; w < 50 && !henti.current; w++) await new Promise((r) => setTimeout(r, 100));
    }
    setOtomatis(henti.current ? "berhenti" : "habis");
  };

  const cariModel = async () => {
    try {
      const r = await api<{ hasil: HasilModel[] }>(`/api/app/ir/model?q=${encodeURIComponent(kueriModel)}`);
      setHasilModel(r.hasil);
    } catch (e) {
      galat(e);
    }
  };

  const pakaiHasilModel = (h: HasilModel) => {
    setMerek(h.merek);
    setKode([{ id: h.id, urutan: 1, model: [h.model], dibangun: h.id.startsWith("pana:") }]);
    setI(0);
    setDiuji(false);
    setOtomatis("diam");
  };

  /** pustaka = null: tes kode yang sudah tersimpan. */
  const uji = async (pustaka: string | null) => {
    setSibuk(pustaka ?? "tersimpan");
    try {
      await kirimUji(pustaka);
      if (pustaka) setDiuji(true);
      else setUjiTersimpan(true);
    } catch (e) {
      galat(e);
    }
    setSibuk(null);
  };

  const simpan = async (pustaka: string) => {
    setSibuk("simpan");
    try {
      await api(url, { method: "POST", json: { aksi: "simpan", pustaka, pemancar: pemancarId } });
      await useToko.getState().muat();
      tampilToast(isi(T.tersimpan, { merek: merek ?? "" }));
      setBuka(false);
      setMerek(null);
      setDiuji(false);
    } catch (e) {
      galat(e);
    }
    setSibuk(null);
  };

  const pindah = (arah: 1 | -1) => {
    setI((x) => Math.max(0, Math.min(kode.length - 1, x + arah)));
    setDiuji(false);
    if (otomatis !== "jalan") setOtomatis("diam");
  };

  if (terpasang && !buka) {
    return (
      <div className="rounded-[20px] bg-kaca-isi px-4 py-3" data-kode-ir="terpasang">
        <div className="flex items-center gap-3">
          <Radio size={20} className="shrink-0 text-aksen" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{isi(T.terpasang, { merek: terpasang.merek })}</span>
            <span className="t-keterangan block text-label-2">{isi(T.kodeNomor, { n: terpasang.pustaka })}</span>
          </span>
          <Tombol varian="kaca" ukuran="kecil" onClick={() => void uji(null)} disabled={!!sibuk}>
            {sibuk === "tersimpan" ? T.mengirim : T.tes}
          </Tombol>
          <Tombol varian="kaca" ukuran="kecil" onClick={() => setBuka(true)}>
            {T.ganti}
          </Tombol>
        </div>
        {ujiTersimpan ? (
          <div className="mt-3 rounded-[16px] bg-kaca-kuat p-3">
            <p className="t-kepala">{T.tanyaLengkap}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Tombol onClick={() => setUjiTersimpan(false)}>
                <Check size={16} />
                {T.yaBenar}
              </Tombol>
              <Tombol
                varian="kaca"
                onClick={() => {
                  setUjiTersimpan(false);
                  setBuka(true);
                }}
              >
                {T.gantiKode}
              </Tombol>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const k = kode[i];

  return (
    <div className="rounded-[20px] bg-waspada-isi/15 p-4" data-kode-ir="pasang">
      <div className="flex gap-3">
        <Radio size={22} className="mt-0.5 shrink-0 text-waspada" />
        <div className="min-w-0">
          <p className="t-kepala">{terpasang ? T.judulGanti : T.judul}</p>
          <p className="t-subjudul mt-1 text-label-2">{T.isi}</p>
        </div>
      </div>

      {pemancar.length > 1 ? (
        <label className="mt-4 block">
          <span className="t-keterangan text-label-2">{T.pemancar}</span>
          <select value={pemancarId ?? ""} onChange={(e) => setPemancarId(e.target.value)} className="mt-1 w-full rounded-[12px] bg-kaca-kuat px-3 py-2 text-[15px]" aria-label={T.pemancar}>
            {pemancar.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nama}
                {h.online ? "" : ` (${t.umum.offline})`}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!merek ? (
        <div className="mt-4">
          <p className="t-kepala mb-2">{T.langkah1}</p>
          <div className="flex items-center gap-2 rounded-[12px] bg-kaca-kuat px-3 py-2">
            <Search size={16} className="text-label-2" />
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder={T.cariMerek} aria-label={T.cariMerek} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
          </div>
          <div className="mt-2 flex max-h-56 flex-wrap gap-2 overflow-y-auto">
            {daftarMerek === null ? <p className="t-keterangan text-label-2">{t.umum.memuat}</p> : null}
            {tersaring.map((m) => (
              <button key={m.merek} type="button" onClick={() => void pilihMerek(m.merek)} className="tekan rounded-full bg-kaca-kuat px-3.5 py-2 text-[14px] font-medium">
                {m.merek}
              </button>
            ))}
          </div>
          <p className="t-keterangan mt-3 text-label-2">{T.merekTakAda}</p>

          <div className="mt-4 rounded-[16px] bg-kaca-kuat p-4" data-cari-model>
            <p className="t-kepala">{T.modelJudul}</p>
            <p className="t-subjudul mt-1 text-label-2">{T.modelIsi}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <GambarUnit label={T.gambarUnit} />
              <GambarRemote label={T.gambarRemote} />
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void cariModel();
              }}
            >
              <input value={kueriModel} onChange={(e) => setKueriModel(e.target.value)} placeholder={T.modelContoh} aria-label={T.modelContoh} className="min-w-0 flex-1 rounded-[12px] bg-kaca-isi px-3 py-2 text-[15px] uppercase" />
              <Tombol type="submit" varian="kaca" disabled={kueriModel.trim().length < 3}>
                {T.modelCari}
              </Tombol>
            </form>
            {hasilModel ? (
              hasilModel.length ? (
                <div className="mt-3 flex flex-col divide-y divide-pemisah overflow-hidden rounded-[14px] bg-kaca-isi">
                  {hasilModel.map((h) => (
                    <button key={h.id} type="button" onClick={() => pakaiHasilModel(h)} className="tekan flex items-center justify-between gap-3 px-3 py-2.5 text-left">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-medium">
                          {h.merek} · {h.model}
                        </span>
                        <span className="t-keterangan block text-label-2">{h.cocok === "persis" ? T.modelPersis : T.modelMirip}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-label-3" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="t-keterangan mt-3 text-label-2">{T.modelKosong}</p>
              )
            ) : null}
          </div>
          {terpasang ? (
            <Tombol varian="kaca" ukuran="kecil" className="mt-3" onClick={() => setBuka(false)}>
              {t.umum.batal}
            </Tombol>
          ) : null}
        </div>
      ) : k ? (
        <div className="mt-4" data-uji-kode>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setMerek(null)} className="tekan flex items-center gap-1 text-[14px] text-aksen">
              <ChevronLeft size={16} />
              {merek}
            </button>
            <span className="t-keterangan text-label-2">{isi(T.kodeKe, { n: i + 1, total: kode.length })}</span>
          </div>
          <p className="t-keterangan mt-1 truncate text-label-3">
            {k.dibangun ? `${T.dibangun} · ` : ""}
            {k.model.join(", ")}
          </p>
          {kode.length > 1 ? (
            <div className="mt-3 rounded-[16px] bg-kaca-kuat p-3" data-cari-otomatis>
              <p className="t-kepala flex items-center gap-2">
                <Zap size={16} className="text-aksen" />
                {T.otomatisJudul}
              </p>
              <p className="t-subjudul mt-1 text-label-2">{T.otomatisIsi}</p>
              {otomatis === "jalan" ? (
                <>
                  <p className="t-kepala mt-2 text-aksen" role="status">
                    {isi(T.otomatisBerjalan, { n: i + 1, total: kode.length })}
                  </p>
                  <Tombol className="mt-2 w-full" onClick={() => (henti.current = true)}>
                    <Hand size={16} />
                    {T.berhenti}
                  </Tombol>
                </>
              ) : (
                <Tombol className="mt-2 w-full" onClick={() => void cariOtomatis()} disabled={!!sibuk}>
                  <Zap size={16} />
                  {T.otomatisMulai}
                </Tombol>
              )}
              {otomatis === "berhenti" ? <p className="t-subjudul mt-2 text-label-2">{T.otomatisPastikan}</p> : null}
              {otomatis === "habis" ? <p className="t-subjudul mt-2 text-waspada">{T.otomatisHabis}</p> : null}
            </div>
          ) : null}

          <p className="t-subjudul mt-3 text-label-2">{kode.length > 1 ? `${T.manualJudul}. ` : ""}{T.langkah2}</p>
          <Tombol varian="kaca" className="mt-2 w-full" onClick={() => void uji(k.id)} disabled={!!sibuk || otomatis === "jalan"}>
            <Power size={16} />
            {sibuk === k.id ? T.mengirim : T.tesKode}
          </Tombol>
          {diuji ? (
            <div className="mt-3 rounded-[16px] bg-kaca-kuat p-3">
              <p className="t-kepala">{T.tanyaLengkap}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Tombol onClick={() => void simpan(k.id)} disabled={sibuk === "simpan"}>
                  <Check size={16} />
                  {T.ya}
                </Tombol>
                <Tombol varian="kaca" onClick={() => pindah(1)} disabled={i >= kode.length - 1}>
                  {T.tidak}
                  <ChevronRight size={16} />
                </Tombol>
              </div>
              {i >= kode.length - 1 ? <p className="t-keterangan mt-2 text-label-2">{T.habis}</p> : null}
            </div>
          ) : null}
          <div className="mt-3 flex justify-between">
            {i > 0 ? (
              <button type="button" onClick={() => pindah(-1)} className="tekan text-[14px] text-label-2">
                {T.sebelumnya}
              </button>
            ) : (
              <span />
            )}
            {i < kode.length - 1 && !diuji ? (
              <button type="button" onClick={() => pindah(1)} className="tekan text-[14px] text-label-2">
                {T.lewati}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Ilustrasi letak stiker model di unit AC dalam (gambar sendiri, bukan foto merek). */
function GambarUnit({ label }: { label: string }) {
  return (
    <figure className="m-0">
      <svg viewBox="0 0 160 90" className="w-full" role="img" aria-label={label}>
        <rect x="8" y="18" width="128" height="40" rx="10" className="fill-[var(--kaca-isi)] stroke-[var(--label-3)]" strokeWidth="2" />
        <line x1="20" y1="48" x2="124" y2="48" className="stroke-[var(--label-3)]" strokeWidth="2" strokeLinecap="round" />
        <rect x="124" y="26" width="10" height="16" rx="2" className="fill-[var(--aksen)]" />
        <path d="M150 34 L138 34" className="stroke-[var(--aksen)]" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M142 30 L138 34 L142 38" className="fill-none stroke-[var(--aksen)]" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <figcaption className="t-keterangan text-center text-label-2">{label}</figcaption>
    </figure>
  );
}

/** Ilustrasi letak kode di belakang remote / ruang baterai. */
function GambarRemote({ label }: { label: string }) {
  return (
    <figure className="m-0">
      <svg viewBox="0 0 160 90" className="w-full" role="img" aria-label={label}>
        <rect x="58" y="6" width="44" height="80" rx="12" className="fill-[var(--kaca-isi)] stroke-[var(--label-3)]" strokeWidth="2" />
        <rect x="66" y="50" width="28" height="28" rx="4" className="fill-none stroke-[var(--label-3)]" strokeWidth="1.5" strokeDasharray="3 2" />
        <rect x="68" y="20" width="24" height="8" rx="2" className="fill-[var(--aksen)]" />
        <path d="M118 24 L96 24" className="stroke-[var(--aksen)]" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M100 20 L96 24 L100 28" className="fill-none stroke-[var(--aksen)]" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <figcaption className="t-keterangan text-center text-label-2">{label}</figcaption>
    </figure>
  );
}
