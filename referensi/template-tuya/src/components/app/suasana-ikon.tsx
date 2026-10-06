import { Bed, BookOpen, Briefcase, Coffee, Dumbbell, Film, House, Leaf, Moon, PartyPopper, Power, Sparkles, Sun, Utensils, type LucideIcon } from "lucide-react";

export const IKON_SUASANA: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  sun: Sun,
  moon: Moon,
  film: Film,
  briefcase: Briefcase,
  coffee: Coffee,
  bed: Bed,
  home: House,
  "party-popper": PartyPopper,
  "book-open": BookOpen,
  utensils: Utensils,
  dumbbell: Dumbbell,
  leaf: Leaf,
  power: Power,
};

export const WARNA_SUASANA: Record<string, string> = {
  nila: "linear-gradient(135deg,#6366f1,#a855f7)",
  biru: "linear-gradient(135deg,#0a84ff,#5e5ce6)",
  sian: "linear-gradient(135deg,#0ea5e9,#22d3ee)",
  hijau: "linear-gradient(135deg,#10b981,#34d399)",
  kuning: "linear-gradient(135deg,#f59e0b,#fcd34d)",
  oranye: "linear-gradient(135deg,#f97316,#fb923c)",
  merah: "linear-gradient(135deg,#ef4444,#f97316)",
  merah_muda: "linear-gradient(135deg,#ec4899,#f472b6)",
  ungu: "linear-gradient(135deg,#8b5cf6,#d946ef)",
  abu: "linear-gradient(135deg,#64748b,#94a3b8)",
};

export function IkonSuasana({ ikon, warna, ukuran = 44 }: { ikon: string; warna: string; ukuran?: number }) {
  const Ikon = IKON_SUASANA[ikon] ?? Sparkles;
  return (
    <span className="grid shrink-0 place-items-center rounded-[14px] text-white shadow-md" style={{ width: ukuran, height: ukuran, background: WARNA_SUASANA[warna] ?? WARNA_SUASANA.nila }}>
      <Ikon size={Math.round(ukuran * 0.45)} />
    </span>
  );
}
