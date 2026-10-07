import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PembaruWaktu } from "@/components/pembaru-waktu";
import { WadahToast } from "@/components/ui/toast";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { PenyediaKamus } from "@/lib/i18n/klien";
import { bahasaSaatIni } from "@/lib/i18n/server";
import { kamusUntuk } from "@/lib/i18n/kamus-server";
import { waktuHari } from "@/lib/waktu/suasana-hari";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const t = kamusUntuk(await bahasaSaatIni());
  return {
    title: { default: t.merek.namaPanjang, template: `%s · ${t.merek.nama}` },
    description: t.merek.janji,
    applicationName: t.merek.nama,
    metadataBase: new URL(process.env.APP_ORIGIN ?? "https://antikebo.agentbuff.id"),
    openGraph: { title: t.merek.namaPanjang, description: t.merek.janji, type: "website" },
    robots: { index: true, follow: true },
    // Dipasang ke Layar Utama iPhone: tampil tanpa bilah Safari (PWA, P9).
    appleWebApp: { capable: true, title: t.merek.nama, statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1f8" },
    { media: "(prefers-color-scheme: dark)", color: "#07070d" },
  ],
};

export default async function TataLetakAkar({ children }: { children: React.ReactNode }) {
  const [s, b] = await Promise.all([sesiSaatIni(), bahasaSaatIni()]);
  const zona = s?.pengguna.zonaWaktu ?? "Asia/Jakarta";
  // Tema & waktu dipasang di server: tidak ada kedip, tidak perlu skrip anti-kedip.
  return (
    <html lang={b} data-tema={s?.pengguna.tema ?? "sistem"} data-waktu={waktuHari(zona)} className={inter.variable} suppressHydrationWarning>
      <body>
        <div aria-hidden className="latar-ambient" />
        <PenyediaKamus bahasa={b}>
          {children}
          <WadahToast />
        </PenyediaKamus>
        <PembaruWaktu zona={zona} />
      </body>
    </html>
  );
}
