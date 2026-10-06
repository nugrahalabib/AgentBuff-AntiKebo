"use client";

import { KeyRound, LifeBuoy, LogOut, ShieldCheck, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Segmen, TautanTombol, Tombol } from "@/components/ui/dasar";
import { Lembar } from "@/components/ui/lembar";
import { tampilToast } from "@/components/ui/toast";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { api, type GalatApi } from "@/lib/app/toko";
import type { DataSambungan } from "@/lib/app/data";

type Props = { email: string | null; nama: string | null; tema: string; locale: string; zona: string; sambungan: DataSambungan; bantuan: string };

function Grup({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="t-kapsi mb-2 px-1 text-label-2 uppercase">{judul}</h2>
      <div className="kaca flex flex-col divide-y divide-pemisah overflow-hidden rounded-[24px]">{children}</div>
    </section>
  );
}

function Baris({ label, children, ket }: { label: string; children?: ReactNode; ket?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {ket ? <span className="t-keterangan block text-label-2">{ket}</span> : null}
      </span>
      {children}
    </div>
  );
}

export function HalamanPengaturan(p: Props) {
  const { t } = useKamus();
  const P = t.pengaturan;
  const router = useRouter();
  const [tema, setTema] = useState(p.tema);
  const [bahasa, setBahasa] = useState(p.locale);
  const [zona, setZona] = useState(p.zona);
  const [putus, setPutus] = useState(false);

  const simpan = async (isiUbah: Record<string, string>) => {
    try {
      await api("/api/app/pengaturan", { method: "PATCH", json: isiUbah });
      if (isiUbah.tema) document.documentElement.setAttribute("data-tema", isiUbah.tema);
      router.refresh();
    } catch (e) {
      tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
    }
  };

  return (
    <div className="mx-auto max-w-[680px]">
      <h1 className="t-judul-besar muncul pr-14">{P.judul}</h1>

      <Grup judul={P.akun}>
        <Baris label={p.nama ?? p.email ?? "-"} ket={p.email ? isi(P.masukSebagai, { email: p.email }) : undefined}>
          <Tombol
            varian="kaca"
            ukuran="kecil"
            onClick={async () => {
              await fetch("/api/keluar", { method: "POST" }).catch(() => {});
              router.replace("/");
              router.refresh();
            }}
          >
            <LogOut size={15} />
            {P.keluarSemua}
          </Tombol>
        </Baris>
      </Grup>

      <Grup judul={P.rumah}>
        {p.sambungan ? (
          <>
            <Baris label={P.kunci} ket={isi(P.tersambungSejak, { tanggal: new Date(p.sambungan.tersambungPada).toLocaleDateString(bahasa === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "long", year: "numeric" }) })}>
              <code className="rounded-[10px] bg-kaca-isi px-2.5 py-1 text-[13px]">{p.sambungan.kunciSamar}</code>
            </Baris>
            <Baris label={P.server}>
              <span className="text-[15px] text-label-2">{p.sambungan.wilayah}</span>
            </Baris>
            <div className="flex flex-wrap gap-2 px-4 py-3.5">
              <TautanTombol href="/app/sambungkan" varian="kaca" ukuran="kecil">
                <KeyRound size={15} />
                {P.perbaruiKunci}
              </TautanTombol>
              <Tombol varian="bahaya" ukuran="kecil" onClick={() => setPutus(true)}>
                <Unplug size={15} />
                {P.putuskan}
              </Tombol>
            </div>
          </>
        ) : (
          <div className="px-4 py-3.5">
            <TautanTombol href="/app/sambungkan" ukuran="kecil">
              {t.sambungkan.judul}
            </TautanTombol>
          </div>
        )}
      </Grup>

      <Grup judul={P.tampilan}>
        <div className="px-4 py-3.5">
          <p className="mb-2 text-[15px] font-medium">{P.tema}</p>
          <Segmen
            label={P.tema}
            nilai={tema}
            ubah={(v) => {
              setTema(v);
              void simpan({ tema: v });
            }}
            pilihan={[
              { nilai: "sistem", label: P.temaPilihan.sistem },
              { nilai: "terang", label: P.temaPilihan.terang },
              { nilai: "gelap", label: P.temaPilihan.gelap },
            ]}
          />
        </div>
        <div className="px-4 py-3.5">
          <p className="mb-2 text-[15px] font-medium">{P.bahasa}</p>
          <Segmen
            label={P.bahasa}
            nilai={bahasa}
            ubah={(v) => {
              setBahasa(v);
              void simpan({ locale: v });
            }}
            pilihan={[
              { nilai: "id", label: "Indonesia" },
              { nilai: "en", label: "English" },
            ]}
          />
        </div>
        <Baris label={P.zona}>
          <select
            value={zona}
            onChange={(e) => {
              setZona(e.target.value);
              void simpan({ zonaWaktu: e.target.value });
            }}
            aria-label={P.zona}
            className="h-10 rounded-[12px] bg-kaca-isi px-3 text-[15px]"
          >
            {Object.entries(P.zonaPilihan).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Baris>
      </Grup>

      <Grup judul={P.privasi}>
        <div className="flex gap-3 px-4 py-4">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-berhasil" />
          <p className="t-subjudul text-label-2">{P.privasiIsi}</p>
        </div>
      </Grup>

      <Grup judul={P.bantuan}>
        <Baris label={P.bantuanIsi}>
          <TautanTombol href={p.bantuan} varian="kaca" ukuran="kecil">
            <LifeBuoy size={15} />
            {P.bantuan}
          </TautanTombol>
        </Baris>
      </Grup>

      <p className="t-keterangan mt-8 text-center text-label-3">{t.merek.bukanAfiliasi}</p>

      <Lembar
        buka={putus}
        ubahBuka={setPutus}
        judul={P.putuskan}
        lebar={440}
        kaki={
          <div className="flex gap-2">
            <Tombol varian="kaca" className="flex-1" onClick={() => setPutus(false)}>
              {t.umum.batal}
            </Tombol>
            <Tombol
              className="flex-1 bg-bahaya-isi shadow-none"
              onClick={async () => {
                try {
                  await api("/api/app/sambungan", { method: "DELETE" });
                  router.push("/app/sambungkan");
                } catch (e) {
                  tampilToast((e as GalatApi).pesan ?? t.umum.galatUmum, "galat");
                }
              }}
            >
              {P.putuskan}
            </Tombol>
          </div>
        }
      >
        <p className="t-subjudul text-label-2">{P.putuskanTanya}</p>
      </Lembar>
    </div>
  );
}
