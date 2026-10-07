import type { OmelanPutar } from "@/lib/suara/pemutar";

/**
 * Pengatur waktu lokal Mode Jam Meja (PRD H2, arsitektur §4 "perangkat juga memegang jadwal").
 * MURNI (tanpa DOM) supaya bisa dites. Server tetap sumber kebenaran: perangkat hanya berbunyi
 * sendiri bila kabar `berbunyi` dari server belum datang `TENGGANG_LOKAL_MS` sesudah jadwal
 * (server mati atau koneksi putus). Bunyi dan klip diambil dari Cache Storage (Service Worker).
 */

export type OmelanLokal = OmelanPutar;

/** Satu kejadian dari `GET /api/perangkat/jadwal` (bentuk JSON). */
export type ItemLokal = {
  kunci: string;
  kejadianId: string | null;
  jadwalUtc: string;
  jam: string;
  status: string;
  judul: string;
  detail: string | null;
  bunyi: string;
  tundaSampai: string | null;
  uji: boolean;
  omelan: OmelanLokal[];
};

/** Server diberi 5 detik untuk mengabarkan `berbunyi` sebelum perangkat berbunyi sendiri. */
export const TENGGANG_LOKAL_MS = 5_000;
/** Jadwal yang lebih tua dari ini tidak dibunyikan lagi (kabar terlewat urusan server). */
export const BATAS_TERLAMBAT_MS = 30 * 60_000;
export const JENDELA_JAGA_MS = 24 * 60 * 60_000;

/** Kapan item ini harus berbunyi menurut jadwal yang dipegang perangkat (md epoch), atau null. */
export function saatBunyi(i: ItemLokal): number | null {
  if (i.status === "menunggu") return Date.parse(i.jadwalUtc);
  if (i.status === "ditunda" && i.tundaSampai) return Date.parse(i.tundaSampai);
  if (i.status === "berbunyi") return Date.parse(i.jadwalUtc);
  return null;
}

/**
 * Jagaan berikutnya: item paling dulu yang belum ditangani (`sudah` = kunci yang sudah berbunyi di
 * perangkat ini atau sudah dikabarkan server), dengan saat perangkat harus turun tangan.
 */
export function jagaanBerikutnya(jadwal: readonly ItemLokal[], sekarangMs: number, sudah: ReadonlySet<string>): { item: ItemLokal; pada: number } | null {
  let pilih: { item: ItemLokal; pada: number } | null = null;
  for (const i of jadwal) {
    const t = saatBunyi(i);
    if (t === null || sudah.has(i.kunci)) continue;
    if (t < sekarangMs - BATAS_TERLAMBAT_MS || t > sekarangMs + JENDELA_JAGA_MS) continue;
    const pada = Math.max(t + TENGGANG_LOKAL_MS, sekarangMs);
    if (!pilih || pada < pilih.pada) pilih = { item: i, pada };
  }
  return pilih;
}

/** Alarm berikutnya untuk pil "Siaga untuk 05.00" (menunggu atau ditunda), atau null. */
export function alarmBerikutnyaLokal(jadwal: readonly ItemLokal[], sekarangMs: number): ItemLokal | null {
  let pilih: { i: ItemLokal; t: number } | null = null;
  for (const i of jadwal) {
    if (i.status !== "menunggu" && i.status !== "ditunda") continue;
    const t = saatBunyi(i);
    if (t === null || t < sekarangMs - 60_000) continue;
    if (!pilih || t < pilih.t) pilih = { i, t };
  }
  return pilih?.i ?? null;
}

/** Berkas yang harus tersimpan di perangkat untuk jadwal ini (bunyi + klip omelan), tanpa ganda. */
export function asetSiaga(jadwal: readonly ItemLokal[]): string[] {
  const hasil = new Set<string>();
  for (const i of jadwal) {
    hasil.add(`/bunyi/${i.bunyi}.wav`);
    for (const o of i.omelan) if (o.klip) hasil.add(`/api/perangkat/klip/${o.klip}`);
  }
  return [...hasil].sort();
}
