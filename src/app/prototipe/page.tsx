import Link from "next/link";
import { DAFTAR_LAYAR } from "@/lib/prototipe/layar";
import { Logo } from "@/components/ui/ikon";
import { kamusServer } from "@/lib/i18n/server";

export default async function GaleriPrototipe() {
  const { t } = await kamusServer();
  return (
    <main className="mx-auto max-w-[960px] px-4 py-10 sm:px-6">
      <header className="flex items-center gap-3">
        <Logo ukuran={44} />
        <div>
          <h1 className="t-judul-1">{t.prototipe.judul}</h1>
          <p className="t-subjudul text-label-2">{t.prototipe.sub}</p>
        </div>
      </header>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DAFTAR_LAYAR.map((id) => (
          <li key={id}>
            <Link href={`/prototipe/${id}`} className="tekan kaca flex h-16 items-center rounded-[20px] px-5 text-[17px] font-semibold">
              {t.prototipe.layar[id]}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
