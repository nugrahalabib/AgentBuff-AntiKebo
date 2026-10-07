import { GerbangHak } from "@/components/app/gerbang-hak";
import { PengawasAlarm } from "@/components/app/pengawas-alarm";
import { Shell } from "@/components/app/shell";

/** Halaman aplikasi biasa: gerbang hak, kerangka, dan pengawas yang membuka layar alarm saat ada yang berbunyi. */
export default function TataLetakUtama({ children }: { children: React.ReactNode }) {
  return (
    <GerbangHak>
      <Shell tab={["alarm", "siaga", "riwayat", "pengaturan"]} tambahHref="/app?alarm=baru">
        <PengawasAlarm />
        {children}
      </Shell>
    </GerbangHak>
  );
}
