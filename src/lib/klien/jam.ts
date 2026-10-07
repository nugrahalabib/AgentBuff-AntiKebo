"use client";

import { useSyncExternalStore } from "react";

const pendengar = new Set<() => void>();
let pewaktu: ReturnType<typeof setInterval> | null = null;

function berlangganan(cb: () => void) {
  pendengar.add(cb);
  pewaktu ??= setInterval(() => {
    for (const f of pendengar) f();
  }, 1_000);
  return () => {
    pendengar.delete(cb);
    if (!pendengar.size && pewaktu) {
      clearInterval(pewaktu);
      pewaktu = null;
    }
  };
}

/**
 * Jam bersama untuk hitung mundur (detik epoch, dibulatkan ke `langkahDtk`). Saat render server
 * dan hidrasi memakai `awalMs` (jam server ketika halaman dibuat) supaya teks server dan peramban
 * sama; sesudahnya mengikuti jam perangkat dan hanya merender ulang bila nilainya berubah.
 */
export function useDetik(awalMs: number, langkahDtk = 1): number {
  const bulat = (ms: number) => Math.floor(ms / 1000 / langkahDtk) * langkahDtk;
  return useSyncExternalStore(
    berlangganan,
    () => bulat(Date.now()),
    () => bulat(awalMs),
  );
}
