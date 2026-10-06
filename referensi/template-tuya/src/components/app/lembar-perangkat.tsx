"use client";

import { Check, ChevronRight, Copy, Pencil, Radio, RefreshCw, Send, Sun, Thermometer, Timer, WifiOff, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Lembar } from "@/components/ui/lembar";
import { Saklar, Segmen, Tombol } from "@/components/ui/dasar";
import { IKON_JENIS } from "@/components/ui/ikon";
import { tampilToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { api, useToko, type GalatApi } from "@/lib/app/toko";
import type { PerangkatRamah } from "@/lib/layanan/rumah";
import { hexKeHsv, type PerintahRamah } from "@/lib/tuya/kemampuan";
import { labelPilihan, labelProperti, punyaArtiAngka } from "@/lib/tuya/label-properti";
import { Bagian, Penggeser, PengaturSuhu } from "./kontrol";
import { PanelKamera } from "./panel-kamera";
import { PasangKodeIr } from "./pasang-kode-ir";
import { namaMode, teksStatus, warnaCahaya } from "./ubin";

const SWATCH: Array<{ nama: string; hex: string }> = [
  { nama: "merah", hex: "#ff3b30" },
  { nama: "oranye", hex: "#ff9500" },
  { nama: "kuning", hex: "#ffd60a" },
  { nama: "hijau", hex: "#34c759" },
  { nama: "tosca", hex: "#00c7be" },
  { nama: "biru", hex: "#0a5cff" },
  { nama: "ungu", hex: "#a347d4" },
  { nama: "pink", hex: "#ff4fa3" },
];

type Listrik = { total: number; satuan: string; perJam: Array<{ jam: string; nilai: number }> };

export function LembarPerangkat({ id, tutup, bukaLain }: { id: string | null; tutup: () => void; bukaLain?: (id: string) => void }) {
  const { t, b: bahasa } = useKamus();
  const p = useToko((s) => s.data?.perangkat.find((x) => x.id === id) ?? null);
  const semua = useToko((s) => s.data?.perangkat);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const kendaliToko = useToko((s) => s.kendali);
  const ganti = useToko((s) => s.ganti);
  const [listrik, setListrik] = useState<Listrik | null>(null);
  const [ubahNama, setUbahNama] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);

  // Saat dibuka: ambil keadaan langsung dari Tuya (cermin bisa tertinggal beberapa detik).
  useEffect(() => {
    if (!id) return;
    let batal = false;
    api<{ perangkat: PerangkatRamah }>(`/api/app/perangkat/${encodeURIComponent(id)}`)
      .then((r) => !batal && ganti(r.perangkat))
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [id, ganti]);

  const adaListrik = !!p?.kontrol.listrik;
  useEffect(() => {
    if (!id || !adaListrik) return;
    let batal = false;
    api<Listrik>(`/api/app/listrik/${encodeURIComponent(id)}`)
      .then((r) => !batal && setListrik(r))
      .catch(() => {});
    return () => {
      batal = true;
      setListrik(null);
    };
  }, [id, adaListrik]);

  if (!p) return null;
  const Ikon = IKON_JENIS[p.jenis];
  const s = p.keadaan;
  const k = p.kontrol;
  const nyala = p.online && s.nyala === true;
  const warna = warnaCahaya(p);

  const kirim = async (c: PerintahRamah) => {
    const r = await kendaliToko(p.id, c);
    if (!r.ok) tampilToast(isi(t.rumah.gagalKendali, { nama: p.nama, alasan: r.galat.pesan }), "galat");
  };
  const atur = async (isiAtur: Record<string, unknown>) => {
    try {
      await api(`/api/app/perangkat/${encodeURIComponent(p.id)}`, { method: "PATCH", json: isiAtur });
      await useToko.getState().muat();
    } catch (e) {
      tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
    }
  };

  const daftarBacaan: Array<[string, string]> = [];
  if (s.suhuRuang != null && !k.suhuTarget) daftarBacaan.push([t.perangkat.suhu, `${s.suhuRuang}°`]);
  if (s.kelembapan != null) daftarBacaan.push([t.perangkat.labelKelembapan, `${s.kelembapan}%`]);
  if (s.bateraiPersen != null) daftarBacaan.push([t.perangkat.labelBaterai, `${s.bateraiPersen}%`]);
  for (const b of k.bacaan) {
    if (typeof b.nilai === "string" && b.nilai.length > 40) continue;
    const v = Array.isArray(b.nilai)
      ? b.nilai.length
        ? b.nilai.map((x) => labelPilihan(b.kode, x, bahasa)).join(", ")
        : t.perangkat.tidakAda
      : typeof b.nilai === "boolean"
        ? b.nilai
          ? t.umum.ya
          : t.umum.tidak
        : typeof b.nilai === "string"
          ? labelPilihan(b.kode, b.nilai, bahasa)
          : b.nilai === null
            ? "-"
            : punyaArtiAngka(b.kode, b.nilai)
              ? labelPilihan(b.kode, b.nilai, bahasa)
              : `${Math.round(b.nilai * 100) / 100}${b.satuan ? ` ${b.satuan}` : ""}`;
    daftarBacaan.push([labelProperti(b.kode, b.nama, bahasa).nama, v]);
  }

  return (
    <Lembar
      buka={!!id}
      ubahBuka={(v) => !v && tutup()}
      judul={p.nama}
      sub={[p.ruangan, teksStatus(t, p)].filter(Boolean).join(" · ")}
      aksen={
        <span className="grid size-12 shrink-0 place-items-center rounded-[16px] transition-colors" style={{ background: nyala ? warna : "var(--kaca-isi)", color: nyala ? "#fff" : "var(--label-2)" }}>
          <Ikon size={24} />
        </span>
      }
    >
      {!p.online ? (
        <div className="flex gap-3 rounded-[20px] bg-kaca-isi p-4">
          <WifiOff size={22} className="mt-0.5 shrink-0 text-label-2" />
          <div>
            <p className="t-kepala">{t.perangkat.offlineJudul}</p>
            <p className="t-subjudul mt-1 text-label-2">{t.perangkat.offlineIsi}</p>
          </div>
        </div>
      ) : null}

      {k.inframerah && p.online ? <PasangKodeIr key={p.id} p={p} /> : null}

      {p.jenis === "kamera" && p.online ? <PanelKamera p={p} kirim={kirim} /> : null}

      {k.inframerah && k.kodeIr ? (
        <div className="flex gap-3 rounded-[20px] bg-aksen-isi/10 p-4" data-ir-ac>
          <Radio size={22} className="mt-0.5 shrink-0 text-aksen" />
          <div className="min-w-0">
            <p className="t-kepala">{t.perangkat.irJudul}</p>
            <p className="t-subjudul mt-1 text-label-2">{t.perangkat.irIsi}</p>
          </div>
        </div>
      ) : null}

      {k.pemancarIr ? (
        <PanelPemancar
          remote={(semua ?? []).filter((x) => x.id !== p.id && x.rumahId === p.rumahId && (x.kontrol.inframerah || (x.jenis === "remote" && !x.kontrol.pemancarIr)))}
          menyegarkan={menyegarkan}
          segarkan={async () => {
            setMenyegarkan(true);
            try {
              await api("/api/app/sinkron", { method: "POST" });
              await useToko.getState().muat();
              tampilToast(t.perangkat.hubDisegarkan);
            } catch (e) {
              tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
            }
            setMenyegarkan(false);
          }}
          buka={bukaLain}
        />
      ) : null}

      {/* AC remote tanpa kode: kontrol disembunyikan (perintahnya tidak akan sampai ke AC). */}
      {k.inframerah && !k.kodeIr ? null : (
      <fieldset disabled={!p.online} className="contents">
        {k.daya ? (
          <div className="flex items-center justify-between rounded-[20px] bg-kaca-isi px-4 py-3">
            <span className="t-kepala">{nyala ? t.umum.nyala : t.umum.mati}</span>
            <Saklar nyala={nyala} ubah={(v) => void kirim({ nyala: v })} label={p.nama} nonaktif={!p.online} warna={warna} />
          </div>
        ) : null}

        {k.saluran.length ? (
          <div className="flex flex-col divide-y divide-pemisah overflow-hidden rounded-[20px] bg-kaca-isi">
            {k.saluran.map((n) => {
              const v = s.saluran?.find((x) => x.nomor === n)?.nyala === true;
              return (
                <div key={n} className="flex items-center justify-between px-4 py-3">
                  <span className="t-isi">{isi(t.perangkat.saluran, { n })}</span>
                  <Saklar nyala={v} ubah={(x) => void kirim({ nyala: x, saluran: n })} label={isi(t.perangkat.saluran, { n })} nonaktif={!p.online} />
                </div>
              );
            })}
          </div>
        ) : null}

        {k.modeLampu.length > 1 ? (
          <Bagian judul={t.perangkat.modeLampu}>
            <Segmen label={t.perangkat.modeLampu} nilai={s.modeKerja ?? null} pilihan={k.modeLampu.map((m) => ({ nilai: m, label: namaMode(t, m) }))} ubah={(m) => void kirim({ modeLampu: m })} />
          </Bagian>
        ) : null}

        {k.terang ? (
          <Bagian judul={t.perangkat.terang}>
            <Penggeser nilai={s.terangPersen} min={1} label={t.perangkat.terang} ikon={<Sun size={18} />} komit={(v) => void kirim({ terangPersen: v })} nonaktif={!p.online} />
          </Bagian>
        ) : null}

        {k.warna || k.suhuPutih ? (
          <Bagian judul={t.perangkat.warna}>
            <div className="flex flex-wrap gap-2.5">
              {k.warna
                ? SWATCH.map((w) => {
                    const hw = hexKeHsv(w.hex)?.h ?? 0;
                    const hs = s.warnaHex ? (hexKeHsv(s.warnaHex)?.h ?? -999) : -999;
                    const beda = Math.min(Math.abs(hw - hs), 360 - Math.abs(hw - hs));
                    const aktif = s.modeKerja === "colour" && beda <= 14;
                    return (
                      <button
                        key={w.nama}
                        type="button"
                        aria-label={w.nama}
                        onClick={() => void kirim({ warna: w.hex })}
                        className={cn("tekan size-11 rounded-full ring-offset-2 ring-offset-transparent", aktif && "ring-[3px] ring-label")}
                        style={{ background: w.hex, boxShadow: `0 6px 16px -6px ${w.hex}` }}
                      />
                    );
                  })
                : null}
              {(["hangat", "putih", "sejuk"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => void kirim({ warna: w })}
                  className={cn("tekan h-11 rounded-full px-4 text-[14px] font-semibold text-black", s.modeKerja === "white" && w === "putih" && "ring-[3px] ring-label")}
                  style={{ background: w === "hangat" ? "#ffd9a0" : w === "sejuk" ? "#dcecff" : "#fff8ec" }}
                >
                  {w === "hangat" ? t.perangkat.hangat : w === "sejuk" ? t.perangkat.sejuk : t.perangkat.putih}
                </button>
              ))}
            </div>
            {k.suhuPutih && s.modeKerja !== "colour" ? (
              <div className="mt-3">
                <Penggeser
                  nilai={s.suhuPutihPersen}
                  label={`${t.perangkat.hangat} - ${t.perangkat.sejuk}`}
                  latar="linear-gradient(90deg,#ffb35c,#fff4e0 50%,#cfe4ff)"
                  komit={(v) => void kirim({ suhuPutihPersen: v })}
                  nonaktif={!p.online}
                />
              </div>
            ) : null}
          </Bagian>
        ) : null}

        {k.suhuTarget ? (
          <Bagian judul={t.perangkat.suhu} ket={s.suhuRuang != null ? isi(t.perangkat.suhuRuang, { n: s.suhuRuang }) : undefined}>
            <PengaturSuhu
              nilai={s.suhuTarget ?? null}
              min={k.suhuTarget.min}
              max={k.suhuTarget.max}
              langkah={k.suhuTarget.langkah || 1}
              komit={(v) => void kirim({ suhuTarget: v })}
              labelKurang={`${t.perangkat.suhu} -`}
              labelTambah={`${t.perangkat.suhu} +`}
            />
          </Bagian>
        ) : null}

        {k.modeAc.length ? (
          <Bagian judul={t.perangkat.mode}>
            <Segmen label={t.perangkat.mode} nilai={s.modeAc ?? null} pilihan={k.modeAc.map((m) => ({ nilai: m, label: namaMode(t, m) }))} ubah={(m) => void kirim({ modeAc: m })} />
          </Bagian>
        ) : null}

        {k.kipas && "pilihan" in k.kipas ? (
          <Bagian judul={t.perangkat.kipas}>
            <Segmen label={t.perangkat.kipas} nilai={s.kipas != null ? String(s.kipas) : null} pilihan={k.kipas.pilihan.map((m) => ({ nilai: m, label: namaMode(t, m) }))} ubah={(m) => void kirim({ kipas: m })} />
          </Bagian>
        ) : k.kipas ? (
          <Bagian judul={t.perangkat.kipas}>
            <Penggeser nilai={typeof s.kipas === "number" ? s.kipas : null} min={k.kipas.min} max={k.kipas.max} satuan="" label={t.perangkat.kipas} komit={(v) => void kirim({ kipas: v })} nonaktif={!p.online} />
          </Bagian>
        ) : null}

        {k.inframerah ? (
          <Tombol
            varian="kaca"
            className="mt-4 w-full"
            onClick={async () => {
              const c: PerintahRamah = s.nyala === false ? { nyala: false } : { nyala: true };
              if (s.nyala !== false) {
                if (s.suhuTarget != null) c.suhuTarget = s.suhuTarget;
                if (s.modeAc) c.modeAc = s.modeAc;
                if (s.kipas != null) c.kipas = s.kipas;
              }
              const r = await kendaliToko(p.id, c);
              tampilToast(r.ok ? isi(t.perangkat.irTerkirim, { nama: p.nama }) : isi(t.rumah.gagalKendali, { nama: p.nama, alasan: r.galat.pesan }), r.ok ? undefined : "galat");
            }}
          >
            <Send size={16} />
            {t.perangkat.irSamakan}
          </Tombol>
        ) : null}
        {k.inframerah ? <p className="t-keterangan mt-1.5 px-1 text-label-2">{t.perangkat.irSamakanKet}</p> : null}

        {k.hitungMundur ? (
          <Bagian judul={t.perangkat.timer} ket={s.hitungMundurDetik ? isi(t.perangkat.timerSisa, { n: Math.ceil(s.hitungMundurDetik / 60) }) : undefined}>
            <p className="t-subjudul mb-2 text-label-2">{nyala ? t.perangkat.timerMatikan : t.perangkat.timerNyalakan}</p>
            <div className="flex flex-wrap gap-2">
              {[15, 30, 60, 120, 240].filter((m) => m <= (k.hitungMundur?.maksMenit ?? 0)).map((m) => (
                <Tombol key={m} varian="kaca" ukuran="kecil" onClick={() => void kirim({ hitungMundurMenit: m })}>
                  <Timer size={14} />
                  {m < 60 ? isi(t.perangkat.timerMenit, { n: m }) : isi(t.perangkat.timerJam, { n: m / 60 })}
                </Tombol>
              ))}
              {s.hitungMundurDetik ? (
                <Tombol varian="kaca" ukuran="kecil" onClick={() => void kirim({ hitungMundurMenit: 0 })}>
                  {t.perangkat.timerBatal}
                </Tombol>
              ) : null}
            </div>
          </Bagian>
        ) : null}

        {k.tirai.length ? (
          <Bagian judul={t.perangkat.tirai}>
            <div className="grid grid-cols-3 gap-2">
              {(["buka", "berhenti", "tutup"] as const).map((a) => (
                <Tombol key={a} varian="kaca" onClick={() => void kirim({ tirai: a })}>
                  {a === "buka" ? t.perangkat.buka : a === "tutup" ? t.perangkat.tutup : t.perangkat.berhenti}
                </Tombol>
              ))}
            </div>
            {k.posisi ? (
              <div className="mt-3">
                <Penggeser nilai={s.posisiPersen} label={t.perangkat.posisi} komit={(v) => void kirim({ posisiPersen: v })} nonaktif={!p.online} />
              </div>
            ) : null}
          </Bagian>
        ) : null}
      </fieldset>
      )}

      {k.listrik ? (
        <Bagian judul={t.perangkat.listrik}>
          <div className="rounded-[20px] bg-kaca-isi p-4">
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              {s.watt != null ? (
                <p className="t-angka flex items-center gap-1.5 text-[22px] font-semibold">
                  <Zap size={18} className="text-[var(--ikon-colokan)]" />
                  {isi(t.perangkat.watt, { n: s.watt })}
                </p>
              ) : null}
              {listrik ? <p className="t-subjudul text-label-2">{isi(t.perangkat.kwhHariIni, { n: listrik.total })}</p> : null}
              {s.kwhTotal != null ? <p className="t-subjudul text-label-2">{isi(t.perangkat.kwhTotal, { n: s.kwhTotal })}</p> : null}
              {s.volt != null ? <p className="t-subjudul t-angka text-label-2">{isi(t.perangkat.volt, { n: s.volt })}</p> : null}
              {s.ampere != null ? <p className="t-subjudul t-angka text-label-2">{isi(t.perangkat.ampere, { n: s.ampere })}</p> : null}
            </div>
            {listrik?.perJam.length ? <GrafikJam data={listrik.perJam} /> : null}
          </div>
        </Bagian>
      ) : null}

      {daftarBacaan.length ? (
        <Bagian judul={t.perangkat.bacaan}>
          <dl className="grid grid-cols-2 gap-2">
            {daftarBacaan.slice(0, 24).map(([label, nilai]) => (
              <div key={label} className="rounded-[16px] bg-kaca-isi px-3.5 py-2.5">
                <dt className="t-keterangan truncate text-label-2">{label}</dt>
                <dd className="t-angka truncate text-[17px] font-semibold">{nilai}</dd>
              </div>
            ))}
          </dl>
        </Bagian>
      ) : null}

      {k.lainnya.length && p.online && !(k.inframerah && !k.kodeIr) ? (
        <Bagian judul={t.perangkat.pengaturanLain} ket={t.perangkat.lanjutanKet}>
          <div className="flex flex-col divide-y divide-pemisah overflow-hidden rounded-[20px] bg-kaca-isi">
            {k.lainnya
              .filter((x) => x.kode !== "ptz_control" && x.kode !== "ptz_stop")
              .slice(0, 40)
              .map((x) => {
              const v = s.lainnya[x.kode];
              const lbl = labelProperti(x.kode, x.nama, bahasa);
              return (
                <div key={x.kode} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px]">{lbl.nama}</span>
                    {lbl.keterangan ? <span className="t-keterangan block text-label-2">{lbl.keterangan}</span> : null}
                  </span>
                  {x.tipe === "bool" ? (
                    <Saklar nyala={v === true} ubah={(n) => void kirim({ properti: { [x.kode]: n } })} label={lbl.nama} />
                  ) : x.tipe === "enum" ? (
                    <select
                      value={typeof v === "string" ? v : ""}
                      onChange={(e) => void kirim({ properti: { [x.kode]: e.target.value } })}
                      className="max-w-[55%] rounded-[12px] bg-kaca-kuat px-3 py-2 text-[15px]"
                      aria-label={lbl.nama}
                    >
                      {(x.pilihan ?? []).map((o) => (
                        <option key={o} value={o}>
                          {labelPilihan(x.kode, o, bahasa) !== o ? labelPilihan(x.kode, o, bahasa) : namaMode(t, o)}
                        </option>
                      ))}
                    </select>
                  ) : x.tipe === "value" ? (
                    <input
                      type="number"
                      defaultValue={typeof v === "number" ? v : undefined}
                      min={x.min}
                      max={x.max}
                      step={x.langkah}
                      aria-label={lbl.nama}
                      onBlur={(e) => e.target.value !== "" && void kirim({ properti: { [x.kode]: Number(e.target.value) } })}
                      className="t-angka w-28 rounded-[12px] bg-kaca-kuat px-3 py-2 text-right text-[15px]"
                    />
                  ) : (
                    <span className="t-keterangan max-w-[50%] truncate text-label-2">{String(v ?? "")}</span>
                  )}
                </div>
              );
            })}
          </div>
        </Bagian>
      ) : null}

      <Bagian judul={t.perangkat.info}>
        <div className="flex flex-col divide-y divide-pemisah overflow-hidden rounded-[20px] bg-kaca-isi">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="t-subjudul w-24 shrink-0 text-label-2">{t.perangkat.namaPerangkat}</span>
            {ubahNama === null ? (
              <>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.nama}</span>
                <button type="button" onClick={() => setUbahNama(p.nama)} className="tekan grid size-9 place-items-center rounded-full text-aksen" aria-label={t.perangkat.gantiNama}>
                  <Pencil size={16} />
                </button>
              </>
            ) : (
              <form
                className="flex min-w-0 flex-1 gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (ubahNama.trim() && ubahNama.trim() !== p.nama) await atur({ nama: ubahNama.trim() });
                  setUbahNama(null);
                }}
              >
                <input autoFocus value={ubahNama} onChange={(e) => setUbahNama(e.target.value)} maxLength={60} aria-label={t.perangkat.gantiNama} className="min-w-0 flex-1 rounded-[10px] bg-kaca-kuat px-3 py-1.5 text-[15px]" />
                <button type="submit" className="tekan grid size-9 place-items-center rounded-full bg-aksen-isi text-white" aria-label={t.umum.simpan}>
                  <Check size={16} />
                </button>
              </form>
            )}
          </div>
          {[
            [t.perangkat.ruangan, p.ruangan ?? "-"],
            [t.perangkat.jenis, p.jenisLabel],
          ].map(([a, b]) => (
            <div key={a} className="flex items-center gap-3 px-4 py-3">
              <span className="t-subjudul w-24 shrink-0 text-label-2">{a}</span>
              <span className="min-w-0 flex-1 truncate text-[15px]">{b}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="t-subjudul w-24 shrink-0 text-label-2">{t.perangkat.idPerangkat}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-label-2">{p.id}</span>
            <button
              type="button"
              aria-label={t.umum.salin}
              className="tekan grid size-9 place-items-center rounded-full text-label-2"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(p.id);
                  setTersalin(true);
                  setTimeout(() => setTersalin(false), 1500);
                } catch {
                  /* abaikan */
                }
              }}
            >
              {tersalin ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-col divide-y divide-pemisah overflow-hidden rounded-[20px] bg-kaca-isi">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{t.perangkat.konfirmasiAgen}</span>
              <span className="t-keterangan block text-label-2">{t.perangkat.konfirmasiAgenKet}</span>
            </span>
            <Saklar nyala={p.sensitif} ubah={(v) => void atur({ sensitif: v })} label={t.perangkat.konfirmasiAgen} />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 text-[15px] font-medium">{t.perangkat.sembunyikan}</span>
            <Saklar nyala={p.disembunyikan} ubah={(v) => void atur({ disembunyikan: v })} label={t.perangkat.sembunyikan} />
          </div>
        </div>
      </Bagian>
      {!p.kontrol.daya && !p.kontrol.saluran.length && !p.kontrol.suhuTarget && !p.kontrol.tirai.length && !p.kontrol.pemancarIr && !p.kontrol.lainnya.length && p.punyaModel ? (
        <p className="t-keterangan mt-4 flex items-center gap-2 text-label-3">
          <Thermometer size={14} />
          {t.perangkat.tidakBisaDikendalikan}
        </p>
      ) : null}
    </Lembar>
  );
}

