"use client";

import { ChevronDown, ChevronRight, Lamp, Play } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Cip, Penghitung, Saklar, Segmen, Tombol } from "@/components/ui/dasar";
import { Lembar } from "@/components/ui/lembar";
import { RodaJam } from "@/components/ui/roda-jam";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { DAFTAR_KARAKTER, WARNA_KARAKTER, type IdBunyi, type IdKarakter, type KanalTampil, type StatusSuara } from "@/lib/tampilan/jenis";

export type IsiUbahAlarm = {
  jam: number;
  menit: number;
  judul: string;
  detail: string;
  hari: number[];
  karakter: IdKarakter;
  soal: "hitungan" | "ingat" | "ketik" | "qr";
  tingkat: "ringan" | "sedang" | "berat";
  benarBeruntun: number;
  tundaJatah: number;
  tundaMenit: 5 | 10 | 15;
  kanal: string[];
  komitmen: boolean;
  masihBangun: boolean;
  libur: boolean;
  bunyi: IdBunyi;
};

/**
 * Ubah alarm (docs/04-DESAIN.md §4.2): lembar dari bawah di HP, dialog di laptop. Urutan dari atas:
 * roda jam, agenda, ulangi, karakter suara, soal, tunda, spam chat, rumah pintar, lanjutan (dilipat).
 */
