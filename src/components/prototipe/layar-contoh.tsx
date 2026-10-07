"use client";

import { useState } from "react";
import { Shell, type IdTab } from "@/components/app/shell";
import { LayarBeranda } from "@/components/layar/beranda";
import { LayarBerbunyiBersuara } from "@/components/layar/berbunyi-suara";
import { LayarJamMejaSebelum, LayarJamMejaSiaga } from "@/components/layar/jam-meja";
import { LayarMasihBangun, LayarSelamatPagi } from "@/components/layar/pagi-cek";
import { JendelaPc, LayarOrientasi, LayarPengaturan } from "@/components/layar/pengaturan-orientasi";
import { LayarRiwayat } from "@/components/layar/riwayat";
import { LayarSiaga, LayarUnduhPc } from "@/components/layar/siaga";
import { LembarUbahAlarm } from "@/components/layar/ubah-alarm";
import { berkasBunyi } from "@/lib/bunyi/berkas";
import { useKamus } from "@/lib/i18n/klien";
import * as C from "@/lib/prototipe/contoh";
import type { IdLayar } from "@/lib/prototipe/layar";

const HREF: Record<IdTab, string> = { alarm: "/prototipe/beranda", siaga: "/prototipe/siaga", riwayat: "/prototipe/riwayat", pengaturan: "/prototipe/pengaturan" };
const SEMUA_TAB: IdTab[] = ["alarm", "siaga", "riwayat", "pengaturan"];

