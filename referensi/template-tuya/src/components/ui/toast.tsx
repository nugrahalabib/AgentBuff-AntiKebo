"use client";

import { CircleAlert, Check } from "lucide-react";
import { create } from "zustand";

type Toast = { id: number; teks: string; nada: "ok" | "galat" };
const useToast = create<{ daftar: Toast[]; tambah(t: Omit<Toast, "id">): void; hapus(id: number): void }>((set) => ({
  daftar: [],
  tambah: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ daftar: [...s.daftar.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ daftar: s.daftar.filter((x) => x.id !== id) })), t.nada === "galat" ? 6000 : 3500);
  },
  hapus: (id) => set((s) => ({ daftar: s.daftar.filter((x) => x.id !== id) })),
}));

export function tampilToast(teks: string, nada: "ok" | "galat" = "ok") {
  useToast.getState().tambah({ teks, nada });
}

/** Pil kaca di atas bilah tab, gaya Dynamic Island. */
export function WadahToast() {
  const daftar = useToast((s) => s.daftar);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4">
      {daftar.map((t) => (
        <div key={t.id} className="muncul kaca-kuat pointer-events-auto flex max-w-[min(520px,100%)] items-center gap-2.5 rounded-full py-2.5 pr-5 pl-3 text-[15px] font-medium">
          <span className="grid size-6 shrink-0 place-items-center rounded-full text-white" style={{ background: t.nada === "ok" ? "var(--berhasil-isi)" : "var(--bahaya-isi)" }}>
            {t.nada === "ok" ? <Check size={14} strokeWidth={3} /> : <CircleAlert size={14} strokeWidth={2.6} />}
          </span>
          <span className="min-w-0">{t.teks}</span>
        </div>
      ))}
    </div>
  );
}