export function LembarUbahAlarm({
  buka,
  ubahBuka,
  awal,
  baru,
  kanal,
  tuyaTersambung,
  suara,
  simpan,
  menyimpan,
}: {
  buka: boolean;
  ubahBuka: (v: boolean) => void;
  awal: IsiUbahAlarm;
  baru: boolean;
  kanal: KanalTampil[];
  tuyaTersambung: boolean;
  suara: StatusSuara;
  simpan: (v: IsiUbahAlarm) => void;
  menyimpan?: boolean;
}) {
  const { t } = useKamus();
  const U = t.ubah;
  const [v, setV] = useState(awal);
  const atur = (ubah: Partial<IsiUbahAlarm>) => setV((lama) => ({ ...lama, ...ubah }));
  const [lanjutan, setLanjutan] = useState(false);

  return (
    <Lembar
      buka={buka}
      ubahBuka={ubahBuka}
      judul={baru ? U.judulBaru : U.judulUbah}
      lebar={560}
      kaki={
        <Tombol ukuran="besar" className="w-full" disabled={menyimpan || !v.judul.trim()} onClick={() => simpan(v)}>
          {menyimpan ? t.umum.menyimpan : U.simpan}
        </Tombol>
      }
    >
      <div className="flex flex-col gap-7">
        <RodaJam jam={v.jam} menit={v.menit} ubah={(j) => atur(j)} labelJam={U.jam} labelMenit={U.menit} />

        <Bagian judul={U.agenda}>
          <input
            value={v.judul}
            maxLength={60}
            onChange={(e) => atur({ judul: e.target.value })}
            placeholder={U.agendaJudul}
            aria-label={U.agendaJudul}
            className="h-12 w-full rounded-[14px] bg-kaca-isi px-4 text-[17px] outline-none placeholder:text-label-2 focus-visible:ring-2 focus-visible:ring-aksen-isi"
          />
          <textarea
            value={v.detail}
            maxLength={200}
            rows={2}
            onChange={(e) => atur({ detail: e.target.value })}
            placeholder={U.agendaDetail}
            aria-label={U.agendaDetail}
            className="mt-2 w-full resize-none rounded-[14px] bg-kaca-isi px-4 py-3 text-[15px] outline-none placeholder:text-label-2 focus-visible:ring-2 focus-visible:ring-aksen-isi"
          />
        </Bagian>

        <Bagian judul={U.ulangi}>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((h) => (
              <Cip key={h} nyala={v.hari.includes(h)} label={t.hari.panjang[h]} ubah={(n) => atur({ hari: n ? [...v.hari, h] : v.hari.filter((x) => x !== h) })}>
                {t.hari.pendek[h]}
              </Cip>
            ))}
          </div>
          <button type="button" className="tekan mt-2 flex h-10 items-center gap-1 text-[15px] font-semibold text-aksen">
            {t.ulang.lanjutan}
            <ChevronRight size={16} />
          </button>
        </Bagian>

        <Bagian judul={U.karakter}>
          <div role="radiogroup" aria-label={U.karakter} className="tanpa-gulir -mx-6 flex snap-x gap-2.5 overflow-x-auto px-6 pb-1">
            {DAFTAR_KARAKTER.map((id) => {
              const K = t.karakter[id];
              const dipilih = v.karakter === id;
              return (
                <div key={id} className={cn("relative w-[168px] shrink-0 snap-start rounded-[20px] p-3.5", dipilih ? "bg-kaca-kuat ring-2 ring-toska-isi" : "bg-kaca-isi")}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={dipilih}
                    onClick={() => atur({ karakter: id })}
                    className="absolute inset-0 rounded-[20px]"
                    aria-label={K.nama}
                  />
                  <span aria-hidden className="block size-8 rounded-[10px]" style={{ background: WARNA_KARAKTER[id] }} />
                  <span className="mt-2.5 block text-[15px] font-semibold">{K.nama}</span>
                  <span className="t-keterangan block text-label-2">{K.rasa}</span>
                  <button
                    type="button"
                    aria-label={isi(U.dengar, { nama: K.nama })}
                    className="tekan relative mt-2.5 grid size-9 place-items-center rounded-full bg-grafit text-grafit-label"
                  >
                    <Play size={15} fill="currentColor" />
                  </button>
                </div>
              );
            })}
          </div>
          <p className={cn("t-keterangan mt-2", suara.status === "belum" ? "text-waspada" : suara.status === "siap" ? "text-toska" : "text-label-2")}>
            {suara.status === "siap" ? t.beranda.suaraSiap : suara.status === "dibuat" ? isi(t.beranda.suaraDibuat, { n: suara.n, total: suara.total }) : t.beranda.suaraBelum}
          </p>
        </Bagian>

        <Bagian judul={U.soal}>
          <Segmen
            label={U.soal}
            nilai={v.soal}
            ubah={(s) => atur({ soal: s })}
            pilihan={(["hitungan", "ingat", "ketik", "qr"] as const).map((s) => ({ nilai: s, label: U.soalJenis[s] }))}
          />
          <div className="mt-2">
            <Segmen
              label={U.soal}
              nilai={v.tingkat}
              ubah={(s) => atur({ tingkat: s })}
              pilihan={(["ringan", "sedang", "berat"] as const).map((s) => ({ nilai: s, label: U.tingkat[s] }))}
            />
          </div>
          <Baris label={U.benarBeruntun}>
            <Penghitung
              nilai={v.benarBeruntun}
              min={1}
              maks={5}
              ubah={(n) => atur({ benarBeruntun: n })}
              label={U.benarBeruntun}
              labelKurang={t.umum.kurangi}
              labelTambah={t.umum.tambah}
            />
          </Baris>
        </Bagian>

        <Bagian judul={U.tunda}>
          <Baris label={U.tundaJatah}>
            <Penghitung nilai={v.tundaJatah} min={0} maks={5} ubah={(n) => atur({ tundaJatah: n })} label={U.tundaJatah} labelKurang={t.umum.kurangi} labelTambah={t.umum.tambah} />
          </Baris>
          <div className="mt-2">
            <Segmen
              label={U.tunda}
              nilai={String(v.tundaMenit)}
              ubah={(s) => atur({ tundaMenit: Number(s) as 5 | 10 | 15 })}
              pilihan={["5", "10", "15"].map((m) => ({ nilai: m, label: isi(U.tundaMenit, { n: m }) }))}
            />
          </div>
        </Bagian>

        <Bagian judul={U.spam} keterangan={U.spamKet}>
          <ul className="flex flex-col gap-1.5">
            {kanal.map((k) => {
              const nyala = v.kanal.includes(k.id);
              return (
                <li key={k.id} className={cn("flex items-center gap-3 rounded-[16px] bg-kaca-isi px-3.5 py-2.5", !k.siap && "opacity-60")}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{k.label}</span>
                    {k.alasan ? <span className="t-keterangan block text-label-2">{k.alasan}</span> : null}
                  </span>
                  <Saklar nyala={nyala && k.siap} nonaktif={!k.siap} label={k.label} ubah={(n) => atur({ kanal: n ? [...v.kanal, k.id] : v.kanal.filter((x) => x !== k.id) })} />
                </li>
              );
            })}
          </ul>
        </Bagian>

        <Bagian judul={U.rumah}>
          {tuyaTersambung ? null : (
            <button type="button" className="tekan flex h-12 w-full items-center gap-3 rounded-[16px] bg-kaca-isi px-3.5 text-left text-[15px] font-semibold">
              <Lamp size={18} strokeWidth={1.75} className="text-label-2" />
              <span className="flex-1">{U.rumahSambung}</span>
              <ChevronRight size={18} className="text-label-3" />
            </button>
          )}
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
              <Baris label={U.masihBangun} keterangan={isi(U.masihBangunKet, { n: 5 })}>
                <Saklar nyala={v.masihBangun} label={U.masihBangun} ubah={(n) => atur({ masihBangun: n })} />
              </Baris>
              <Baris label={U.libur}>
                <Saklar nyala={v.libur} label={U.libur} ubah={(n) => atur({ libur: n })} />
              </Baris>
              <Baris label={U.bunyi}>
                <span className="text-[15px] text-label-2">{t.daftarBunyi[v.bunyi]}</span>
              </Baris>
            </div>
          ) : null}
        </div>
      </div>
    </Lembar>
  );
}

function Bagian({ judul, keterangan, children }: { judul: string; keterangan?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <h3 className="t-kepala">{judul}</h3>
      {keterangan ? <p className="t-keterangan mb-1 text-label-2">{keterangan}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Baris({ label, keterangan, children }: { label: string; keterangan?: string; children: ReactNode }) {
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
