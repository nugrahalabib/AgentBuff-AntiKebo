"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bot, Camera, ExternalLink, Smartphone, Video, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Tombol } from "@/components/ui/dasar";
import { tampilToast } from "@/components/ui/toast";
import { useKamus } from "@/lib/i18n/klien";
import { api, type GalatApi } from "@/lib/app/toko";
import type { PerangkatRamah } from "@/lib/layanan/rumah";
import type { PerintahRamah } from "@/lib/tuya/kemampuan";
import { Bagian } from "./kontrol";

type FotoSimpanan = { id: string; jalur: string; jenis: "foto" | "video"; sumber: string; catatan: string | null; dibuat: string; kedaluwarsa: string };

/**
 * Kamera (CCTV) Tuya: foto & klip lewat Cloud Capture API end-user (disalin 7 hari
 * supaya tetap bisa dibuka sesudah tautan Tuya mati), galeri foto terbaru (termasuk
 * yang diambil agen atau otomasi), dan arah kamera (PTZ, DP standar ptz_control
 * "0" atas, "2" kanan, "4" bawah, "6" kiri) bila modelnya punya.
 */
export function PanelKamera({ p, kirim }: { p: PerangkatRamah; kirim: (c: PerintahRamah) => Promise<void> }) {
  const { t, b } = useKamus();
  const T = t.kamera;
  const [sibuk, setSibuk] = useState<"foto" | "video" | null>(null);
  const [foto, setFoto] = useState<{ gambar: string; tautan: string } | null>(null);
  const [klip, setKlip] = useState<string | null>(null);
  const [galeri, setGaleri] = useState<FotoSimpanan[]>([]);
  const ptz = p.kontrol.lainnya.some((x) => x.kode === "ptz_control");
  const adaStop = p.kontrol.lainnya.some((x) => x.kode === "ptz_stop");
  const url = `/api/app/perangkat/${encodeURIComponent(p.id)}/kamera`;

  const muatGaleri = useCallback(async () => {
    try {
      setGaleri(await api<FotoSimpanan[]>(url));
    } catch {
      /* galeri opsional: biarkan yang lama */
    }
  }, [url]);
  useEffect(() => {
    let batal = false;
    api<FotoSimpanan[]>(url)
      .then((d) => {
        if (!batal) setGaleri(d);
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [url]);

  const ambil = async (jenis: "foto" | "video") => {
    setSibuk(jenis);
    try {
      if (jenis === "foto") setFoto(await api<{ gambar: string; tautan: string }>(url, { method: "POST", json: { jenis } }));
      else setKlip((await api<{ video: string | null }>(url, { method: "POST", json: { jenis, detik: 10 } })).video);
      void muatGaleri();
    } catch (e) {
      tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
    }
    setSibuk(null);
  };

  const gerak = async (arah: string) => {
    await kirim({ properti: { ptz_control: arah } });
    if (adaStop) setTimeout(() => void kirim({ properti: { ptz_stop: true } }), 700);
  };

  const waktu = (iso: string) =>
    new Intl.DateTimeFormat(b === "en" ? "en-GB" : "id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const asal = (f: FotoSimpanan) => (f.sumber === "otomasi" ? T.asalOtomasi : f.sumber === "agen" ? T.asalAgen : T.asalApp);
  const ikonAsal = (s: string) => (s === "otomasi" ? <Zap size={12} /> : s === "agen" ? <Bot size={12} /> : <Smartphone size={12} />);

  return (
    <Bagian judul={T.judul} ket={T.ket}>
      <div className="grid grid-cols-2 gap-2">
        <Tombol varian="kaca" onClick={() => void ambil("foto")} disabled={!!sibuk}>
          <Camera size={16} />
          {sibuk === "foto" ? T.memotret : T.foto}
        </Tombol>
        <Tombol varian="kaca" onClick={() => void ambil("video")} disabled={!!sibuk}>
          <Video size={16} />
          {sibuk === "video" ? T.merekam : T.klip}
        </Tombol>
      </div>
      {sibuk ? <p className="t-keterangan mt-2 text-label-2">{T.tunggu}</p> : null}
      {foto ? (
        <div className="mt-3">
          {foto.gambar ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto tersimpan di app ini (jalur sendiri)
            <img src={foto.gambar} alt={T.foto} className="w-full rounded-[16px]" data-foto-kamera />
          ) : null}
          <a href={foto.tautan} target="_blank" rel="noopener noreferrer" className="t-keterangan mt-1 inline-flex items-center gap-1 text-aksen">
            <ExternalLink size={13} />
            {T.bukaFoto}
          </a>
        </div>
      ) : null}
      {klip ? (
        <a href={klip} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-medium text-aksen">
          <Video size={16} />
          {T.putarKlip}
        </a>
      ) : null}
      {ptz ? (
        <div className="mt-4" data-ptz>
          <p className="t-keterangan mb-2 text-label-2">{T.arah}</p>
          <div className="mx-auto grid w-40 grid-cols-3 gap-2">
            <span />
            <Tombol varian="kaca" aria-label={T.atas} onClick={() => void gerak("0")}>
              <ArrowUp size={18} />
            </Tombol>
            <span />
            <Tombol varian="kaca" aria-label={T.kiri} onClick={() => void gerak("6")}>
              <ArrowLeft size={18} />
            </Tombol>
            <span />
            <Tombol varian="kaca" aria-label={T.kanan} onClick={() => void gerak("2")}>
              <ArrowRight size={18} />
            </Tombol>
            <span />
            <Tombol varian="kaca" aria-label={T.bawah} onClick={() => void gerak("4")}>
              <ArrowDown size={18} />
            </Tombol>
            <span />
          </div>
        </div>
      ) : null}
      <div className="mt-5" data-galeri-kamera>
        <p className="t-kepala">{T.terbaru}</p>
        <p className="t-keterangan text-label-2">{T.simpanan}</p>
        {galeri.length === 0 ? (
          <p className="t-keterangan mt-2 text-label-3">{T.kosong}</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {galeri.map((f) => (
              <li key={f.id}>
                <a href={f.jalur} target="_blank" rel="noopener noreferrer" className="tekan block overflow-hidden rounded-[14px] bg-kaca-isi" data-foto-simpanan={f.jenis}>
                  {f.jenis === "foto" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto tersimpan di app ini (jalur sendiri)
                    <img src={f.jalur} alt={`${T.foto} ${waktu(f.dibuat)}`} loading="lazy" className="aspect-video w-full object-cover" />
                  ) : (
                    <span className="grid aspect-video w-full place-items-center text-label-2">
                      <Video size={26} />
                    </span>
                  )}
                </a>
                <p className="t-keterangan mt-1 truncate text-label-2">{waktu(f.dibuat)}</p>
                <p className="t-keterangan flex items-center gap-1 truncate text-label-3" title={f.catatan ?? undefined}>
                  {ikonAsal(f.sumber)}
                  <span className="truncate">{f.catatan ? `${asal(f)}: ${f.catatan}` : asal(f)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Bagian>
  );
}