function GrafikJam({ data }: { data: Array<{ jam: string; nilai: number }> }) {
  const maks = Math.max(...data.map((d) => d.nilai), 0.0001);
  return (
    <div className="mt-4 flex h-24 items-end gap-[3px]" role="img" aria-label={data.map((d) => `${d.jam} ${d.nilai}`).join(", ")}>
      {data.map((d) => (
        <span key={d.jam} title={`${d.jam}: ${d.nilai}`} className="flex-1 rounded-t-[4px] bg-[var(--ikon-colokan)]" style={{ height: `${Math.max(4, (d.nilai / maks) * 100)}%`, opacity: d.nilai ? 1 : 0.25 }} />
      ))}
    </div>
  );
}

function PanelPemancar({ remote, segarkan, menyegarkan, buka }: { remote: PerangkatRamah[]; segarkan: () => Promise<void>; menyegarkan: boolean; buka?: (id: string) => void }) {
  const { t } = useKamus();
  const IkonRemote = IKON_JENIS.remote;
  return (
    <div data-pemancar-ir>
      <div className="flex gap-3 rounded-[20px] bg-aksen-isi/10 p-4">
        <Radio size={22} className="mt-0.5 shrink-0 text-aksen" />
        <div className="min-w-0">
          <p className="t-kepala">{t.perangkat.hubJudul}</p>
          <p className="t-subjudul mt-1 text-label-2">{t.perangkat.hubIsi}</p>
        </div>
      </div>
      <Bagian judul={t.perangkat.hubDaftar}>
        {remote.length ? (
          <div className="flex flex-col divide-y divide-pemisah overflow-hidden rounded-[20px] bg-kaca-isi">
            {remote.map((r) => {
              const Ikon = IKON_JENIS[r.jenis] ?? IkonRemote;
              return (
                <button key={r.id} type="button" onClick={() => buka?.(r.id)} className="tekan flex items-center gap-3 px-4 py-3 text-left" aria-label={`${t.perangkat.hubBuka} ${r.nama}`}>
                  <Ikon size={20} className="shrink-0 text-label-2" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{r.nama}</span>
                    <span className="t-keterangan block truncate text-label-2">{[r.jenisLabel, r.ruangan].filter(Boolean).join(" · ")}</span>
                  </span>
                  {buka ? <ChevronRight size={18} className="shrink-0 text-label-3" /> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="t-subjudul rounded-[20px] bg-kaca-isi px-4 py-3 text-label-2">{t.perangkat.hubKosong}</p>
        )}
        <Tombol varian="kaca" className="mt-3 w-full" onClick={() => void segarkan()} disabled={menyegarkan}>
          <RefreshCw size={16} className={menyegarkan ? "putar" : ""} />
          {t.perangkat.hubSegarkan}
        </Tombol>
      </Bagian>
      <Bagian judul={t.perangkat.hubLangkahJudul}>
        <ol className="flex flex-col gap-2 rounded-[20px] bg-kaca-isi p-4">
          {t.perangkat.hubLangkah.map((l, i) => (
            <li key={l} className="flex gap-3 text-[15px]">
              <span className="t-angka font-semibold text-aksen">{i + 1}.</span>
              <span>{l}</span>
            </li>
          ))}
        </ol>
        <p className="t-keterangan mt-2 px-1 text-label-2">{t.perangkat.hubDiy}</p>
      </Bagian>
    </div>
  );
}
