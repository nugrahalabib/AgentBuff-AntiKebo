"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { panggilApi } from "@/lib/klien/api";
import { usePeristiwa } from "@/lib/klien/peristiwa";

type Aktif = { id: string; status: string; cekPada?: string | null };

/**
 * Pengawas di halaman aplikasi biasa: begitu ada alarm berbunyi (atau "Masih bangun?" tiba
 * waktunya), pindah ke layar alarm penuh. Kabar datang lewat SSE; saat tersambung (ulang) keadaan
 * dibaca lagi supaya alarm yang mulai berbunyi saat koneksi putus tidak terlewat.
 */
export function PengawasAlarm() {
  const router = useRouter();
  const pindah = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ulang = useRef<() => void>(() => {});

  const periksa = useCallback(async () => {
    if (pindah.current) return;
    const r = await panggilApi<{ kejadian: Aktif[] }>("/api/app/kejadian/aktif");
    if (!r.ok) return;
    const berbunyi = r.data.kejadian.find((k) => k.status === "berbunyi");
    if (berbunyi) {
      pindah.current = true;
      router.push(`/app/bunyi/${berbunyi.id}`);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    const cek = r.data.kejadian.filter((k) => k.status === "cek_bangun" && k.cekPada).sort((a, b) => Date.parse(a.cekPada!) - Date.parse(b.cekPada!))[0];
    if (cek) {
      const tunggu = Date.parse(cek.cekPada!) - Date.now();
      if (tunggu <= 1_000) {
        pindah.current = true;
        router.push(`/app/bunyi/${cek.id}`);
      } else timer.current = setTimeout(() => ulang.current(), Math.min(tunggu, 2 ** 31 - 1));
    }
  }, [router]);

  useEffect(() => {
    ulang.current = () => void periksa();
    void periksa();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [periksa]);
  usePeristiwa({ halo: () => void periksa(), berbunyi: () => void periksa(), cek: () => void periksa() });
  return null;
}
