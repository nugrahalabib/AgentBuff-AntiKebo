"use client";

import { useEffect } from "react";
import { waktuHari } from "@/lib/waktu/suasana-hari";

/** Latar ambient ikut berganti (pagi, siang, sore, malam) tanpa muat ulang. */
export function PembaruWaktu({ zona }: { zona: string }) {
  useEffect(() => {
    const atur = () => document.documentElement.setAttribute("data-waktu", waktuHari(zona));
    const t = setInterval(atur, 5 * 60_000);
    return () => clearInterval(t);
  }, [zona]);
  return null;
}
