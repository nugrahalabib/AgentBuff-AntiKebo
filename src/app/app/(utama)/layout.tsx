import { PengawasAlarm } from "@/components/app/pengawas-alarm";
import { Shell } from "@/components/app/shell";

/** Halaman aplikasi biasa: kerangka + pengawas yang membuka layar alarm saat ada yang berbunyi. */
export default function TataLetakUtama({ children }: { children: React.ReactNode }) {
  return (
    <Shell tambahHref="/app?alarm=baru">
      <PengawasAlarm />
      {children}
    </Shell>
  );
}
