import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/ikon";
import type { Kamus } from "@/lib/i18n/kamus/id";

type Isi = { judul: string; ringkas: string; bagian: ReadonlyArray<{ judul: string; isi: readonly string[] }> };

/**
 * Halaman legal publik (PRD N5): kebijakan privasi dan ketentuan pemakaian. Tanpa sesi, bisa
 * dibaca sebelum membeli dan ditautkan dari listing Marketplace. Naskah di kamus `legal`.
 */
export function HalamanLegal({ t, isi, lain }: { t: Kamus; isi: Isi; lain: { href: string; label: string } }) {
  const L = t.legal;
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-16 sm:px-6">
      <header className="pt-3">
        <nav className="kaca flex h-14 items-center gap-3 rounded-full pr-2 pl-3" aria-label={t.merek.nama}>
          <Link href="/" className="flex min-h-11 items-center gap-2.5">
            <Logo ukuran={34} />
            <span className="text-[16px] font-bold tracking-tight">{t.merek.nama}</span>
          </Link>
          <div className="flex-1" />
          <Link href="/" className="tekan inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold text-aksen">
            <ArrowLeft size={18} aria-hidden />
            {L.kembali}
          </Link>
        </nav>
      </header>

      <main id="isi" className="pt-10">
        <h1 className="t-judul-1">{isi.judul}</h1>
        <p className="t-keterangan mt-2 text-label-2">{L.berlaku}</p>
        <p className="kaca t-isi mt-6 rounded-[24px] p-5 text-label">{isi.ringkas}</p>

        <div className="mt-8 space-y-8">
          {isi.bagian.map((b, i) => (
            <section key={b.judul} aria-labelledby={`bagian-${i}`}>
              <h2 id={`bagian-${i}`} className="t-judul-3">
                {b.judul}
              </h2>
              <div className="mt-2 space-y-2">
                {b.isi.map((p) => (
                  <p key={p} className="t-isi text-label-2">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="t-keterangan mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-pemisah pt-6 text-label-2">
        <Link href={lain.href} className="inline-flex min-h-11 items-center font-semibold text-aksen">
          {lain.label}
        </Link>
        <span>{L.kontak}</span>
      </footer>
    </div>
  );
}
