/**
 * Pemanggil API aplikasi dari peramban: JSON masuk/keluar, galat jadi `{ ok: false, galat, pesan }`
 * (pesan dari server sudah ramah; cadangan dari pemanggil bila jaringan putus). Pesan galat mentah
 * tidak pernah sampai ke layar.
 */
export type HasilApi<T> = { ok: true; data: T } | { ok: false; status: number; galat: string; pesan: string | null; data: Record<string, unknown> };

export async function panggilApi<T = Record<string, unknown>>(url: string, metode = "GET", isi?: unknown): Promise<HasilApi<T>> {
  let r: Response;
  try {
    r = await fetch(url, {
      method: metode,
      headers: isi === undefined ? undefined : { "Content-Type": "application/json" },
      body: isi === undefined ? undefined : JSON.stringify(isi),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, galat: "jaringan", pesan: null, data: {} };
  }
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (r.ok) return { ok: true, data: data as T };
  return { ok: false, status: r.status, galat: typeof data.galat === "string" ? data.galat : "galat", pesan: typeof data.pesan === "string" ? data.pesan : null, data };
}
