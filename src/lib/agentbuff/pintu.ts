import { env, envOpsional, modeTiruan } from "@/lib/env";
import { log } from "@/lib/log";

// Klien pintu AgentBuff untuk aplikasi mitra: daftar kanal, kirim pesan, daftar suara,
// buat suara. Kontrak persis: docs/05-INTEGRASI-AGENTBUFF.md §4 dan §5.
// Semua pintu: POST, Basic auth klien (sama dengan /masuk/status), badan JSON.
// Selama pintu asli belum dibangun (paket L1), `AGENTBUFF_TIRUAN=1` mengarahkan ke
// server tiruan tests/tiruan/agentbuff.ts. Klien ini TIDAK PERNAH melempar karena
// jaringan: setiap kegagalan jadi `{ ok: false, alasan }` supaya worker bisa memutuskan.
// Isi pesan dan teks naskah tidak pernah dicatat di log.

export const PLATFORM_KANAL = ["telegram", "whatsapp", "discord", "slack", "google_chat"] as const;
export type PlatformKanal = (typeof PLATFORM_KANAL)[number];

export type Kanal = { id: string; platform: PlatformKanal; label: string; agen: string; siap: boolean; alasan?: string };
export type DaftarSuara = { penyedia: string; bawaan: string; suara: Array<{ id: string; nama: string; gender: string }> };
export type KlipSuara = { audio: Buffer; mime: "audio/ogg" | "audio/mpeg"; penyedia: string; suara: string; durasiMs: number };

/** Alasan galat dari kontrak + dua alasan sisi klien (`tidak_terjangkau`, `jawaban_janggal`). */
export type AlasanPintu =
  | "klien"
  | "tidak_berhak"
  | "belum_diizinkan"
  | "tidak_dikenal"
  | "agen_tidak_aktif"
  | "kanal_tidak_siap"
  | "terlalu_cepat"
  | "teks_tidak_sah"
  | "permintaan_tidak_sah"
  | "kuota"
  | "penyedia_gagal"
  | "tidak_terjangkau"
  | "jawaban_janggal";

export type GagalPintu = { ok: false; status: number; alasan: AlasanPintu; pesan?: string; ulangiSetelahMs?: number };
export type HasilPintu<T> = ({ ok: true } & T) | GagalPintu;

const ALASAN_DIKENAL = new Set<string>([
  "klien",
  "tidak_berhak",
  "belum_diizinkan",
  "tidak_dikenal",
  "agen_tidak_aktif",
  "kanal_tidak_siap",
  "terlalu_cepat",
  "teks_tidak_sah",
  "permintaan_tidak_sah",
  "kuota",
  "penyedia_gagal",
]);

export const BATAS = { teksKabar: 1000, kunciKabar: 64, teksSuara: 300 } as const;
const BATAS_AUDIO_BYTE = 5 * 1024 * 1024;

/** Alamat dasar pintu: server tiruan bila `AGENTBUFF_TIRUAN=1`, selain itu issuer AgentBuff. */
export function basisPintu(): string {
  if (modeTiruan()) return (envOpsional("AGENTBUFF_TIRUAN_URL") ?? env("AGENTBUFF_ISSUER")).replace(/\/+$/, "");
  return env("AGENTBUFF_ISSUER").replace(/\/+$/, "");
}

function basicKlien(): string {
  const id = encodeURIComponent(env("AGENTBUFF_MASUK_CLIENT_ID"));
  const rahasia = encodeURIComponent(env("AGENTBUFF_MASUK_CLIENT_SECRET"));
  return `Basic ${Buffer.from(`${id}:${rahasia}`).toString("base64")}`;
}

async function panggil(jalur: string, badan: Record<string, unknown>, batasMs: number): Promise<Response | GagalPintu> {
  try {
    return await fetch(`${basisPintu()}${jalur}`, {
      method: "POST",
      headers: { Authorization: basicKlien(), "Content-Type": "application/json", Accept: "application/json, audio/*" },
      body: JSON.stringify(badan),
      signal: AbortSignal.timeout(batasMs),
      cache: "no-store",
    });
  } catch (e) {
    log.warn({ err: (e as Error)?.name, jalur }, "pintu AgentBuff tidak terjangkau");
    return { ok: false, status: 0, alasan: "tidak_terjangkau" };
  }
}

