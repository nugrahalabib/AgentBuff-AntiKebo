"use client";

import { AirVent, Blinds, Lightbulb, Plug, Sparkles, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useKamus } from "@/lib/i18n/klien";

// Demo landing: ketuk contoh perintah -> ubin rumah contoh bereaksi persis seperti
// saat agen memanggil Tuya MCP. Murni tampilan; tidak menyentuh perangkat siapa pun.

type Ubin = { kunci: string; ikon: LucideIcon; nama: { id: string; en: string }; ruang: { id: string; en: string }; nyala: boolean; ket: string; warna: string; cahaya?: string };

const AWAL: Ubin[] = [
  { kunci: "meja", ikon: Lightbulb, nama: { id: "Lampu Meja", en: "Desk Lamp" }, ruang: { id: "Kamar", en: "Bedroom" }, nyala: true, ket: "80%", warna: "#ffb800", cahaya: "rgba(255,184,0,0.55)" },
  { kunci: "plafon", ikon: Lightbulb, nama: { id: "Lampu Plafon", en: "Ceiling Light" }, ruang: { id: "Kamar", en: "Bedroom" }, nyala: true, ket: "100%", warna: "#ffb800", cahaya: "rgba(255,184,0,0.55)" },
  { kunci: "ac", ikon: AirVent, nama: { id: "AC Studio", en: "Studio AC" }, ruang: { id: "Studio", en: "Studio" }, nyala: false, ket: "", warna: "#34c4e5", cahaya: "rgba(52,196,229,0.55)" },
  { kunci: "strip", ikon: Lightbulb, nama: { id: "Lampu Strip", en: "LED Strip" }, ruang: { id: "Ruang TV", en: "Living Room" }, nyala: false, ket: "", warna: "#bf5af2", cahaya: "rgba(191,90,242,0.55)" },
  { kunci: "dispenser", ikon: Plug, nama: { id: "Dispenser", en: "Water Dispenser" }, ruang: { id: "Dapur", en: "Kitchen" }, nyala: true, ket: "42 W", warna: "#30d158", cahaya: "rgba(48,209,88,0.5)" },
  { kunci: "tirai", ikon: Blinds, nama: { id: "Tirai", en: "Curtain" }, ruang: { id: "Ruang TV", en: "Living Room" }, nyala: true, ket: "100%", warna: "#bf5af2", cahaya: "rgba(191,90,242,0.5)" },
];

type Skenario = { teks: { id: string; en: string }; jawab: { id: string; en: string }; ubah: (u: Ubin) => Partial<Ubin> | null };

const SKENARIO: Skenario[] = [
  {
    teks: { id: "Matikan semua lampu kamar", en: "Turn off the bedroom lights" },
    jawab: { id: "Selesai. Lampu Meja dan Lampu Plafon sudah mati.", en: "Done. Desk Lamp and Ceiling Light are off." },
    ubah: (u) => (u.ruang.id === "Kamar" ? { nyala: false, ket: "" } : null),
  },
  {
    teks: { id: "Nyalakan AC studio 24°, mode dingin", en: "Studio AC on, 24°, cool mode" },
    jawab: { id: "AC Studio menyala: 24°, mode dingin.", en: "Studio AC is on: 24°, cool mode." },
    ubah: (u) => (u.kunci === "ac" ? { nyala: true, ket: "24°" } : null),
  },
  {
    teks: { id: "Aktifkan suasana Nonton", en: "Activate the Movie scene" },
    jawab: { id: "Suasana Nonton aktif: strip ungu 30%, tirai ditutup, lampu kamar mati.", en: "Movie scene on: strip purple 30%, curtain closed, bedroom lights off." },
    ubah: (u) =>
      u.kunci === "strip" ? { nyala: true, ket: "30%" } : u.kunci === "tirai" ? { nyala: false, ket: "" } : u.ruang.id === "Kamar" ? { nyala: false, ket: "" } : null,
  },
];

export function DemoRumah() {
  const { b } = useKamus();
  const [ubin, setUbin] = useState(AWAL);
  const [aktif, setAktif] = useState<number | null>(null);
  const [kunciAnimasi, setKunciAnimasi] = useState(0);

  const jalankan = (i: number) => {
    setAktif(i);
    setKunciAnimasi((k) => k + 1);
    setUbin((daftar) => daftar.map((u) => ({ ...u, ...(SKENARIO[i].ubah(u) ?? {}) })));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
      <div className="flex flex-col gap-3">
        {SKENARIO.map((s, i) => (
          <button
            key={s.teks.id}
            type="button"
            onClick={() => jalankan(i)}
            className={cn(
              "tekan tekan-angkat flex items-center gap-3 rounded-[22px] px-5 py-4 text-left text-[17px] font-semibold",
              aktif === i ? "kaca-nyala [--cahaya:rgba(10,132,255,0.45)]" : "kaca",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#22d3ee,#6366f1 55%,#a855f7)" }}>
              <Sparkles size={17} />
            </span>
            <span className="min-w-0 flex-1">“{s.teks[b]}”</span>
          </button>
        ))}
        <div className="min-h-[76px]" aria-live="polite">
          {aktif !== null ? (
            <div key={kunciAnimasi} className="muncul kaca-kuat ml-auto max-w-[92%] rounded-[22px] rounded-br-[8px] px-5 py-3.5 text-[15px] text-label">
              {SKENARIO[aktif].jawab[b]}
            </div>
          ) : null}
        </div>
      </div>
      <div className="kaca grid grid-cols-2 gap-3 rounded-[32px] p-3 sm:grid-cols-3 sm:p-4">
        {ubin.map((u) => (
          <div
            key={u.kunci}
            className={cn("flex aspect-[1.05] flex-col justify-between rounded-[22px] p-3.5 transition-all duration-500", u.nyala ? "kaca-nyala" : "bg-kaca-isi")}
            style={{ ["--cahaya" as string]: u.cahaya, transitionTimingFunction: "var(--ease-pegas)" }}
          >
            <span
              className="grid size-10 place-items-center rounded-full transition-colors duration-500"
              style={{ background: u.nyala ? u.warna : "var(--kaca-isi)", color: u.nyala ? "#fff" : "var(--label-2)" }}
            >
              <u.ikon size={20} strokeWidth={2.2} />
            </span>
            <span>
              <span className={cn("block text-[15px] leading-tight font-semibold", u.nyala ? "text-nyala-label" : "text-label")}>{u.nama[b]}</span>
              <span className={cn("t-keterangan block", u.nyala ? "text-nyala-label-2" : "text-label-2")}>{u.nyala ? u.ket || u.ruang[b] : u.ruang[b]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
