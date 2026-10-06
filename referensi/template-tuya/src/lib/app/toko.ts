"use client";

import { create } from "zustand";
import type { PerangkatRamah } from "@/lib/layanan/rumah";
import type { PerintahRamah } from "@/lib/tuya/kemampuan";
import type { DataRumah } from "./data";

// Satu toko untuk data rumah di peramban. Sumber kebenaran tetap server: SSE
// "ubah" -> muat ulang; kendali = optimis lalu diganti jawaban server.

export type GalatApi = { galat: string; pesan: string; [k: string]: unknown };

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw (data ?? { galat: "galat_server", pesan: "Ada yang tidak beres." }) as GalatApi;
  return data as T;
}

/** Keadaan optimis dari perintah (sebelum Tuya menjawab). */
function terapkanOptimis(p: PerangkatRamah, c: PerintahRamah): PerangkatRamah {
  const k = { ...p.keadaan };
  if (c.nyala !== undefined) {
    if (k.saluran && c.saluran) k.saluran = k.saluran.map((s) => (s.nomor === c.saluran ? { ...s, nyala: c.nyala! } : s));
    else if (k.saluran) k.saluran = k.saluran.map((s) => ({ ...s, nyala: c.nyala! }));
    k.nyala = k.saluran ? k.saluran.some((s) => s.nyala) : c.nyala;
  }
  if (c.terangPersen !== undefined) {
    k.terangPersen = c.terangPersen;
    if (c.terangPersen > 0 && c.nyala === undefined) k.nyala = true;
  }
  if (c.suhuTarget !== undefined) k.suhuTarget = c.suhuTarget;
  if (c.modeAc !== undefined) k.modeAc = c.modeAc;
  if (c.kipas !== undefined) k.kipas = c.kipas;
  if (c.posisiPersen !== undefined) k.posisiPersen = c.posisiPersen;
  return { ...p, keadaan: k };
}

type Toko = {
  data: DataRumah | null;
  memuat: boolean;
  sibuk: Record<string, number>;
  setel(d: DataRumah): void;
  muat(): Promise<void>;
  kendali(id: string, c: PerintahRamah): Promise<{ ok: true } | { ok: false; galat: GalatApi }>;
  ganti(p: PerangkatRamah): void;
};

let muatBerjalan: Promise<void> | null = null;

export const useToko = create<Toko>((set, get) => ({
  data: null,
  memuat: false,
  sibuk: {},
  setel: (d) => set({ data: d }),
  muat: () => {
    if (muatBerjalan) return muatBerjalan;
    set({ memuat: true });
    muatBerjalan = api<DataRumah>("/api/app/rumah")
      .then((d) => {
        // Perangkat yang sedang dikirimi perintah: pertahankan keadaan optimisnya.
        const sibuk = get().sibuk;
        const lama = new Map((get().data?.perangkat ?? []).map((p) => [p.id, p]));
        set({ data: { ...d, perangkat: d.perangkat.map((p) => (sibuk[p.id] ? (lama.get(p.id) ?? p) : p)) } });
      })
      .catch(() => {})
      .finally(() => {
        muatBerjalan = null;
        set({ memuat: false });
      });
    return muatBerjalan;
  },
  ganti: (p) => {
    const d = get().data;
    if (d) set({ data: { ...d, perangkat: d.perangkat.map((x) => (x.id === p.id ? p : x)) } });
  },
  kendali: async (id, c) => {
    const d = get().data;
    const asli = d?.perangkat.find((p) => p.id === id);
    if (asli) get().ganti(terapkanOptimis(asli, c));
    set((s) => ({ sibuk: { ...s.sibuk, [id]: (s.sibuk[id] ?? 0) + 1 } }));
    try {
      const r = await api<{ perangkat: PerangkatRamah; status: string; catatan: string }>(`/api/app/perangkat/${encodeURIComponent(id)}`, { method: "POST", json: c });
      // Jawaban server = keadaan yang DILAPORKAN perangkat (bukan tebakan optimis).
      get().ganti(r.perangkat);
      if (r.status === "belum_terkonfirmasi") return { ok: false, galat: { galat: "belum_terkonfirmasi", pesan: r.catatan } };
      return { ok: true };
    } catch (e) {
      if (asli) get().ganti(asli);
      return { ok: false, galat: e as GalatApi };
    } finally {
      set((s) => {
        const n = (s.sibuk[id] ?? 1) - 1;
        const sibuk = { ...s.sibuk };
        if (n <= 0) delete sibuk[id];
        else sibuk[id] = n;
        return { sibuk };
      });
    }
  },
}));
