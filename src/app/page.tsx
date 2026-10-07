import { AlarmClock, ChevronRight, MessageCircle, Megaphone } from "lucide-react";
import Link from "next/link";
import { TautanTombol } from "@/components/ui/dasar";
import { Logo } from "@/components/ui/ikon";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const IKON_POIN = [AlarmClock, Megaphone, MessageCircle];

export default async function HalamanDepan() {
  const [{ t }, s] = await Promise.all([kamusServer(), sesiSaatIni()]);
  const L = t.landing;
  const marketplace = `${process.env.AGENTBUFF_ORIGIN ?? "https://agentbuff.id"}/marketplace?produk=${encodeURIComponent(process.env.AGENTBUFF_PRODUCT_KEY ?? "antikebo")}`;
  const masuk = s ? "/app" : "/auth/agentbuff/start?lanjut=/app";

  return (
    <div className="mx-auto max-w-[1080px] px-4 pb-16 sm:px-6">
      <header className="sticky top-3 z-30 pt-3">
        <nav className="kaca mx-auto flex h-14 items-center gap-3 rounded-full pr-2 pl-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo ukuran={34} />
            <span className="leading-none">
              <span className="block text-[16px] font-bold tracking-tight">{t.merek.nama}</span>
              <span className="t-keterangan text-label-2">{t.merek.oleh}</span>
            </span>
          </Link>
          <div className="flex-1" />
          <TautanTombol href={masuk} ukuran="kecil">
            {s ? t.shell.tab.alarm : t.masuk.judul}
          </TautanTombol>
        </nav>
      </header>

      <main>
        <section className="pt-16 pb-14 text-center sm:pt-24">
          <p className="muncul kaca mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold text-label-2">
            <span className="size-2 rounded-full bg-toska-isi" />
            {L.lencana}
          </p>
          <h1 className="t-hero muncul mx-auto mt-6 max-w-[16ch] [animation-delay:60ms]">
            {L.judul1}{" "}
            <span className="bg-[linear-gradient(110deg,#0d9488,#4338ca)] bg-clip-text text-transparent dark:bg-[linear-gradient(110deg,#5eead4,#a5b4fc)]">{L.judul2}</span>
          </h1>
          <p className="t-isi muncul mx-auto mt-6 max-w-[56ch] text-label-2 [animation-delay:120ms] sm:text-[19px]">{L.sub}</p>
          <div className="muncul mt-9 flex flex-col items-center justify-center gap-3 [animation-delay:180ms] sm:flex-row">
            <TautanTombol href={masuk} ukuran="besar">
              {L.ctaMasuk}
            </TautanTombol>
            <TautanTombol href={marketplace} varian="kaca" ukuran="besar">
              {L.ctaBeli}
              <ChevronRight size={18} />
            </TautanTombol>
          </div>
          <p className="muncul mt-5 text-[15px] text-label-2 [animation-delay:240ms]">
            <span className="t-angka text-[17px] font-bold text-label">{L.harga}</span> · {L.hargaKet}
          </p>
        </section>

        <section aria-label={t.merek.janji} className="grid gap-4 md:grid-cols-3">
          {L.poin.map((p, i) => {
            const Ikon = IKON_POIN[i];
            return (
              <article key={p.judul} className="kaca rounded-[28px] p-6">
                <span className="grid size-12 place-items-center rounded-[16px] bg-kaca-isi text-toska">
                  <Ikon size={22} strokeWidth={1.75} />
                </span>
                <h2 className="t-judul-3 mt-5">{p.judul}</h2>
                <p className="t-subjudul mt-2 text-label-2">{p.isi}</p>
              </article>
            );
          })}
        </section>
      </main>

      <footer className="t-keterangan mx-auto max-w-[60ch] pt-14 text-center text-label-2">
        <p>{L.bukanJaminan}</p>
      </footer>
    </div>
  );
}
