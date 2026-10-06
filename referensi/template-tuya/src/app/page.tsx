import { AirVent, Blinds, CalendarClock, ChevronRight, Fan, Heater, Lightbulb, Plug, ShieldCheck, Sparkles, ToggleRight, Activity, Zap, Cctv } from "lucide-react";
import Link from "next/link";
import { DemoRumah } from "@/components/landing/demo";
import { TautanTombol } from "@/components/ui/dasar";
import { Logo } from "@/components/ui/ikon";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const IKON_FITUR = [Sparkles, CalendarClock, Zap, ShieldCheck];
const IKON_PERANGKAT = [
  { ikon: Lightbulb, warna: "var(--ikon-lampu)" },
  { ikon: ToggleRight, warna: "var(--ikon-saklar)" },
  { ikon: Plug, warna: "var(--ikon-colokan)" },
  { ikon: AirVent, warna: "var(--ikon-ac)" },
  { ikon: Fan, warna: "var(--ikon-kipas)" },
  { ikon: Blinds, warna: "var(--ikon-tirai)" },
  { ikon: Heater, warna: "var(--ikon-pemanas)" },
  { ikon: Activity, warna: "var(--ikon-sensor)" },
  { ikon: Cctv, warna: "var(--ikon-lain)" },
];

export default async function Beranda() {
  const [{ t }, s] = await Promise.all([kamusServer(), sesiSaatIni()]);
  const L = t.landing;
  const marketplace = `${process.env.AGENTBUFF_ORIGIN ?? "https://agentbuff.id"}/marketplace?produk=${encodeURIComponent(process.env.AGENTBUFF_PRODUCT_KEY ?? "tuya-mcp")}`;
  const masuk = s ? "/app" : "/auth/agentbuff/start?lanjut=/app";

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-16 sm:px-6">
      <header className="sticky top-3 z-30 pt-3">
        <nav className="kaca mx-auto flex h-14 items-center gap-3 rounded-full pr-2 pl-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo ukuran={34} />
            <span className="leading-none">
              <span className="block text-[16px] font-bold tracking-tight">{t.merek.nama}</span>
              <span className="t-kapsi text-label-2">{t.merek.oleh}</span>
            </span>
          </Link>
          <div className="flex-1" />
          <TautanTombol href={masuk} ukuran="kecil" varian="utama">
            {s ? t.shell.tab.rumah : t.masuk.judul}
          </TautanTombol>
        </nav>
      </header>

      <section className="pt-16 pb-14 text-center sm:pt-24">
        <p className="muncul kaca mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold text-label-2">
          <span className="size-2 rounded-full bg-berhasil-isi" />
          {L.lencana}
        </p>
        <h1 className="t-hero muncul mx-auto mt-6 max-w-[16ch] [animation-delay:60ms]">
          {L.judul1}{" "}
          <span className="bg-[linear-gradient(110deg,#0891b2,#4f46e5_45%,#9333ea)] bg-clip-text text-transparent dark:bg-[linear-gradient(110deg,#67e8f9,#818cf8_45%,#d8b4fe)]">{L.judul2}</span>
        </h1>
        <p className="t-isi muncul mx-auto mt-6 max-w-[58ch] text-label-2 [animation-delay:120ms] sm:text-[19px]">{L.sub}</p>
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

      <section aria-labelledby="judul-contoh" className="muncul [animation-delay:300ms]">
        <h2 id="judul-contoh" className="t-judul-2 mb-5 text-center">
          {L.contohJudul}
        </h2>
        <DemoRumah />
      </section>

      <section aria-labelledby="judul-cara" className="pt-24">
        <div className="mb-8 text-center">
          <h2 id="judul-cara" className="t-judul-1">
            {L.caraJudul}
          </h2>
          <p className="t-isi mt-2 text-label-2">{L.caraSub}</p>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {L.cara.map((c, i) => (
            <li key={c.judul} className="kaca relative overflow-hidden rounded-[28px] p-6">
              <span aria-hidden className="t-angka absolute -top-4 -right-1 text-[110px] leading-none font-bold text-label opacity-[0.06]">
                {i + 1}
              </span>
              <span className="t-angka grid size-10 place-items-center rounded-full bg-aksen-isi text-[17px] font-bold text-white">{i + 1}</span>
              <h3 className="t-judul-3 mt-5">{c.judul}</h3>
              <p className="t-subjudul mt-2 text-label-2">{c.isi}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="judul-fitur" className="pt-24">
        <h2 id="judul-fitur" className="t-judul-1 mb-8 text-center">
          {L.fiturJudul}
        </h2>
        <div className="grid gap-4 md:grid-cols-6">
          {L.fitur.map((f, i) => {
            const Ikon = IKON_FITUR[i];
            return (
              <article key={f.judul} className={`kaca tekan-angkat tekan rounded-[28px] p-6 ${i === 0 || i === 3 ? "md:col-span-4" : "md:col-span-2"}`}>
                <span className="grid size-12 place-items-center rounded-[16px] text-white" style={{ background: ["linear-gradient(135deg,#a855f7,#6366f1)", "linear-gradient(135deg,#0ea5e9,#22d3ee)", "linear-gradient(135deg,#f59e0b,#f97316)", "linear-gradient(135deg,#10b981,#22c55e)"][i] }}>
                  <Ikon size={22} />
                </span>
                <h3 className="t-judul-3 mt-5">{f.judul}</h3>
                <p className="t-subjudul mt-2 max-w-[44ch] text-label-2">{f.isi}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="judul-perangkat" className="pt-24 text-center">
        <h2 id="judul-perangkat" className="t-judul-1">
          {L.perangkatJudul}
        </h2>
        <p className="t-isi mx-auto mt-3 max-w-[60ch] text-label-2">{L.perangkatSub}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {IKON_PERANGKAT.map(({ ikon: Ikon, warna }, i) => (
            <span key={i} className="kaca grid size-16 place-items-center rounded-[20px]" style={{ color: warna }}>
              <Ikon size={28} strokeWidth={2} />
            </span>
          ))}
        </div>
      </section>

      <section aria-labelledby="judul-faq" className="mx-auto max-w-3xl pt-24">
        <h2 id="judul-faq" className="t-judul-1 mb-6 text-center">
          {L.faqJudul}
        </h2>
        <div className="flex flex-col gap-3">
          {L.faq.map((f) => (
            <details key={f.t} className="kaca group rounded-[22px] px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold">
                {f.t}
                <ChevronRight size={18} className="shrink-0 text-label-3 transition-transform duration-300 group-open:rotate-90" />
              </summary>
              <p className="t-subjudul mt-3 text-label-2">{f.j}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="pt-24">
        <div className="kaca-kuat relative overflow-hidden rounded-[36px] px-6 py-14 text-center">
          <div aria-hidden className="absolute inset-0 -z-10 opacity-60" style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(99,102,241,0.35), transparent 70%)" }} />
          <div className="mx-auto mb-5 w-fit">
            <Logo ukuran={64} />
          </div>
          <h2 className="t-judul-besar">{L.penutup}</h2>
          <p className="t-isi mt-3 text-label-2">{L.penutupSub}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <TautanTombol href={masuk} ukuran="besar">
              {L.ctaMasuk}
            </TautanTombol>
            <TautanTombol href={marketplace} varian="kaca" ukuran="besar">
              {L.ctaBeli}
            </TautanTombol>
          </div>
        </div>
      </section>

      <footer className="t-keterangan pt-12 text-center text-label-3">
        <p>{t.merek.bukanAfiliasi}</p>
      </footer>
    </div>
  );
}
