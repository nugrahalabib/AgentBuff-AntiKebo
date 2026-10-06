import {
  Activity,
  AirVent,
  Blinds,
  Bot,
  Box,
  Cctv,
  CookingPot,
  Droplet,
  Droplets,
  Fan,
  Gauge,
  Heater,
  Lightbulb,
  Lock,
  PawPrint,
  Plug,
  Radio,
  Siren,
  ToggleRight,
  Warehouse,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { JenisPerangkat } from "@/lib/tuya/jenis";

export const IKON_JENIS: Record<JenisPerangkat, LucideIcon> = {
  lampu: Lightbulb,
  saklar: ToggleRight,
  colokan: Plug,
  ac: AirVent,
  kipas: Fan,
  tirai: Blinds,
  pemanas: Heater,
  pembersih_udara: Wind,
  pelembap: Droplets,
  sensor: Activity,
  keamanan: Siren,
  kamera: Cctv,
  kunci: Lock,
  dapur: CookingPot,
  robot: Bot,
  remote: Radio,
  meteran: Gauge,
  pintu_garasi: Warehouse,
  katup: Droplet,
  hewan: PawPrint,
  lainnya: Box,
};

/** Warna khas tiap jenis saat menyala (CSS var). */
export const WARNA_JENIS: Record<JenisPerangkat, string> = {
  lampu: "var(--ikon-lampu)",
  saklar: "var(--ikon-saklar)",
  colokan: "var(--ikon-colokan)",
  ac: "var(--ikon-ac)",
  kipas: "var(--ikon-kipas)",
  tirai: "var(--ikon-tirai)",
  pemanas: "var(--ikon-pemanas)",
  pembersih_udara: "var(--ikon-kipas)",
  pelembap: "var(--ikon-ac)",
  sensor: "var(--ikon-sensor)",
  keamanan: "var(--bahaya-isi)",
  kamera: "var(--ikon-sensor)",
  kunci: "var(--ikon-sensor)",
  dapur: "var(--ikon-pemanas)",
  robot: "var(--ikon-lain)",
  remote: "var(--ikon-lain)",
  meteran: "var(--ikon-colokan)",
  pintu_garasi: "var(--ikon-tirai)",
  katup: "var(--ikon-ac)",
  hewan: "var(--ikon-lain)",
  lainnya: "var(--ikon-lain)",
};

/** Merek: rumah + gelombang, gradien AgentBuff. */
export function Logo({ ukuran = 32 }: { ukuran?: number }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="tuya-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#tuya-logo)" />
      <path d="M17 31.5 32 19l15 12.5V46a2 2 0 0 1-2 2H19a2 2 0 0 1-2-2Z" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinejoin="round" />
      <path d="M26.5 38.5a7.8 7.8 0 0 1 11 0" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="32" cy="42.6" r="2.3" fill="#fff" />
    </svg>
  );
}
