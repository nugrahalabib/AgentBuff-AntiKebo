/**
 * Disalin dari template AgentBuff-Tuya (`937aa8a`), dipangkas untuk AntiKebo (tanpa kamera, cuaca,
 * statistik). Klien REST API end-user Tuya (`/v1.0/end-user/...`, Bearer `sk-...`).
 * Kontrak: github.com/tuya/tuya-openclaw-skills (scripts/tuya_api.py + references/).
 *
 * - Hanya dipakai di server. Kunci tidak pernah dicatat (lihat `GalatTuya`).
 * - 429 & 5xx dicoba ulang (maks 3x) dengan mundur eksponensial + Retry-After.
 * - Setiap permintaan berbatas waktu; Tuya yang menggantung tidak boleh
 *   menahan permintaan pengguna atau worker selamanya.
 */
import { bacaKunci, type Wilayah } from "./wilayah";
import type { DetailPerangkat, ModelPerangkat, PerangkatRingkas, Rumah, Ruangan } from "./tipe";

export type JenisGalat =
  | "kunci_tidak_sah" // 1010 / 10010 / 401
  | "tidak_ada_kontak" // 10011
  | "perangkat_tak_ada" // 40000901 / result null
  | "perangkat_offline" // 40000801 / 2001
  | "model_tak_ada" // 40000903
  | "parameter" // 10001
  | "batas_laju" // 429 sesudah dicoba ulang
  | "batas_notifikasi" // 20002/20003/30002/40002
  | "jaringan" // fetch gagal / batas waktu
  | "server"; // 5xx / lainnya

export class GalatTuya extends Error {
  readonly jenis: JenisGalat;
  readonly kode: string | number | null;
  constructor(jenis: JenisGalat, kode: string | number | null, pesan: string) {
    // Pesan TIDAK PERNAH memuat kunci; pesan mentah Tuya dibatasi panjangnya.
    super(pesan.slice(0, 200));
    this.name = "GalatTuya";
    this.jenis = jenis;
    this.kode = kode;
  }
}

function jenisDariKode(kode: unknown): JenisGalat {
  const k = String(kode ?? "");
  if (k === "1010" || k === "10010" || k === "1004") return "kunci_tidak_sah";
  if (k === "10011") return "tidak_ada_kontak";
  if (k === "40000901" || k === "DEVICE_NOT_EXIST_V2") return "perangkat_tak_ada";
  if (k === "40000903") return "model_tak_ada";
  if (k === "40000801" || k === "2001") return "perangkat_offline";
  if (k === "10001" || k === "1108") return "parameter";
  if (["20002", "20003", "30002", "40002"].includes(k)) return "batas_notifikasi";
  if (k === "429") return "batas_laju";
  return "server";
}

const BATAS_WAKTU_MS = 12_000;
const MAKS_ULANG = 3;

export type Fetcher = typeof fetch;

export interface OpsiKlien {
  fetcher?: Fetcher;
  /** Untuk uji: ganti alamat dasar (server Tuya tiruan). */
  basisOverride?: string;
  tidur?: (ms: number) => Promise<void>;
}

