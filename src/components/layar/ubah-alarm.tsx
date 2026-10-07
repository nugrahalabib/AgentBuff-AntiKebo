"use client";

import { AlarmClock, BookmarkPlus, ChevronDown, Copy, Lock, Play, Plus, Printer, SkipForward, Square, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Penghitung, Saklar, Segmen, TautanTombol, Tombol } from "@/components/ui/dasar";
import { Lembar } from "@/components/ui/lembar";
import { RodaJam } from "@/components/ui/roda-jam";
import { berkasBunyi } from "@/lib/bunyi/berkas";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { useDengarContoh } from "@/lib/klien/dengar";
import { pratinjauBunyi } from "@/lib/suara/pemutar";
import { terapkanTemplate, type FormAlarm, type TemplateKlien } from "@/lib/tampilan/alarm-klien";
import { DAFTAR_BUNYI, DAFTAR_KARAKTER, WARNA_KARAKTER, type KanalTampil, type StatusSuara } from "@/lib/tampilan/jenis";
import { EditorPengulangan } from "./ubah-pengulangan";
import { EditorAturanRumah, type DataRumah } from "./ubah-rumah";
import { gerakRadio } from "@/lib/klien/radio";

export type DataKanal = { status: "memuat" } | { status: "ada"; kanal: KanalTampil[] } | { status: "izin"; pesan: string } | { status: "galat"; pesan: string };
export type DataKodeQr = { status: "memuat" } | { status: "ada"; kode: Array<{ id: string; nama: string }> };
export type DataSuara = { status: "memuat" } | { status: "ada"; suara: Array<{ id: string; nama: string }> } | { status: "galat"; pesan: string };
export type DataUbah = { kanal: DataKanal; rumah: DataRumah; kodeQr: DataKodeQr; suara: DataSuara };

export type AksiAlarm = {
  /** Uji alarm ini (PRD B9); spam chat dan rumah pintar ikut hanya bila dicentang. */
  uji: (opsi: { spam: boolean; tuya: boolean }) => void;
  lewati: () => void;
  gandakan: () => void;
  hapus: () => void;
  /** Simpan alarm ini sebagai template baru (PRD B10); true bila berhasil. */
  simpanTemplate?: (nama: string) => Promise<boolean>;
  /** Aksi yang sedang berjalan. */
  sibuk: "uji" | "lewati" | "gandakan" | "hapus" | "template" | null;
};

const JEDA_SPAM = ["bawaan", "30", "60", "120"] as const;
const BATAS_SPAM = ["tanpa", "10", "30", "60"] as const;
const BATAS_ALARM = ["tanpa", "15", "30", "60"] as const;

/**
 * Ubah alarm (docs/04-DESAIN.md §4.2): lembar dari bawah di HP, dialog di laptop. Urutan dari atas:
 * roda jam, agenda, ulangi, karakter suara, soal, tunda, spam chat, rumah pintar, lanjutan (dilipat).
 * Kebenaran aturan (batas, Komitmen, kode QR, rumah pintar) tetap di server; galatnya tampil di sini.
 */
