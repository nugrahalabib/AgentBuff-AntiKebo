// Env AntiKebo. Aplikasi MENOLAK menyala bila ada yang wajib kosong, dengan pesan
// jelas, TANPA pernah mencetak nilainya. Daftar lengkap: docs/03-ARSITEKTUR.md §12.

const WAJIB_WEB = [
  "DATABASE_URL",
  "APP_ORIGIN",
  "SESSION_SECRET",
  "ENCRYPTION_KEK",
  "AGENTBUFF_ISSUER",
  "AGENTBUFF_ORIGIN",
  "AGENTBUFF_PRODUCT_KEY",
  "AGENTBUFF_MASUK_CLIENT_ID",
  "AGENTBUFF_MASUK_CLIENT_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
] as const;

const WAJIB_WORKER = [
  "DATABASE_URL",
  "APP_ORIGIN",
  "ENCRYPTION_KEK",
  "AGENTBUFF_ISSUER",
  "AGENTBUFF_MASUK_CLIENT_ID",
  "AGENTBUFF_MASUK_CLIENT_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
] as const;

/**
 * Belum wajib; menjadi wajib saat fiturnya dibangun (VAPID wajib sejak P6). `UNDUH_DIR` = folder pemasang
 * aplikasi PC (P10, bawaan `./unduh`).
 * Daftar ini juga dibaca penjaga `env-contoh` (scripts/jaga.mjs) untuk memastikan .env.example lengkap.
 */
export const OPSIONAL = [
  "DATABASE_URL_MIGRASI",
  "DATABASE_URL_WORKER",
  "LOG_LEVEL",
  "ANTIKEBO_HAK_LAJU_PER_DTK",
  "AGENTBUFF_TIRUAN",
  "AGENTBUFF_TIRUAN_URL",
  "TUYA_BASIS_UJI",
  "OPERATOR_KABAR",
  "UNDUH_DIR",
] as const;

export type NamaEnv = (typeof WAJIB_WEB)[number] | (typeof WAJIB_WORKER)[number] | (typeof OPSIONAL)[number];

export function env(nama: NamaEnv): string {
  const v = process.env[nama];
  if (!v || !v.trim()) throw new Error(`Env ${nama} wajib diisi`);
  return v.trim();
}

export function envOpsional(nama: NamaEnv): string | null {
  const v = process.env[nama];
  return v && v.trim() ? v.trim() : null;
}

/** `AGENTBUFF_TIRUAN=1`: pintu kanal/pesan/suara (dan boleh juga masuk) memakai server tiruan. Hanya pengembangan. */
export function modeTiruan(): boolean {
  return process.env.AGENTBUFF_TIRUAN === "1";
}

const LOKAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostLokal(url: string | undefined): boolean {
  try {
    return LOKAL.has(new URL(url ?? "").hostname);
  } catch {
    return false;
  }
}

export function periksaEnv(peran: "web" | "worker"): void {
  const daftar = peran === "web" ? WAJIB_WEB : WAJIB_WORKER;
  const kosong = daftar.filter((n) => !process.env[n] || !process.env[n]!.trim());
  if (kosong.length) {
    throw new Error(`AntiKebo tidak bisa menyala: env wajib kosong: ${kosong.join(", ")}`);
  }
  if (Buffer.from(process.env.SESSION_SECRET ?? "", "utf8").length < 32 && peran === "web") {
    throw new Error("AntiKebo tidak bisa menyala: SESSION_SECRET minimal 32 karakter");
  }
  // Server tiruan hanya untuk mesin pengembang: produksi yang tidak sengaja memakai
  // tiruan akan "mengirim" spam dan suara ke tempat yang tidak ada.
  if (modeTiruan() && !hostLokal(process.env.APP_ORIGIN)) {
    throw new Error("AntiKebo tidak bisa menyala: AGENTBUFF_TIRUAN=1 hanya boleh dengan APP_ORIGIN localhost");
  }
  if (!modeTiruan() && !process.env.AGENTBUFF_ISSUER!.trim().startsWith("https://")) {
    throw new Error("AntiKebo tidak bisa menyala: AGENTBUFF_ISSUER wajib https (kecuali AGENTBUFF_TIRUAN=1)");
  }
}