async function bacaJsonAman(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const v = await res.json();
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Ubah jawaban bukan-200 jadi galat terstruktur. Alasan yang tidak dikenal = tidak terjangkau (aman untuk dicoba lagi). */
async function galatDari(res: Response, jalur: string): Promise<GagalPintu> {
  const b = await bacaJsonAman(res);
  const alasan = typeof b?.alasan === "string" && ALASAN_DIKENAL.has(b.alasan) ? (b.alasan as AlasanPintu) : "tidak_terjangkau";
  if (alasan === "klien") log.error({ jalur }, "AgentBuff menolak kredensial klien di pintu: periksa AGENTBUFF_MASUK_CLIENT_ID/SECRET");
  const ulangi = typeof b?.ulangiSetelahMs === "number" && Number.isFinite(b.ulangiSetelahMs) ? Math.max(0, Math.min(b.ulangiSetelahMs, 24 * 3600_000)) : undefined;
  return {
    ok: false,
    status: res.status,
    alasan,
    pesan: typeof b?.pesan === "string" ? b.pesan.slice(0, 300) : undefined,
    ...(ulangi !== undefined ? { ulangiSetelahMs: ulangi } : {}),
  };
}

const janggal = (status: number): GagalPintu => ({ ok: false, status, alasan: "jawaban_janggal" });

function kanalSah(k: unknown): k is Kanal {
  if (!k || typeof k !== "object") return false;
  const x = k as Record<string, unknown>;
  return (
    typeof x.id === "string" &&
    x.id.length > 0 &&
    x.id.length <= 100 &&
    typeof x.platform === "string" &&
    (PLATFORM_KANAL as readonly string[]).includes(x.platform) &&
    typeof x.label === "string" &&
    typeof x.agen === "string" &&
    typeof x.siap === "boolean" &&
    (x.alasan === undefined || typeof x.alasan === "string")
  );
}

/** §4.1 Daftar kanal agen pengguna. Kanal berbentuk janggal dibuang (platform baru yang belum dikenal tidak membuat gagal). */
export async function daftarKanal(sub: string): Promise<HasilPintu<{ kanal: Kanal[] }>> {
  const res = await panggil("/kanal", { sub }, 8_000);
  if (!(res instanceof Response)) return res;
  if (res.status !== 200) return galatDari(res, "/kanal");
  const b = await bacaJsonAman(res);
  if (!b || !Array.isArray(b.kanal)) return janggal(res.status);
  return {
    ok: true,
    kanal: b.kanal.filter(kanalSah).map((k) => ({
      id: k.id,
      platform: k.platform,
      label: k.label.slice(0, 120),
      agen: k.agen.slice(0, 80),
      siap: k.siap,
      ...(k.alasan ? { alasan: k.alasan.slice(0, 200) } : {}),
    })),
  };
}

/** §4.2 Kirim satu pesan teks ke chat pribadi pemilik lewat bot agennya. `kunci` = idempotensi 24 jam. */
export async function kirimKabar(sub: string, isi: { kanal: string; teks: string; kunci: string }): Promise<HasilPintu<{ id: string }>> {
  if (!isi.teks || isi.teks.length > BATAS.teksKabar || !isi.kunci || isi.kunci.length > BATAS.kunciKabar) {
    return { ok: false, status: 0, alasan: "teks_tidak_sah" };
  }
  const res = await panggil("/kabar", { sub, kanal: isi.kanal, teks: isi.teks, kunci: isi.kunci }, 10_000);
  if (!(res instanceof Response)) return res;
  if (res.status !== 200) return galatDari(res, "/kabar");
  const b = await bacaJsonAman(res);
  if (!b || b.ok !== true || typeof b.id !== "string") return janggal(res.status);
  return { ok: true, id: b.id.slice(0, 200) };
}

/** §5.1 Daftar suara sesuai pengaturan suara pengguna di AgentBuff. */
export async function daftarSuara(sub: string, bahasa: "id" | "en"): Promise<HasilPintu<DaftarSuara>> {
  const res = await panggil("/suara/daftar", { sub, bahasa }, 8_000);
  if (!(res instanceof Response)) return res;
  if (res.status !== 200) return galatDari(res, "/suara/daftar");
  const b = await bacaJsonAman(res);
  if (!b || typeof b.penyedia !== "string" || typeof b.bawaan !== "string" || !Array.isArray(b.suara)) return janggal(res.status);
  const suara = b.suara
    .filter((s): s is { id: string; nama: string; gender: string } => !!s && typeof s === "object" && typeof s.id === "string" && typeof s.nama === "string")
    .map((s) => ({ id: s.id.slice(0, 120), nama: s.nama.slice(0, 80), gender: typeof s.gender === "string" ? s.gender.slice(0, 30) : "" }));
  return { ok: true, penyedia: b.penyedia.slice(0, 40), bawaan: b.bawaan.slice(0, 120), suara };
}

/** §5.2 Buat satu klip suara. Badan jawaban 200 = berkas audio. */
export async function buatSuara(sub: string, isi: { teks: string; gaya: "galak" | "biasa"; suara?: string; bahasa: "id" | "en" }): Promise<HasilPintu<KlipSuara>> {
  if (!isi.teks.trim() || isi.teks.length > BATAS.teksSuara) return { ok: false, status: 0, alasan: "teks_tidak_sah" };
  const badan: Record<string, unknown> = { sub, teks: isi.teks, gaya: isi.gaya, bahasa: isi.bahasa };
  if (isi.suara) badan.suara = isi.suara;
  const res = await panggil("/suara", badan, 60_000);
  if (!(res instanceof Response)) return res;
  if (res.status !== 200) return galatDari(res, "/suara");
  const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (mime !== "audio/ogg" && mime !== "audio/mpeg") return janggal(res.status);
  let audio: Buffer;
  try {
    audio = Buffer.from(await res.arrayBuffer());
  } catch {
    return { ok: false, status: res.status, alasan: "tidak_terjangkau" };
  }
  if (audio.length === 0 || audio.length > BATAS_AUDIO_BYTE) return janggal(res.status);
  const durasi = Number(res.headers.get("x-agentbuff-durasi-ms"));
  return {
    ok: true,
    audio,
    mime,
    penyedia: (res.headers.get("x-agentbuff-penyedia") ?? "").slice(0, 40),
    suara: (res.headers.get("x-agentbuff-suara") ?? isi.suara ?? "").slice(0, 120),
    durasiMs: Number.isFinite(durasi) && durasi > 0 ? Math.round(durasi) : 0,
  };
}