export function LembarUbahAlarm({
  buka,
  ubahBuka,
  awal,
  baru,
  data,
  suara,
  terkunciJam,
  hariIni,
  nama,
  simpan,
  menyimpan,
  galat,
  aksi,
  buatKodeQr,
  dengarSuara,
  template,
}: {
  buka: boolean;
  ubahBuka: (v: boolean) => void;
  awal: FormAlarm;
  baru: boolean;
  data: DataUbah;
  suara: StatusSuara | null;
  terkunciJam?: string | null;
  hariIni: string;
  nama: string;
  simpan: (v: FormAlarm, opsi?: { template?: string }) => void;
  menyimpan?: boolean;
  galat?: string | null;
  aksi?: AksiAlarm;
  buatKodeQr?: (nama: string) => Promise<{ id: string; nama: string } | null>;
  dengarSuara?: (suaraId: string | null) => Promise<void>;
  /** Template untuk alarm baru (PRD B10). */
  template?: TemplateKlien[];
}) {
  const { t } = useKamus();
  const U = t.ubah;
  const [v, setV] = useState(awal);
  const [tpl, setTpl] = useState<string | null>(null);
  const atur = (ubah: Partial<FormAlarm>) => setV((lama) => ({ ...lama, ...ubah }));
  const [lanjutan, setLanjutan] = useState(false);
  const [yakinHapus, setYakinHapus] = useState(false);
  const [jamStr, menitStr] = v.jam.split(":");

  const ubahJam = (j: { jam: number; menit: number }) => atur({ jam: `${String(j.jam).padStart(2, "0")}:${String(j.menit).padStart(2, "0")}` });

  return (
    <Lembar
      buka={buka}
      ubahBuka={ubahBuka}
      judul={baru ? U.judulBaru : U.judulUbah}
      lebar={560}
      kaki={
        <div className="flex flex-col gap-2">
          {galat ? (
            <p role="alert" data-pesan-galat className="t-subjudul text-bahaya">
              {galat}
            </p>
          ) : null}
          <Tombol ukuran="besar" className="w-full" disabled={menyimpan || !v.agendaJudul.trim()} onClick={() => simpan(v, tpl ? { template: tpl } : undefined)}>
            {menyimpan ? t.umum.menyimpan : U.simpan}
          </Tombol>
        </div>
      }
    >
      <div className="flex flex-col gap-7">
        {terkunciJam ? (
          <p className="flex items-start gap-2 rounded-[16px] bg-waspada-isi/15 px-3.5 py-3 text-[15px]">
            <Lock size={17} className="mt-0.5 shrink-0 text-waspada" />
            {isi(U.terkunci, { jam: terkunciJam })}
          </p>
        ) : null}

        {baru && template?.length ? (
          <Bagian judul={U.template}>
            <PilihanPil
              label={U.template}
              nilai={tpl ?? ""}
              ubah={(id) => {
                const pilih = template.find((x) => x.id === id);
                setTpl(pilih ? pilih.id : null);
                setV(pilih ? terapkanTemplate(awal, pilih.isi) : awal);
              }}
              pilihan={[{ nilai: "", label: U.templateKosong }, ...template.map((x) => ({ nilai: x.id, label: x.nama }))]}
            />
          </Bagian>
        ) : null}

        <RodaJam jam={Number(jamStr)} menit={Number(menitStr)} ubah={ubahJam} labelJam={U.jam} labelMenit={U.menit} />

        <Bagian judul={U.agenda}>
          <input
            value={v.agendaJudul}
            maxLength={60}
            onChange={(e) => atur({ agendaJudul: e.target.value })}
            placeholder={U.agendaJudul}
            aria-label={U.agendaJudul}
            className="h-12 w-full rounded-[14px] bg-kaca-isi px-4 text-[17px] outline-none placeholder:text-label-2 focus-visible:ring-2 focus-visible:ring-aksen-isi"
          />
          <textarea
            value={v.agendaDetail ?? ""}
            maxLength={200}
            rows={2}
            onChange={(e) => atur({ agendaDetail: e.target.value || null })}
            placeholder={U.agendaDetail}
            aria-label={U.agendaDetail}
            className="mt-2 w-full resize-none rounded-[14px] bg-kaca-isi px-4 py-3 text-[15px] outline-none placeholder:text-label-2 focus-visible:ring-2 focus-visible:ring-aksen-isi"
          />
        </Bagian>

        <Bagian judul={U.ulangi}>
          <EditorPengulangan nilai={v.pengulangan} ubah={(p) => atur({ pengulangan: p })} hariIni={hariIni} />
        </Bagian>

        <Bagian judul={U.karakter}>
          <PilihKarakter nilai={v.karakter} ubah={(k) => atur({ karakter: k })} nama={nama} />
          {suara ? (
            <p className={cn("t-keterangan mt-2", suara.status === "belum" ? "text-waspada" : suara.status === "siap" ? "text-toska" : "text-label-2")}>
              {suara.status === "siap"
                ? t.beranda.suaraSiap
                : suara.status === "dibuat"
                  ? isi(t.beranda.suaraDibuat, { n: suara.n, total: suara.total })
                  : (suara.alasan ?? t.beranda.suaraBelum)}
            </p>
          ) : null}
          {v.karakter === "kustom" || v.kalimatPribadi.length ? <KalimatPribadi nilai={v.kalimatPribadi} ubah={(k) => atur({ kalimatPribadi: k })} nama={nama} /> : null}
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
          {v.soal.jenis === "hitungan" || v.soal.jenis === "ingat" || v.soal.jenis === "ketik" || v.soal.jenis === "gabungan" ? (
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
            <PilihKodeQr dipilih={v.soal.kodeQr} ubah={(k) => atur({ soal: { ...v.soal, kodeQr: k } })} data={data.kodeQr} buat={buatKodeQr} />
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

        <Bagian judul={U.spam} keterangan={U.spamKet}>
          <PilihKanal dipilih={v.spam.kanal} ubah={(k) => atur({ spam: { ...v.spam, kanal: k } })} data={data.kanal} />
        </Bagian>

        <Bagian judul={U.rumah}>
          <EditorAturanRumah aturan={v.tuya} ubah={(a) => atur({ tuya: a })} data={data.rumah} />
        </Bagian>

        <div>
          <button
            type="button"
            aria-expanded={lanjutan}
            onClick={() => setLanjutan(!lanjutan)}
            className="tekan flex h-11 w-full items-center justify-between text-[17px] font-semibold"
          >
            {U.lanjutan}
            <ChevronDown size={20} className={cn("text-label-2 transition-transform", lanjutan && "rotate-180")} />
          </button>
          {lanjutan ? (
            <div className="flex flex-col gap-1">
              <Baris label={U.komitmen} keterangan={U.komitmenKet}>
                <Saklar nyala={v.komitmen} label={U.komitmen} ubah={(n) => atur({ komitmen: n })} />
              </Baris>
              <Baris label={U.masihBangun} keterangan={v.masihBangun.aktif ? isi(U.masihBangunKet, { n: v.masihBangun.menit }) : U.masihBangunMati}>
                <Saklar nyala={v.masihBangun.aktif} label={U.masihBangun} ubah={(n) => atur({ masihBangun: { ...v.masihBangun, aktif: n } })} />
              </Baris>
              {v.masihBangun.aktif ? (
                <>
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
                  <div className="py-1.5">
                    <Segmen
                      label={U.masihBangunBatas}
                      nilai={String(v.masihBangun.batasDtk) as "60" | "90" | "120" | "180"}
                      ubah={(s) => atur({ masihBangun: { ...v.masihBangun, batasDtk: Number(s) } })}
                      pilihan={(["60", "90", "120", "180"] as const).map((d) => ({ nilai: d, label: isi(U.detikN, { n: d }) }))}
                    />
                  </div>
                </>
              ) : null}
              <Baris label={U.libur}>
                <Saklar nyala={v.liburNasional} label={U.libur} ubah={(n) => atur({ liburNasional: n })} />
              </Baris>
              <PilihBunyi nilai={v.bunyi} ubah={(x) => atur({ bunyi: x })} />
              <div className="flex flex-col gap-1.5 py-1.5">
                <span className="text-[15px]">{U.batasAlarm}</span>
                <Segmen
                  label={U.batasAlarm}
                  nilai={v.batasMenit === null ? "tanpa" : (String(v.batasMenit) as (typeof BATAS_ALARM)[number])}
                  ubah={(s) => atur({ batasMenit: s === "tanpa" ? null : Number(s) })}
                  pilihan={BATAS_ALARM.map((m) => ({ nilai: m, label: m === "tanpa" ? U.tanpaBatas : isi(U.menitN, { n: m }) }))}
                />
              </div>
              {v.spam.kanal.length ? (
                <>
                  <div className="flex flex-col gap-1.5 py-1.5">
                    <span className="text-[15px]">{U.spamJeda}</span>
                    <Segmen
                      label={U.spamJeda}
                      nilai={v.spam.jedaDtk === null ? "bawaan" : (String(v.spam.jedaDtk) as (typeof JEDA_SPAM)[number])}
                      ubah={(s) => atur({ spam: { ...v.spam, jedaDtk: s === "bawaan" ? null : Number(s) } })}
                      pilihan={JEDA_SPAM.map((m) => ({ nilai: m, label: m === "bawaan" ? U.jedaBawaan : isi(U.detikN, { n: m }) }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 py-1.5">
                    <span className="text-[15px]">{U.spamBatas}</span>
                    <Segmen
                      label={U.spamBatas}
                      nilai={v.spam.batasMenit === null ? "tanpa" : (String(v.spam.batasMenit) as (typeof BATAS_SPAM)[number])}
                      ubah={(s) => atur({ spam: { ...v.spam, batasMenit: s === "tanpa" ? null : Number(s) } })}
                      pilihan={BATAS_SPAM.map((m) => ({ nilai: m, label: m === "tanpa" ? U.selamaBerbunyi : isi(U.menitN, { n: m }) }))}
                    />
                  </div>
                </>
              ) : null}
              <PilihSuara nilai={v.suaraId} ubah={(s) => atur({ suaraId: s })} data={data.suara} dengar={dengarSuara} />
            </div>
          ) : null}
        </div>

        {aksi ? (
          <div className="flex flex-col gap-1 border-t border-pemisah pt-4">
            <PanelUji aksi={aksi} adaSpam={awal.spam.kanal.length > 0} adaTuya={awal.tuya.length > 0} />
            <TombolAksi ikon={SkipForward} label={U.aksi.lewati} sibuk={aksi.sibuk === "lewati"} onClick={aksi.lewati} nonaktif={!awal.aktif} />
            <TombolAksi ikon={Copy} label={U.aksi.gandakan} sibuk={aksi.sibuk === "gandakan"} onClick={aksi.gandakan} />
            {aksi.simpanTemplate ? <PanelTemplate simpan={aksi.simpanTemplate} sibuk={aksi.sibuk === "template"} namaAwal={awal.agendaJudul} /> : null}
            {yakinHapus ? (
              <div className="flex flex-wrap items-center gap-2 rounded-[16px] bg-bahaya-isi/10 px-3.5 py-3">
                <span className="min-w-0 flex-1 text-[15px] font-semibold">{U.aksi.hapusYakin}</span>
                <Tombol varian="kaca" ukuran="kecil" onClick={() => setYakinHapus(false)}>
                  {t.umum.batal}
                </Tombol>
                <Tombol varian="bahaya" ukuran="kecil" disabled={aksi.sibuk === "hapus"} onClick={aksi.hapus}>
                  {aksi.sibuk === "hapus" ? t.umum.memuat : U.aksi.hapusYa}
                </Tombol>
              </div>
            ) : (
              <TombolAksi ikon={Trash2} label={U.aksi.hapus} bahaya onClick={() => setYakinHapus(true)} />
            )}
          </div>
        ) : null}
      </div>
    </Lembar>
  );
}

/** "Simpan sebagai template": nama lalu simpan (PRD B10). */
function PanelTemplate({ simpan, sibuk, namaAwal }: { simpan: (nama: string) => Promise<boolean>; sibuk: boolean; namaAwal: string }) {
  const { t } = useKamus();
  const A = t.ubah.aksi;
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState(namaAwal);
  if (!buka) return <TombolAksi ikon={BookmarkPlus} label={A.simpanTemplate} keterangan={A.simpanTemplateKet} onClick={() => setBuka(true)} />;
  const kirim = async () => {
    if (await simpan(nama)) setBuka(false);
  };
  return (
    <div className="flex flex-col gap-2 rounded-[16px] bg-kaca-isi px-3.5 py-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[15px] font-semibold">{A.namaTemplate}</span>
        <input
          value={nama}
          maxLength={40}
          onChange={(e) => setNama(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void kirim()}
          className="h-11 rounded-[12px] bg-kaca-isi px-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-aksen-isi"
        />
      </label>
      <div className="flex justify-end gap-2">
        <Tombol varian="kaca" ukuran="kecil" onClick={() => setBuka(false)}>
          {t.umum.batal}
        </Tombol>
        <Tombol ukuran="kecil" disabled={sibuk || !nama.trim()} onClick={() => void kirim()}>
          {sibuk ? t.umum.menyimpan : t.umum.simpan}
        </Tombol>
      </div>
    </div>
  );
}

export function Bagian({ judul, keterangan, children }: { judul: string; keterangan?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <h3 className="t-kepala">{judul}</h3>
      {keterangan ? <p className="t-keterangan mb-1 text-label-2">{keterangan}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Pilihan tunggal berbentuk pil yang boleh turun baris (pilihan panjang di layar HP). */
export function PilihanPil<T extends string>({ label, nilai, ubah, pilihan }: { label: string; nilai: T; ubah: (v: T) => void; pilihan: Array<{ nilai: T; label: string }> }) {
  return (
    <div role="radiogroup" onKeyDown={gerakRadio} aria-label={label} className="flex flex-wrap gap-1.5">
      {pilihan.map((p) => (
        <button
          key={p.nilai}
          type="button"
          role="radio"
          aria-checked={nilai === p.nilai}
          onClick={() => ubah(p.nilai)}
          className={cn(
            "tekan h-10 rounded-full px-4 text-[15px] font-semibold",
            nilai === p.nilai ? "kaca-kuat text-label ring-2 ring-toska-isi" : "bg-kaca-isi text-label-2 hover:text-label",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function Baris({ label, keterangan, children }: { label: string; keterangan?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 py-1.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        {keterangan ? <span className="t-keterangan block text-label-2">{keterangan}</span> : null}
      </span>
      {children}
    </div>
  );
}

function TombolAksi({
  ikon: Ikon,
  label,
  keterangan,
  onClick,
  sibuk,
  bahaya,
  nonaktif,
}: {
  ikon: typeof Trash2;
  label: string;
  keterangan?: string;
  onClick: () => void;
  sibuk?: boolean;
  bahaya?: boolean;
  nonaktif?: boolean;
}) {
  const { t } = useKamus();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={sibuk || nonaktif}
      className={cn("tekan flex min-h-12 items-center gap-3 rounded-[14px] px-2 text-left disabled:opacity-50", bahaya ? "text-bahaya" : "text-label")}
    >
      <Ikon size={19} strokeWidth={1.9} className={bahaya ? undefined : "text-label-2"} />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{sibuk ? t.umum.memuat : label}</span>
        {keterangan ? <span className="t-keterangan block text-label-2">{keterangan}</span> : null}
      </span>
    </button>
  );
}

/** Uji alarm: berbunyi 1 menit lagi; spam chat dan rumah pintar ikut bila dicentang (PRD B9). */
function PanelUji({ aksi, adaSpam, adaTuya }: { aksi: AksiAlarm; adaSpam: boolean; adaTuya: boolean }) {
  const { t } = useKamus();
  const U = t.ubah;
  const [buka, setBuka] = useState(false);
  const [spam, setSpam] = useState(false);
  const [tuya, setTuya] = useState(false);
  if (!buka) return <TombolAksi ikon={AlarmClock} label={U.aksi.uji} keterangan={U.aksi.ujiKet} onClick={() => setBuka(true)} />;
  return (
    <div className="flex flex-col gap-1 rounded-[16px] bg-kaca-isi px-3.5 py-3">
      <p className="text-[16px] font-semibold">{U.aksi.uji}</p>
      <p className="t-keterangan text-label-2">{U.aksi.ujiKet}</p>
      {adaSpam ? (
        <Baris label={U.aksi.ujiSpam}>
          <Saklar nyala={spam} label={U.aksi.ujiSpam} ubah={setSpam} />
        </Baris>
      ) : null}
      {adaTuya ? (
        <Baris label={U.aksi.ujiTuya}>
          <Saklar nyala={tuya} label={U.aksi.ujiTuya} ubah={setTuya} />
        </Baris>
      ) : null}
      <div className="mt-1 flex gap-2">
        <Tombol varian="kaca" ukuran="sedang" onClick={() => setBuka(false)}>
          {t.umum.batal}
        </Tombol>
        <Tombol ukuran="sedang" disabled={aksi.sibuk === "uji"} onClick={() => aksi.uji({ spam, tuya })}>
          {aksi.sibuk === "uji" ? t.umum.memuat : U.aksi.ujiMulai}
        </Tombol>
      </div>
    </div>
  );
}

/** Kartu karakter + tombol dengar (suara bawaan perangkat membacakan contoh kalimatnya). */
export function PilihKarakter({ nilai, ubah, nama }: { nilai: FormAlarm["karakter"]; ubah: (k: FormAlarm["karakter"]) => void; nama: string }) {
  const { t, b } = useKamus();
  const U = t.ubah;
  const { diputar, dengar: putar } = useDengarContoh(b);
  const dengar = (id: FormAlarm["karakter"]) => putar(id, isi(t.karakter[id].contoh, { nama }));
  return (
    <div role="radiogroup" onKeyDown={gerakRadio} aria-label={U.karakter} className="tanpa-gulir -mx-6 flex snap-x gap-2.5 overflow-x-auto px-6 pb-1">
      {DAFTAR_KARAKTER.map((id) => {
        const K = t.karakter[id];
        const dipilih = nilai === id;
        return (
          <div key={id} className={cn("relative w-[168px] shrink-0 snap-start rounded-[20px] p-3.5", dipilih ? "bg-kaca-kuat ring-2 ring-toska-isi" : "bg-kaca-isi")}>
            <button type="button" role="radio" aria-checked={dipilih} onClick={() => ubah(id)} className="absolute inset-0 rounded-[20px]" aria-label={K.nama} />
            <span aria-hidden className="block size-8 rounded-[10px]" style={{ background: WARNA_KARAKTER[id] }} />
            <span className="mt-2.5 block text-[15px] font-semibold">{K.nama}</span>
            <span className="t-keterangan block text-label-2">{K.rasa}</span>
            {id !== "kustom" ? (
              <button
                type="button"
                onClick={() => dengar(id)}
                aria-label={isi(U.dengar, { nama: K.nama })}
                className="tekan relative mt-2.5 grid size-9 place-items-center rounded-full bg-grafit text-grafit-label"
              >
                {diputar === id ? <Square size={13} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
              </button>
            ) : (
              <span className="mt-2.5 block h-9" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function KalimatPribadi({ nilai, ubah, nama }: { nilai: string[]; ubah: (k: string[]) => void; nama: string }) {
  const { t } = useKamus();
  const U = t.ubah;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-[15px] font-semibold">{U.kalimat}</p>
      <p className="t-keterangan -mt-1 text-label-2">{U.kalimatKet}</p>
      {nilai.map((k, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={k}
            maxLength={150}
            onChange={(e) => ubah(nilai.map((x, j) => (j === i ? e.target.value : x)))}
            aria-label={isi(U.kalimatKe, { n: i + 1 })}
            placeholder={isi(U.kalimatContoh, { nama })}
            className="h-11 min-w-0 flex-1 rounded-[12px] bg-kaca-isi px-3.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-aksen-isi"
          />
          <button
            type="button"
            onClick={() => ubah(nilai.filter((_, j) => j !== i))}
            aria-label={isi(U.kalimatHapus, { n: i + 1 })}
            className="tekan grid size-11 place-items-center rounded-full text-label-2"
          >
            <X size={18} />
          </button>
        </div>
      ))}
      {nilai.length < 10 ? (
        <button type="button" onClick={() => ubah([...nilai, ""])} className="tekan flex h-10 items-center gap-1.5 self-start text-[15px] font-semibold text-aksen">
          <Plus size={17} strokeWidth={2.4} />
          {U.kalimatTambah}
        </button>
      ) : null}
    </div>
  );
}

function PilihKanal({ dipilih, ubah, data }: { dipilih: string[]; ubah: (k: string[]) => void; data: DataKanal }) {
  const { t } = useKamus();
  if (data.status === "memuat") return <p className="t-keterangan text-label-2">{t.umum.memuat}</p>;
  if (data.status === "izin")
    return (
      <div className="flex flex-col gap-2 rounded-[16px] bg-kaca-isi px-3.5 py-3">
        <p className="text-[15px]">{data.pesan}</p>
        <TautanTombol href="/auth/agentbuff/start?izin=1&lanjut=/app" ukuran="sedang" className="self-start">
          {t.pengaturan.beriIzin}
        </TautanTombol>
      </div>
    );
  if (data.status === "galat") return <p className="t-keterangan text-waspada">{data.pesan}</p>;
  if (!data.kanal.length) return <p className="t-keterangan text-label-2">{t.ubah.kanalKosong}</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {data.kanal.map((k) => {
        const nyala = dipilih.includes(k.id);
        return (
          <li key={k.id} className={cn("flex items-center gap-3 rounded-[16px] bg-kaca-isi px-3.5 py-2.5", !k.siap && "opacity-60")}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{k.label}</span>
              {k.alasan ? <span className="t-keterangan block text-label-2">{k.alasan}</span> : null}
            </span>
            <Saklar nyala={nyala && k.siap} nonaktif={!k.siap} label={k.label} ubah={(n) => ubah(n ? [...dipilih, k.id] : dipilih.filter((x) => x !== k.id))} />
          </li>
        );
      })}
    </ul>
  );
}

export function PilihKodeQr({
  dipilih,
  ubah,
  data,
  buat,
}: {
  dipilih: string[];
  ubah: (k: string[]) => void;
  data: DataKodeQr;
  buat?: (nama: string) => Promise<{ id: string; nama: string } | null>;
}) {
  const { t } = useKamus();
  const U = t.ubah;
  const [nama, setNama] = useState("");
  const [membuat, setMembuat] = useState(false);
  const [baru, setBaru] = useState<Array<{ id: string; nama: string }>>([]);
  if (data.status === "memuat") return <p className="t-keterangan mt-2 text-label-2">{t.umum.memuat}</p>;
  const semua = [...data.kode, ...baru.filter((x) => !data.kode.some((k) => k.id === x.id))];
  const tambah = async () => {
    if (!buat || !nama.trim()) return;
    setMembuat(true);
    const k = await buat(nama.trim());
    setMembuat(false);
    if (k) {
      setBaru((b) => [...b, k]);
      setNama("");
      ubah([...dipilih, k.id]);
    }
  };
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-[15px] font-semibold">{U.kodeQr}</p>
      {semua.length ? (
        <ul className="flex flex-col gap-1.5">
          {semua.map((k) => (
            <li key={k.id} className="flex items-center gap-3 rounded-[16px] bg-kaca-isi px-3.5 py-2">
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{k.nama}</span>
              <a
                href={`/app/kode-qr/${k.id}/cetak`}
                target="_blank"
                rel="noopener"
                aria-label={isi(U.kodeQrCetak, { nama: k.nama })}
                className="tekan grid size-10 place-items-center rounded-full text-label-2"
              >
                <Printer size={18} />
              </a>
              <Saklar nyala={dipilih.includes(k.id)} label={k.nama} ubah={(n) => ubah(n ? [...dipilih, k.id].slice(0, 5) : dipilih.filter((x) => x !== k.id))} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="t-keterangan text-label-2">{U.kodeQrKosong}</p>
      )}
      {buat ? (
        <div className="flex items-center gap-2">
          <input
            value={nama}
            maxLength={40}
            onChange={(e) => setNama(e.target.value)}
            placeholder={U.kodeQrNama}
            aria-label={U.kodeQrNama}
            className="h-11 min-w-0 flex-1 rounded-[12px] bg-kaca-isi px-3.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-aksen-isi"
          />
          <Tombol varian="kaca" ukuran="sedang" disabled={membuat || !nama.trim()} onClick={() => void tambah()}>
            {membuat ? t.umum.memuat : U.kodeQrBuat}
          </Tombol>
        </div>
      ) : null}
    </div>
  );
}

export function PilihBunyi({ nilai, ubah }: { nilai: FormAlarm["bunyi"]; ubah: (b: FormAlarm["bunyi"]) => void }) {
  const { t } = useKamus();
  const U = t.ubah;
  const henti = useRef<(() => void) | null>(null);
  const [main, setMain] = useState(false);
  useEffect(() => () => henti.current?.(), []);
  const dengar = async () => {
    henti.current?.();
    if (main) {
      setMain(false);
      return;
    }
    setMain(true);
    const b = berkasBunyi(nilai);
    henti.current = await pratinjauBunyi(b.url, b.naikDtk !== null);
    setTimeout(() => setMain(false), 5_000);
  };
  return (
    <div className="flex min-h-[52px] items-center gap-3 py-1.5">
      <label className="min-w-0 flex-1 text-[15px]" htmlFor="pilih-bunyi">
        {U.bunyi}
      </label>
      <select
        id="pilih-bunyi"
        value={nilai}
        onChange={(e) => {
          henti.current?.();
          setMain(false);
          ubah(e.target.value as FormAlarm["bunyi"]);
        }}
        className="h-11 rounded-[12px] bg-kaca-isi px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-aksen-isi"
      >
        {DAFTAR_BUNYI.map((x) => (
          <option key={x} value={x}>
            {t.daftarBunyi[x]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void dengar()}
        aria-label={isi(U.dengarBunyi, { bunyi: t.daftarBunyi[nilai] })}
        className="tekan grid size-10 place-items-center rounded-full bg-grafit text-grafit-label"
      >
        {main ? <Square size={13} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
      </button>
    </div>
  );
}

export function PilihSuara({
  nilai,
  ubah,
  data,
  dengar,
}: {
  nilai: string | null;
  ubah: (s: string | null) => void;
  data: DataSuara;
  dengar?: (s: string | null) => Promise<void>;
}) {
  const { t } = useKamus();
  const U = t.ubah;
  const [mendengar, setMendengar] = useState(false);
  if (data.status === "galat") return <p className="t-keterangan py-1.5 text-label-2">{data.pesan}</p>;
  return (
    <div className="flex min-h-[52px] items-center gap-3 py-1.5">
      <label className="min-w-0 flex-1 text-[15px]" htmlFor="pilih-suara">
        {U.suara}
      </label>
      <select
        id="pilih-suara"
        value={nilai ?? ""}
        disabled={data.status === "memuat"}
        onChange={(e) => ubah(e.target.value || null)}
        className="h-11 max-w-[180px] rounded-[12px] bg-kaca-isi px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-aksen-isi"
      >
        <option value="">{U.suaraBawaan}</option>
        {data.status === "ada"
          ? data.suara.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))
          : null}
      </select>
      {dengar ? (
        <button
          type="button"
          disabled={mendengar}
          onClick={async () => {
            setMendengar(true);
            await dengar(nilai);
            setMendengar(false);
          }}
          aria-label={U.dengarSuara}
          className="tekan grid size-10 place-items-center rounded-full bg-grafit text-grafit-label disabled:opacity-50"
        >
          <Play size={15} fill="currentColor" />
        </button>
      ) : null}
    </div>
  );
}