/** Satu layar prototipe dengan data contoh (P1). Interaksi lokal saja, tidak ada yang tersimpan. */
export function LayarContoh({ id, cari = {} }: { id: IdLayar; cari?: { berlalu?: number; klip?: boolean } }) {
  const { t, b: bahasa } = useKamus();
  // Saat alarm mulai berbunyi: `?berlalu=185` = layar dibuka 185 detik sesudah berbunyi.
  const [mulaiMs] = useState(() => Date.now() - (cari.berlalu ?? 0) * 1000);
  const [ubahBuka, setUbahBuka] = useState(id === "ubah");
  const [benar, setBenar] = useState(0);
  const sapaan = `${t.waktu.malam}, ${C.NAMA}`;
  const dalamShell = (tab: IdTab, isiLayar: React.ReactNode) => (
    <Shell tab={SEMUA_TAB} href={HREF} aktif={tab} tambahHref="/prototipe/ubah">
      {isiLayar}
    </Shell>
  );

  switch (id) {
    case "beranda":
    case "berandaKosong":
    case "ubah":
      return dalamShell(
        "alarm",
        <>
          <LayarBeranda
            sapaan={sapaan}
            berikutnya={id === "berandaKosong" ? null : C.ALARM_BERIKUTNYA}
            sisa={id === "berandaKosong" ? null : C.SISA_KE_BERIKUTNYA}
            lainnya={id === "berandaKosong" ? [] : C.ALARM_LAIN}
            perangkat={C.PERANGKAT}
            hrefTambah="/prototipe/ubah"
            hrefSiaga="/prototipe/siaga"
          />
          <LembarUbahAlarm
            buka={ubahBuka}
            ubahBuka={setUbahBuka}
            baru
            kanal={C.KANAL}
            tuyaTersambung={false}
            suara={{ status: "dibuat", n: 7, total: 12 }}
            simpan={() => setUbahBuka(false)}
            awal={{
              jam: 5,
              menit: 0,
              judul: C.ALARM_BERIKUTNYA.judul,
              detail: C.ALARM_BERIKUTNYA.detail ?? "",
              hari: [1, 2, 3, 4, 5],
              karakter: "pelatih_tentara",
              soal: "hitungan",
              tingkat: "sedang",
              benarBeruntun: 2,
              tundaJatah: 2,
              tundaMenit: 5,
              kanal: ["k1", "k3"],
              komitmen: true,
              masihBangun: true,
              libur: false,
              bunyi: "sirene",
            }}
          />
        </>,
      );
    case "bunyiHitungan":
    case "bunyiQr":
      return (
        <LayarBerbunyiBersuara
          suara={{
            bunyi: berkasBunyi("klasik"),
            omelan: cari.klip ? C.OMELAN_PUTAR : C.OMELAN_PUTAR.map((o) => ({ ...o, klip: null })),
            benih: 2026,
            mulaiMs,
            bahasa,
          }}
          catat={(p) => {
            const w = window as unknown as { __pemutar?: unknown[] };
            (w.__pemutar ??= []).push(p);
          }}
          jam={C.ALARM_BERIKUTNYA.jam}
          judul={C.ALARM_BERIKUTNYA.judul}
          detail={C.ALARM_BERIKUTNYA.detail}
          soal={id === "bunyiQr" ? { jenis: "qr", tempat: C.TEMPAT_QR } : { jenis: "hitungan", teks: C.SOAL_CONTOH.teks }}
          perluBenar={2}
          benarBeruntun={benar}
          tunda={{ sisa: 2, menit: 5 }}
          omelan={C.OMELAN_CONTOH}
          urutan={{ ke: 1, dari: 2 }}
          periksa={async (j) => {
            if (j !== C.SOAL_CONTOH.jawaban) {
              setBenar(0);
              return "salah";
            }
            setBenar((b) => Math.min(2, b + 1));
            return "benar";
          }}
        />
      );
    case "pagi":
      return (
        <LayarSelamatPagi
          nama={C.NAMA}
          jamBangun={C.PAGI.jamBangun}
          agenda={{ judul: C.ALARM_BERIKUTNYA.judul, detail: C.ALARM_BERIKUTNYA.detail }}
          skor={C.PAGI.skor}
          tunda={C.PAGI.tunda}
          menit={C.PAGI.menit}
          cekMenit={C.PAGI.cekMenit}
        />
      );
    case "cek":
      return <LayarMasihBangun sisaDetik={42} totalDetik={60} />;
    case "jamMejaSebelum":
      return <LayarJamMejaSebelum />;
    case "jamMejaSiaga":
      return <LayarJamMejaSiaga jam="23.48" alarm={C.ALARM_BERIKUTNYA.jam} dicas daring />;
    case "siaga":
      return dalamShell("siaga", <LayarSiaga perangkat={C.PERANGKAT} hrefUnduh="/prototipe/unduh" hrefJamMeja="/prototipe/jamMejaSebelum" />);
    case "unduh":
      return dalamShell("siaga", <LayarUnduhPc hrefUnduh="#" ukuranMb={C.PC.ukuranMb} sha256={C.PC.sha256} />);
    case "riwayat": {
      const label = C.SKOR_30.map((_, i) => {
        const d = new Date(Date.UTC(2026, 9, 7 - (C.SKOR_30.length - 1 - i)));
        return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
      });
      return dalamShell("riwayat", <LayarRiwayat skorHariIni={C.PAGI.skor} beruntun={4} rataMenit={6} totalTunda={9} skor30={C.SKOR_30} labelHari={label} kejadian={C.RIWAYAT} />);
    }
    case "pengaturan":
      return dalamShell(
        "pengaturan",
        <LayarPengaturan
          nama={C.NAMA}
          zona="WIB"
          bahasa="Indonesia"
          jamTidur="22.00"
          tema="sistem"
          karakter="pelatih_tentara"
          jumlahKanal={2}
          tuya={false}
          jumlahQr={1}
          jumlahToken={1}
          href={() => "#"}
        />,
      );
    case "orientasi":
      return <LayarOrientasi nama={C.NAMA} />;
    case "pc":
      return (
        <main className="grid min-h-dvh place-items-center px-4 py-10">
          <JendelaPc akun={C.NAMA} versi={C.PC.versi} tersambung />
        </main>
      );
  }
}