const tidurAsli = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class KlienTuya {
  readonly wilayah: Wilayah;
  readonly #kunci: string;
  readonly #basis: string;
  readonly #fetch: Fetcher;
  readonly #tidur: (ms: number) => Promise<void>;

  constructor(kunci: string, opsi: OpsiKlien = {}) {
    const baca = bacaKunci(kunci);
    if (!baca.ok) throw new GalatTuya("kunci_tidak_sah", null, "Bentuk kunci tidak dikenali");
    this.wilayah = baca.wilayah;
    this.#kunci = baca.kunci;
    this.#basis = (opsi.basisOverride ?? baca.wilayah.rest).replace(/\/$/, "");
    this.#fetch = opsi.fetcher ?? fetch;
    this.#tidur = opsi.tidur ?? tidurAsli;
  }

  async #minta<T>(metode: "GET" | "POST", jalur: string, opsi: { query?: Record<string, string>; badan?: unknown } = {}): Promise<T> {
    const url = new URL(this.#basis + jalur);
    for (const [k, v] of Object.entries(opsi.query ?? {})) url.searchParams.set(k, v);

    for (let percobaan = 0; ; percobaan++) {
      let res: Response;
      try {
        res = await this.#fetch(url, {
          method: metode,
          headers: {
            Authorization: `Bearer ${this.#kunci}`,
            ...(opsi.badan !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
          signal: AbortSignal.timeout(BATAS_WAKTU_MS),
          cache: "no-store",
        });
      } catch {
        if (percobaan < MAKS_ULANG - 1) {
          await this.#tidur(400 * 2 ** percobaan);
          continue;
        }
        throw new GalatTuya("jaringan", null, "Server Tuya tidak bisa dihubungi");
      }

      if (res.status === 429 || res.status >= 500) {
        if (percobaan < MAKS_ULANG - 1) {
          const ra = Number(res.headers.get("retry-after"));
          const tunggu = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 8000) : 500 * 2 ** percobaan;
          await this.#tidur(tunggu);
          continue;
        }
        throw new GalatTuya(res.status === 429 ? "batas_laju" : "server", res.status, `HTTP ${res.status}`);
      }
      if (res.status === 401 || res.status === 403) {
        throw new GalatTuya("kunci_tidak_sah", res.status, `HTTP ${res.status}`);
      }

      let badan: { success?: boolean; result?: unknown; code?: unknown; msg?: unknown };
      try {
        badan = (await res.json()) as typeof badan;
      } catch {
        throw new GalatTuya("server", res.status, "Jawaban Tuya tidak bisa dibaca");
      }
      if (!badan.success) {
        const jenis = jenisDariKode(badan.code);
        if (jenis === "batas_laju" && percobaan < MAKS_ULANG - 1) {
          await this.#tidur(800 * 2 ** percobaan);
          continue;
        }
        throw new GalatTuya(jenis, (badan.code as string | number) ?? null, String(badan.msg ?? "Tuya menolak permintaan"));
      }
      return badan.result as T;
    }
  }

  // ── Rumah & ruangan ──
  async rumah(): Promise<Rumah[]> {
    const r = await this.#minta<{ homes?: Rumah[] }>("GET", "/v1.0/end-user/homes/all");
    return r?.homes ?? [];
  }

  async ruangan(homeId: string): Promise<Ruangan[]> {
    const r = await this.#minta<{ rooms?: Ruangan[] }>("GET", `/v1.0/end-user/homes/${encodeURIComponent(homeId)}/rooms`);
    return r?.rooms ?? [];
  }

  // ── Perangkat ──
  async perangkatRumah(homeId: string): Promise<PerangkatRingkas[]> {
    const r = await this.#minta<{ devices?: PerangkatRingkas[] }>("GET", `/v1.0/end-user/homes/${encodeURIComponent(homeId)}/devices`);
    return r?.devices ?? [];
  }

  async semuaPerangkat(): Promise<PerangkatRingkas[]> {
    const r = await this.#minta<{ devices?: PerangkatRingkas[] }>("GET", "/v1.0/end-user/devices/all");
    return r?.devices ?? [];
  }

  async detail(deviceId: string): Promise<DetailPerangkat> {
    const r = await this.#minta<DetailPerangkat | null>("GET", `/v1.0/end-user/devices/${encodeURIComponent(deviceId)}/detail`);
    if (!r) throw new GalatTuya("perangkat_tak_ada", null, "Perangkat tidak ditemukan");
    return r;
  }

  async model(deviceId: string): Promise<ModelPerangkat> {
    const r = await this.#minta<{ model?: string }>("GET", `/v1.0/end-user/devices/${encodeURIComponent(deviceId)}/model`);
    if (!r?.model) throw new GalatTuya("model_tak_ada", null, "Model perangkat tidak tersedia");
    try {
      return JSON.parse(r.model) as ModelPerangkat;
    } catch {
      throw new GalatTuya("model_tak_ada", null, "Model perangkat tidak bisa dibaca");
    }
  }

  async kirimProperti(deviceId: string, properti: Record<string, unknown>): Promise<void> {
    // Tuya meminta `properties` berupa STRING JSON, bukan objek.
    await this.#minta("POST", `/v1.0/end-user/devices/${encodeURIComponent(deviceId)}/shadow/properties/issue`, {
      badan: { properties: JSON.stringify(properti) },
    });
  }

  async gantiNama(deviceId: string, nama: string): Promise<void> {
    await this.#minta("POST", `/v1.0/end-user/devices/${encodeURIComponent(deviceId)}/attribute`, { badan: { name: nama } });
  }

  // ── Lapisan darurat (PRD I6): ke nomor akun Smart Life sendiri ──
  async smsKeDiriSendiri(isi: string): Promise<void> {
    await this.#minta("POST", "/v1.0/end-user/services/sms/self-send", { badan: { message: isi } });
  }

  /** Telepon suara ke nomor akun (maks 15/hari/nomor, pesan sama maks 2 per 50 detik). */
  async teleponKeDiriSendiri(isi: string): Promise<void> {
    await this.#minta("POST", "/v1.0/end-user/services/voice/self-send", { badan: { message: isi } });
  }
}
