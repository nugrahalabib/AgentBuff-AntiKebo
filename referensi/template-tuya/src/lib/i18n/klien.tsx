"use client";

import { createContext, use, useContext, type ReactNode } from "react";
import type { Bahasa, Kamus } from "./index";

// Konteks kamus klien. Kamus dimuat lewat import() DINAMIS per bahasa: impor statis (bahkan dua
// komponen penyedia terpisah yang dipilih layout) tetap mengirim kamus id + en ke setiap pengunjung
// (±67 KB terkompresi, terukur) — Next memuat semua komponen klien yang DIIMPOR layout, bukan hanya
// yang dirender. Dengan import() hanya bahasa aktif yang diunduh, lalu tersimpan di cache peramban.
const MUAT: Record<Bahasa, () => Promise<Kamus>> = {
  id: () => import("./kamus/id").then((m) => m.id),
  en: () => import("./kamus/en").then((m) => m.en),
};
const singgah = new Map<Bahasa, Promise<Kamus>>();
function kamus(b: Bahasa): Promise<Kamus> {
  let p = singgah.get(b);
  if (!p) {
    p = MUAT[b]();
    singgah.set(b, p);
  }
  return p;
}

const KonteksKamus = createContext<{ b: Bahasa; t: Kamus } | null>(null);

export function PenyediaKamus({ bahasa, children }: { bahasa: Bahasa; children: ReactNode }) {
  const t = use(kamus(bahasa));
  return <KonteksKamus.Provider value={{ b: bahasa, t }}>{children}</KonteksKamus.Provider>;
}

export function useKamus(): { b: Bahasa; t: Kamus } {
  const v = useContext(KonteksKamus);
  if (!v) throw new Error("useKamus dipakai di luar PenyediaKamus");
  return v;
}
