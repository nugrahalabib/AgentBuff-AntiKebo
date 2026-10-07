"use client";

import { useEffect, useRef } from "react";
import type { JenisPeristiwa } from "@/lib/peristiwa";

export type DataPeristiwa = { k: string | null; d: string | null; waktuServer?: string };
type Peta = Partial<Record<JenisPeristiwa | "halo", (d: DataPeristiwa) => void>>;

const JENIS: ReadonlyArray<JenisPeristiwa | "halo"> = ["halo", "jadwal", "berbunyi", "berhenti", "tunda", "cek", "klip_siap", "perangkat", "cabut"];

/**
 * Langganan SSE `/api/peristiwa` (arsitektur §5). Peristiwa hanya berisi id; isi dibaca ulang lewat
 * API. EventSource menyambung ulang sendiri (retry 3 dtk); `halo` datang setiap kali tersambung,
 * jadi pemakai bisa memuat ulang keadaan yang mungkin terlewat saat putus.
 */
export function usePeristiwa(peta: Peta, aktif = true, saatPutus?: () => void) {
  const terbaru = useRef({ peta, saatPutus });
  useEffect(() => {
    terbaru.current = { peta, saatPutus };
  });
  useEffect(() => {
    if (!aktif || typeof EventSource === "undefined") return;
    const es = new EventSource("/api/peristiwa");
    const pasang = JENIS.map((j) => {
      const f = (e: MessageEvent<string>) => {
        let d: DataPeristiwa = { k: null, d: null };
        try {
          d = { k: null, d: null, ...(JSON.parse(e.data) as Partial<DataPeristiwa>) };
        } catch {
          /* muatan rusak: abaikan */
        }
        terbaru.current.peta[j]?.(d);
      };
      es.addEventListener(j, f as EventListener);
      return () => es.removeEventListener(j, f as EventListener);
    });
    // Putus (server mati, jaringan hilang): EventSource mencoba lagi sendiri; `halo` menandai pulih.
    es.onerror = () => terbaru.current.saatPutus?.();
    return () => {
      for (const lepas of pasang) lepas();
      es.close();
    };
  }, [aktif]);
}
