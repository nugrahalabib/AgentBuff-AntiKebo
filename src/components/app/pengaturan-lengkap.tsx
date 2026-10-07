"use client";

import { Bookmark, Bot, Globe, Languages, Moon, Palette, Printer, QrCode, RotateCcw, SlidersHorizontal, Trash2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bagian, Baris, PilihBunyi, PilihKarakter, PilihKodeQr, PilihSuara, PilihanPil, type DataSuara } from "@/components/layar/ubah-alarm";
import { Penghitung, Saklar, Segmen, Tombol } from "@/components/ui/dasar";
import { BarisGrup, Grup } from "@/components/ui/grup";
import { Lembar } from "@/components/ui/lembar";
import { RodaJam } from "@/components/ui/roda-jam";
import { tampilToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { panggilApi } from "@/lib/klien/api";
import { bersihkanPeramban } from "@/lib/klien/bersihkan";
import { jamLokal, type FormAlarm } from "@/lib/tampilan/alarm-klien";

/**
 * Pengaturan lengkap (PRD M, docs/04-DESAIN.md §4.10): daftar bergrup; tiap baris membuka lembar
 * kecil yang menyimpan lewat `PATCH /api/app/preferensi` (Komitmen tetap ditegakkan server, galatnya
 * tampil di lembar). Template dan kode QR dikelola di lembarnya sendiri; hapus data dengan ketik.
 */

export type BawaanKlien = Pick<FormAlarm, "karakter" | "suaraId" | "bunyi" | "soal" | "tunda" | "spam" | "komitmen" | "masihBangun" | "liburNasional" | "batasMenit">;

export type PrefKlien = {
  nama: string | null;
  namaPanggilan: string | null;
  zonaWaktu: string;
  bahasa: "id" | "en";
  jamTidur: string;
  tema: "sistem" | "terang" | "gelap";
  bawaan: BawaanKlien;
};

type UbahPref = Partial<Pick<PrefKlien, "namaPanggilan" | "zonaWaktu" | "bahasa" | "jamTidur" | "tema">> & { bawaan?: Partial<BawaanKlien> };

/** Simpan sebagian preferensi; mengembalikan preferensi baru atau null (galat sudah di `setGalat`). */
function useSimpanPref() {
  const { t } = useKamus();
  const router = useRouter();
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const simpan = async (ubah: UbahPref): Promise<PrefKlien | null> => {
    setProses(true);
    setGalat(null);
    const r = await panggilApi<PrefKlien>("/api/app/preferensi", "PATCH", ubah);
    setProses(false);
    if (!r.ok) {
      setGalat(r.pesan ?? t.umum.galatUmum);
      return null;
    }
    router.refresh();
    return r.data;
  };
  return { simpan, proses, galat, setGalat };
}

function LembarIsian({
  judul,
  buka,
  tutup,
  galat,
  proses,
  simpan,
  nonaktif,
  children,
  lebar,
}: {
  judul: string;
  buka: boolean;
  tutup: () => void;
  galat: string | null;
  proses: boolean;
  simpan: () => void;
  nonaktif?: boolean;
  children: ReactNode;
  lebar?: number;
}) {
  const { t } = useKamus();
  return (
    <Lembar
      buka={buka}
      ubahBuka={(v) => (v ? undefined : tutup())}
      judul={judul}
      lebar={lebar}
      kaki={
        <div className="flex flex-col gap-2">
          {galat ? (
            <p role="alert" data-pesan-galat className="t-subjudul text-bahaya">
              {galat}
            </p>
          ) : null}
          <Tombol ukuran="besar" className="w-full" disabled={proses || nonaktif} onClick={simpan}>
            {proses ? t.umum.menyimpan : t.pengaturanLengkap.simpan}
          </Tombol>
        </div>
      }
    >
      {children}
    </Lembar>
  );
}

const kelasInput = "h-12 w-full rounded-[14px] bg-kaca-isi px-4 text-[17px] outline-none placeholder:text-label-2 focus-visible:ring-2 focus-visible:ring-aksen-isi";

// ------------------------------------------------------------------ Kamu

type BagianKamu = "nama" | "zona" | "bahasa" | "tidur" | "tema";

export function GrupKamu({ awal }: { awal: PrefKlien }) {
  const { t, b } = useKamus();
  const P = t.pengaturanLengkap;
  const [p, setP] = useState(awal);
  const [buka, setBuka] = useState<BagianKamu | null>(null);
  const [nama, setNama] = useState("");
  const [zona, setZona] = useState("");
  const [bahasa, setBahasa] = useState<PrefKlien["bahasa"]>("id");
  const [tidur, setTidur] = useState("22:00");
  const [tema, setTema] = useState<PrefKlien["tema"]>("sistem");
  const { simpan, proses, galat, setGalat } = useSimpanPref();

  const mulai = (x: BagianKamu) => {
    setGalat(null);
    setNama(p.namaPanggilan ?? "");
    setZona(p.zonaWaktu);
    setBahasa(p.bahasa);
    setTidur(p.jamTidur);
    setTema(p.tema);
    setBuka(x);
  };
  const kirim = async (ubah: UbahPref) => {
    const baru = await simpan(ubah);
    if (!baru) return;
    setP((l) => ({ ...l, ...baru, bawaan: l.bawaan }));
    if (ubah.tema) document.documentElement.dataset.tema = ubah.tema;
    setBuka(null);
    tampilToast(P.disimpan);
  };
  const tutup = () => setBuka(null);
  const [jt, mt] = tidur.split(":").map(Number);

  return (
    <>
      <Grup judul={P.kamu} id="g-kamu">
        <BarisGrup ikon={User} warnaIkon="#6366f1" label={P.namaPanggilan} nilai={p.namaPanggilan ?? p.nama ?? P.namaKosong} onClick={() => mulai("nama")} />
        <BarisGrup ikon={Globe} warnaIkon="#0ea5e9" label={P.zona} nilai={p.zonaWaktu} onClick={() => mulai("zona")} />
        <BarisGrup ikon={Languages} warnaIkon="#10b981" label={P.bahasa} nilai={P.bahasaPilihan[p.bahasa]} onClick={() => mulai("bahasa")} />
        <BarisGrup ikon={Moon} warnaIkon="#4338ca" label={P.jamTidur} nilai={jamLokal(p.jamTidur, b)} onClick={() => mulai("tidur")} />
        <BarisGrup ikon={Palette} warnaIkon="#ec4899" label={P.tema} nilai={P.temaPilihan[p.tema]} onClick={() => mulai("tema")} />
      </Grup>

      <LembarIsian
        judul={P.namaPanggilan}
        buka={buka === "nama"}
        tutup={tutup}
        galat={galat}
        proses={proses}
        nonaktif={!nama.trim()}
        simpan={() => void kirim({ namaPanggilan: nama.trim() })}
      >
        <input value={nama} maxLength={30} onChange={(e) => setNama(e.target.value)} aria-label={P.namaPanggilan} className={kelasInput} />
        <p className="t-keterangan mt-2 text-label-2">{P.namaKet}</p>
        {p.namaPanggilan && p.nama ? (
          <Tombol varian="kaca" ukuran="sedang" className="mt-4" disabled={proses} onClick={() => void kirim({ namaPanggilan: null })}>
            {P.namaAgentbuff} ({p.nama})
          </Tombol>
        ) : null}
      </LembarIsian>

      <LembarIsian judul={P.zona} buka={buka === "zona"} tutup={tutup} galat={galat} proses={proses} nonaktif={!zona} simpan={() => void kirim({ zonaWaktu: zona })}>
        <PilihZona nilai={zona} ubah={setZona} />
      </LembarIsian>

      <LembarIsian judul={P.bahasa} buka={buka === "bahasa"} tutup={tutup} galat={galat} proses={proses} simpan={() => void kirim({ bahasa })}>
        <Segmen label={P.bahasa} nilai={bahasa} ubah={setBahasa} pilihan={(["id", "en"] as const).map((x) => ({ nilai: x, label: P.bahasaPilihan[x] }))} />
        <p className="t-keterangan mt-2 text-label-2">{P.bahasaKet}</p>
      </LembarIsian>

      <LembarIsian judul={P.jamTidur} buka={buka === "tidur"} tutup={tutup} galat={galat} proses={proses} simpan={() => void kirim({ jamTidur: tidur })}>
        <RodaJam
          jam={jt}
          menit={mt}
          ubah={(v) => setTidur(`${String(v.jam).padStart(2, "0")}:${String(v.menit).padStart(2, "0")}`)}
          labelJam={t.ubah.jam}
          labelMenit={t.ubah.menit}
          langkahMenit={5}
        />
        <p className="t-keterangan mt-3 text-label-2">{P.jamTidurKet}</p>
      </LembarIsian>

      <LembarIsian judul={P.tema} buka={buka === "tema"} tutup={tutup} galat={galat} proses={proses} simpan={() => void kirim({ tema })}>
        <Segmen label={P.tema} nilai={tema} ubah={setTema} pilihan={(["sistem", "terang", "gelap"] as const).map((x) => ({ nilai: x, label: P.temaPilihan[x] }))} />
      </LembarIsian>
    </>
  );
}

/** Pilih zona IANA: cari, plus "pakai zona perangkat ini". Maks 60 hasil tampil. */
function PilihZona({ nilai, ubah }: { nilai: string; ubah: (z: string) => void }) {
  const { t, b } = useKamus();
  const P = t.pengaturanLengkap;
  const [cari, setCari] = useState("");
  const semua = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"];
    }
  }, []);
  const perangkat = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const kata = cari.trim().toLowerCase().replace(/\s+/g, "_");
  const hasil = (kata ? semua.filter((z) => z.toLowerCase().includes(kata)) : [nilai, ...semua.filter((z) => z.startsWith("Asia/") && z !== nilai)]).slice(0, 60);
  const selisih = (z: string) => {
    try {
      return (
        new Intl.DateTimeFormat(b === "id" ? "id-ID" : "en-US", { timeZone: z, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((x) => x.type === "timeZoneName")
          ?.value ?? ""
      );
    } catch {
      return "";
    }
  };
  return (
    <div className="flex flex-col gap-3">
      {perangkat && perangkat !== nilai ? (
        <Tombol varian="kaca" ukuran="sedang" onClick={() => ubah(perangkat)}>
          {isi(P.zonaPerangkat, { zona: perangkat })}
        </Tombol>
      ) : null}
      <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder={P.zonaCari} aria-label={P.zonaCari} className={kelasInput} />
      <ul role="radiogroup" aria-label={P.zona} className="flex max-h-[42dvh] flex-col gap-1 overflow-y-auto">
        {hasil.length ? (
          hasil.map((z) => (
            <li key={z}>
              <button
                type="button"
                role="radio"
                aria-checked={z === nilai}
                onClick={() => ubah(z)}
                className={cn(
                  "tekan flex min-h-11 w-full items-center gap-3 rounded-[12px] px-3.5 text-left text-[16px]",
                  z === nilai ? "bg-kaca-kuat ring-2 ring-toska-isi" : "hover:bg-kaca-isi",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{z.replace(/_/g, " ")}</span>
                <span className="t-keterangan text-label-2">{selisih(z)}</span>
              </button>
            </li>
          ))
        ) : (
          <li className="t-subjudul px-1 text-label-2">{P.zonaTidakAda}</li>
        )}
      </ul>
      <p className="t-keterangan text-label-2">{P.zonaKet}</p>
    </div>
  );
}

// ------------------------------------------------------------------ Alarm: bawaan, template, kode QR

export type TemplatePengguna = { id: string; nama: string };
export type KodeQrPengguna = { id: string; nama: string; dipakai: number };

export function GrupAlarm({
  bawaan: awal,
  nama,
  template: tplAwal,
  kodeQr: qrAwal,
}: {
  bawaan: BawaanKlien;
  nama: string;
  template: TemplatePengguna[];
  kodeQr: KodeQrPengguna[];
}) {
  const { t } = useKamus();
  const P = t.pengaturanLengkap;
  const U = t.ubah;
  const router = useRouter();
  const [bawaan, setBawaan] = useState(awal);
  const [buka, setBuka] = useState<"bawaan" | "template" | "qr" | null>(null);
  const [template, setTemplate] = useState(tplAwal);
  const [kodeQr, setKodeQr] = useState(qrAwal);

  const muatQr = async () => {
    const r = await panggilApi<{ kodeQr: KodeQrPengguna[] }>("/api/app/kode-qr");
    if (r.ok) setKodeQr(r.data.kodeQr);
  };
  const galatToast = (pesan: string | null) => tampilToast(pesan ?? t.umum.galatUmum, "galat");

  return (
    <>
      <Grup judul={P.alarm} id="g-alarm">
        <BarisGrup
          ikon={SlidersHorizontal}
          warnaIkon="#f59e0b"
          label={P.bawaan}
          sub={isi(P.bawaanRingkas, { karakter: t.karakter[bawaan.karakter].nama, soal: U.soalJenis[bawaan.soal.jenis] })}
          onClick={() => setBuka("bawaan")}
        />
        <BarisGrup ikon={Bookmark} warnaIkon="#0d9488" label={P.template} nilai={String(template.length)} onClick={() => setBuka("template")} />
        <BarisGrup ikon={QrCode} warnaIkon="#334155" label={P.kodeQr} nilai={String(kodeQr.length)} onClick={() => setBuka("qr")} />
      </Grup>

      {buka === "bawaan" ? (
        <LembarBawaan
          awal={bawaan}
          nama={nama}
          kodeQr={kodeQr}
          tutup={() => setBuka(null)}
          tersimpan={(b) => {
            setBawaan(b);
            setBuka(null);
            tampilToast(P.disimpan);
          }}
          kodeBaru={async (n) => {
            const r = await panggilApi<{ kodeQr: KodeQrPengguna }>("/api/app/kode-qr", "POST", { nama: n });
            if (!r.ok) return (galatToast(r.pesan), null);
            void muatQr();
            return { id: r.data.kodeQr.id, nama: r.data.kodeQr.nama };
          }}
        />
      ) : null}

      <Lembar buka={buka === "template"} ubahBuka={(v) => setBuka(v ? "template" : null)} judul={P.template} sub={P.templateKet}>
        <DaftarKelola
          daftar={template.map((x) => ({ id: x.id, nama: x.nama }))}
          kosong={P.templateKosong}
          namaMaks={40}
          ganti={async (id, n) => {
            const r = await panggilApi<{ template: TemplatePengguna }>(`/api/app/template/${id}`, "PATCH", { nama: n });
            if (!r.ok) return (galatToast(r.pesan), false);
            setTemplate((l) => l.map((x) => (x.id === id ? { ...x, nama: r.data.template.nama } : x)));
            return true;
          }}
          hapus={async (id) => {
            const r = await panggilApi(`/api/app/template/${id}`, "DELETE");
            if (!r.ok) return (galatToast(r.pesan), false);
            setTemplate((l) => l.filter((x) => x.id !== id));
            router.refresh();
            return true;
          }}
        />
      </Lembar>

      <Lembar buka={buka === "qr"} ubahBuka={(v) => setBuka(v ? "qr" : null)} judul={P.kodeQr} sub={P.kodeQrKet}>
        <DaftarKelola
          daftar={kodeQr.map((x) => ({ id: x.id, nama: x.nama, sub: x.dipakai ? isi(P.kodeQrDipakai, { n: x.dipakai }) : undefined, cetak: `/app/kode-qr/${x.id}/cetak` }))}
          kosong={P.kodeQrKosong}
          namaMaks={40}
          ganti={async (id, n) => {
            const r = await panggilApi(`/api/app/kode-qr/${id}`, "PATCH", { nama: n });
            if (!r.ok) return (galatToast(r.pesan), false);
            await muatQr();
            return true;
          }}
          hapus={async (id) => {
            const r = await panggilApi(`/api/app/kode-qr/${id}`, "DELETE");
            if (!r.ok) return (galatToast(r.pesan), false);
            await muatQr();
            return true;
          }}
          tambah={{
            label: P.kodeQrBaru,
            placeholder: P.kodeQrNama,
            buat: async (n) => {
              const r = await panggilApi("/api/app/kode-qr", "POST", { nama: n });
              if (!r.ok) return (galatToast(r.pesan), false);
              await muatQr();
              return true;
            },
          }}
        />
      </Lembar>
    </>
  );
}

/** Daftar dengan ganti nama + hapus (konfirmasi di baris) + opsional cetak dan tambah. */
function DaftarKelola({
  daftar,
  kosong,
  namaMaks,
  ganti,
  hapus,
  tambah,
}: {
  daftar: Array<{ id: string; nama: string; sub?: string; cetak?: string }>;
  kosong: string;
  namaMaks: number;
  ganti: (id: string, nama: string) => Promise<boolean>;
  hapus: (id: string) => Promise<boolean>;
  tambah?: { label: string; placeholder: string; buat: (nama: string) => Promise<boolean> };
}) {
  const { t } = useKamus();
  const P = t.pengaturanLengkap;
  const [mode, setMode] = useState<{ id: string; jenis: "nama" | "hapus" } | null>(null);
  const [nama, setNama] = useState("");
  const [baru, setBaru] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const jalan = async (fn: () => Promise<boolean>, sesudah: () => void) => {
    setSibuk(true);
    const ok = await fn();
    setSibuk(false);
    if (ok) sesudah();
  };
  return (
    <div className="flex flex-col gap-3">
      {daftar.length ? (
        <ul className="flex flex-col gap-2">
          {daftar.map((x) => (
            <li key={x.id} className="rounded-[16px] bg-kaca-isi px-3.5 py-2.5">
              {mode?.id === x.id && mode.jenis === "nama" ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nama}
                    maxLength={namaMaks}
                    onChange={(e) => setNama(e.target.value)}
                    aria-label={`${P.gantiNama}: ${x.nama}`}
                    className="h-11 min-w-0 flex-1 rounded-[12px] bg-kaca-kuat px-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-aksen-isi"
                  />
                  <Tombol
                    ukuran="sedang"
                    disabled={sibuk || !nama.trim()}
                    onClick={() =>
                      void jalan(
                        () => ganti(x.id, nama.trim()),
                        () => setMode(null),
                      )
                    }
                  >
                    {P.simpan}
                  </Tombol>
                  <Tombol varian="polos" ukuran="sedang" onClick={() => setMode(null)}>
                    {t.umum.batal}
                  </Tombol>
                </div>
              ) : mode?.id === x.id && mode.jenis === "hapus" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-[15px] font-semibold">{isi(P.hapusYakin, { nama: x.nama })}</span>
                  <Tombol varian="kaca" ukuran="kecil" onClick={() => setMode(null)}>
                    {t.umum.batal}
                  </Tombol>
                  <Tombol
                    varian="bahaya"
                    ukuran="kecil"
                    disabled={sibuk}
                    onClick={() =>
                      void jalan(
                        () => hapus(x.id),
                        () => {
                          setMode(null);
                          tampilToast(isi(P.dihapus, { nama: x.nama }));
                        },
                      )
                    }
                  >
                    {P.hapus}
                  </Tombol>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">{x.nama}</span>
                    {x.sub ? <span className="t-keterangan block text-label-2">{x.sub}</span> : null}
                  </span>
                  {x.cetak ? (
                    <a
                      href={x.cetak}
                      target="_blank"
                      rel="noopener"
                      aria-label={`${P.cetak}: ${x.nama}`}
                      className="tekan grid size-10 place-items-center rounded-full text-label-2"
                    >
                      <Printer size={18} />
                    </a>
                  ) : null}
                  <Tombol
                    varian="polos"
                    ukuran="kecil"
                    aria-label={`${P.gantiNama}: ${x.nama}`}
                    onClick={() => {
                      setNama(x.nama);
                      setMode({ id: x.id, jenis: "nama" });
                    }}
                  >
                    {P.gantiNama}
                  </Tombol>
                  <button
                    type="button"
                    aria-label={`${P.hapus}: ${x.nama}`}
                    onClick={() => setMode({ id: x.id, jenis: "hapus" })}
                    className="tekan grid size-10 place-items-center rounded-full text-bahaya"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="t-subjudul text-label-2">{kosong}</p>
      )}
      {tambah ? (
        <div className="flex items-center gap-2">
          <input
            value={baru}
            maxLength={namaMaks}
            onChange={(e) => setBaru(e.target.value)}
            placeholder={tambah.placeholder}
            aria-label={tambah.placeholder}
            className="h-11 min-w-0 flex-1 rounded-[12px] bg-kaca-isi px-3.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-aksen-isi"
          />
          <Tombol
            varian="kaca"
            ukuran="sedang"
            disabled={sibuk || !baru.trim()}
            onClick={() =>
              void jalan(
                () => tambah.buat(baru.trim()),
                () => setBaru(""),
              )
            }
          >
            {P.buat}
          </Tombol>
        </div>
      ) : null}
    </div>
  );
}

const BATAS_ALARM = ["tanpa", "15", "30", "60"] as const;

/** Bawaan alarm baru (PRD M): karakter, suara, bunyi, soal, tunda, Komitmen, Masih bangun, libur, batas. */
function LembarBawaan({
  awal,
  nama,
  kodeQr,
  tutup,
  tersimpan,
  kodeBaru,
}: {
  awal: BawaanKlien;
  nama: string;
  kodeQr: KodeQrPengguna[];
  tutup: () => void;
  tersimpan: (b: BawaanKlien) => void;
  kodeBaru: (nama: string) => Promise<{ id: string; nama: string } | null>;
}) {
  const { t } = useKamus();
  const P = t.pengaturanLengkap;
  const U = t.ubah;
  const [v, setV] = useState(awal);
  const atur = (ubah: Partial<BawaanKlien>) => setV((l) => ({ ...l, ...ubah }));
  const [suara, setSuara] = useState<DataSuara>({ status: "memuat" });
  const { simpan, proses, galat } = useSimpanPref();
  const galatUmum = t.umum.galatUmum;
  useEffect(() => {
    let hidup = true;
    void panggilApi<{ suara: Array<{ id: string; nama: string }> }>("/api/app/suara").then((r) => {
      if (hidup) setSuara(r.ok ? { status: "ada", suara: r.data.suara.map((s) => ({ id: s.id, nama: s.nama })) } : { status: "galat", pesan: r.pesan ?? galatUmum });
    });
    return () => {
      hidup = false;
    };
  }, [galatUmum]);

  const kirim = async () => {
    // Kanal spam bawaan diatur di bagian Kanal pesan (tidak ikut dikirim supaya tidak saling timpa).
    const baru = await simpan({
      bawaan: {
        karakter: v.karakter,
        suaraId: v.suaraId,
        bunyi: v.bunyi,
        soal: v.soal,
        tunda: v.tunda,
        komitmen: v.komitmen,
        masihBangun: v.masihBangun,
        liburNasional: v.liburNasional,
        batasMenit: v.batasMenit,
      },
    });
    if (baru) tersimpan({ ...v, ...baru.bawaan });
  };

  return (
    <LembarIsian judul={P.bawaan} buka tutup={tutup} galat={galat} proses={proses} simpan={() => void kirim()} lebar={560}>
      <div className="flex flex-col gap-7">
        <p className="t-subjudul text-label-2">{P.bawaanKet}</p>
        <Bagian judul={U.karakter}>
          <PilihKarakter nilai={v.karakter} ubah={(k) => atur({ karakter: k })} nama={nama} />
          <PilihSuara
            nilai={v.suaraId}
            ubah={(s) => atur({ suaraId: s })}
            data={suara}
            dengar={async (suaraId) => {
              const r = await panggilApi<{ klip: string | null }>("/api/app/suara/contoh", "POST", { suaraId });
              if (!r.ok) return void tampilToast(r.pesan ?? t.umum.galatUmum, "galat");
              if (!r.data.klip) return void tampilToast(U.contohDibuat);
              await new Audio(r.data.klip).play().catch(() => tampilToast(t.umum.galatUmum, "galat"));
            }}
          />
          <PilihBunyi nilai={v.bunyi} ubah={(x) => atur({ bunyi: x })} />
        </Bagian>

        <Bagian judul={U.soal}>
          <PilihanPil
            label={U.soal}
            nilai={v.soal.jenis}
            ubah={(s) => atur({ soal: { ...v.soal, jenis: s } })}
            pilihan={(["hitungan", "ingat", "ketik", "qr", "gabungan"] as const).map((s) => ({ nilai: s, label: U.soalJenis[s] }))}
          />
          {v.soal.jenis !== "qr" ? (
            <div className="mt-2">
              <Segmen
                label={U.tingkatLabel}
                nilai={v.soal.tingkat}
                ubah={(s) => atur({ soal: { ...v.soal, tingkat: s } })}
                pilihan={(["ringan", "sedang", "berat"] as const).map((s) => ({ nilai: s, label: U.tingkat[s] }))}
              />
            </div>
          ) : null}
          {v.soal.jenis !== "qr" ? (
            <Baris label={U.benarBeruntun}>
              <Penghitung
                nilai={v.soal.benar}
                min={1}
                maks={5}
                ubah={(n) => atur({ soal: { ...v.soal, benar: n } })}
                label={U.benarBeruntun}
                labelKurang={t.umum.kurangi}
                labelTambah={t.umum.tambah}
              />
            </Baris>
          ) : null}
          {v.soal.jenis === "qr" || v.soal.jenis === "gabungan" ? (
            <PilihKodeQr dipilih={v.soal.kodeQr} ubah={(k) => atur({ soal: { ...v.soal, kodeQr: k } })} data={{ status: "ada", kode: kodeQr }} buat={kodeBaru} />
          ) : null}
        </Bagian>

        <Bagian judul={U.tunda}>
          <Baris label={U.tundaJatah} keterangan={v.tunda.jatah === 0 ? U.tanpaTunda : undefined}>
            <Penghitung
              nilai={v.tunda.jatah}
              min={0}
              maks={5}
              ubah={(n) => atur({ tunda: { ...v.tunda, jatah: n } })}
              label={U.tundaJatah}
              labelKurang={t.umum.kurangi}
              labelTambah={t.umum.tambah}
            />
          </Baris>
          {v.tunda.jatah > 0 ? (
            <div className="mt-2">
              <Segmen
                label={U.tundaLama}
                nilai={String(v.tunda.menit) as "5" | "10" | "15"}
                ubah={(s) => atur({ tunda: { ...v.tunda, menit: Number(s) as 5 | 10 | 15 } })}
                pilihan={(["5", "10", "15"] as const).map((m) => ({ nilai: m, label: isi(U.tundaMenit, { n: m }) }))}
              />
            </div>
          ) : null}
        </Bagian>

        <Bagian judul={U.lanjutan}>
          <Baris label={U.komitmen} keterangan={U.komitmenKet}>
            <Saklar nyala={v.komitmen} label={U.komitmen} ubah={(n) => atur({ komitmen: n })} />
          </Baris>
          <Baris label={U.masihBangun} keterangan={v.masihBangun.aktif ? isi(U.masihBangunKet, { n: v.masihBangun.menit }) : U.masihBangunMati}>
            <Saklar nyala={v.masihBangun.aktif} label={U.masihBangun} ubah={(n) => atur({ masihBangun: { ...v.masihBangun, aktif: n } })} />
          </Baris>
          {v.masihBangun.aktif ? (
            <Baris label={U.masihBangunMenit}>
              <Penghitung
                nilai={v.masihBangun.menit}
                min={3}
                maks={15}
                ubah={(n) => atur({ masihBangun: { ...v.masihBangun, menit: n } })}
                label={U.masihBangunMenit}
                labelKurang={t.umum.kurangi}
                labelTambah={t.umum.tambah}
                satuan={isi(U.menitN, { n: v.masihBangun.menit })}
              />
            </Baris>
          ) : null}
          <Baris label={U.libur}>
            <Saklar nyala={v.liburNasional} label={U.libur} ubah={(n) => atur({ liburNasional: n })} />
          </Baris>
          <div className="flex flex-col gap-1.5 py-1.5">
            <span className="text-[15px]">{U.batasAlarm}</span>
            <Segmen
              label={U.batasAlarm}
              nilai={v.batasMenit === null ? "tanpa" : (String(v.batasMenit) as (typeof BATAS_ALARM)[number])}
              ubah={(s) => atur({ batasMenit: s === "tanpa" ? null : Number(s) })}
              pilihan={BATAS_ALARM.map((m) => ({ nilai: m, label: m === "tanpa" ? U.tanpaBatas : isi(U.menitN, { n: m }) }))}
            />
          </div>
        </Bagian>
      </div>
    </LembarIsian>
  );
}

// ------------------------------------------------------------------ lainnya

export function GrupLainnya() {
  const { t } = useKamus();
  const P = t.pengaturanLengkap;
  const H = t.hapusData;
  const [buka, setBuka] = useState(false);
  const [kata, setKata] = useState("");
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const cocok = kata.trim().toUpperCase() === H.kata;

  const hapus = async () => {
    if (!cocok || proses) return;
    setProses(true);
    setGalat(null);
    const r = await panggilApi("/api/app/hapus-data", "POST", { konfirmasi: kata });
    if (!r.ok) {
      setProses(false);
      setGalat(r.pesan ?? t.umum.galatUmum);
      return;
    }
    await bersihkanPeramban({ lepasDiServer: false });
    window.location.replace("/masuk?info=dihapus");
  };

  return (
    <>
      <Grup judul={P.lainnya} id="g-lainnya">
        <BarisGrup ikon={Bot} warnaIkon="#0f766e" label={P.agen} sub={t.agen.barisKet} href="/app/agen" />
        <BarisGrup ikon={RotateCcw} warnaIkon="#64748b" label={P.ulangOrientasi} sub={P.ulangOrientasiKet} href="/app/orientasi?ulang=1" />
        <BarisGrup
          ikon={Trash2}
          warnaIkon="#dc2626"
          label={P.hapusData}
          bahaya
          onClick={() => {
            setKata("");
            setGalat(null);
            setBuka(true);
          }}
        />
      </Grup>
      <Lembar
        buka={buka}
        ubahBuka={setBuka}
        judul={H.judul}
        kaki={
          <div className="flex flex-col gap-2">
            {galat ? (
              <p role="alert" data-pesan-galat className="t-subjudul text-bahaya">
                {galat}
              </p>
            ) : null}
            <Tombol varian="bahaya" ukuran="besar" className="w-full" disabled={!cocok || proses} onClick={() => void hapus()}>
              {proses ? t.umum.memuat : H.tombol}
            </Tombol>
          </div>
        }
      >
        <div className="flex flex-col gap-3 text-[16px]">
          <p>{H.isi}</p>
          <p className="text-label-2">{H.tetap}</p>
          <label className="mt-2 flex flex-col gap-2">
            <span className="t-subjudul font-semibold">{isi(H.ketik, { kata: H.kata })}</span>
            <input value={kata} onChange={(e) => setKata(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} className={kelasInput} />
          </label>
        </div>
      </Lembar>
    </>
  );
}
