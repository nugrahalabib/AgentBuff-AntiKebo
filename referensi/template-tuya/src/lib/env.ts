// Env wajib. Aplikasi MENOLAK menyala bila ada yang kosong, dengan pesan
// jelas, TANPA pernah mencetak nilainya.

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
] as const;

const WAJIB_WORKER = [
  "DATABASE_URL",
  "APP_ORIGIN",
  "ENCRYPTION_KEK",
  "AGENTBUFF_ISSUER",
  "AGENTBUFF_MASUK_CLIENT_ID",
  "AGENTBUFF_MASUK_CLIENT_SECRET",
] as const;

export type NamaEnv = (typeof WAJIB_WEB)[number] | (typeof WAJIB_WORKER)[number] | "LOG_LEVEL" | "TUYA_BASIS_UJI";

export function env(nama: NamaEnv): string {
  const v = process.env[nama];
  if (!v || !v.trim()) throw new Error(`Env ${nama} wajib diisi`);
  return v.trim();
}

export function envOpsional(nama: NamaEnv): string | null {
  const v = process.env[nama];
  return v && v.trim() ? v.trim() : null;
}

export function periksaEnv(peran: "web" | "worker"): void {
  const daftar = peran === "web" ? WAJIB_WEB : WAJIB_WORKER;
  const kosong = daftar.filter((n) => !process.env[n] || !process.env[n]!.trim());
  if (kosong.length) {
    throw new Error(`Tuya MCP tidak bisa menyala: env wajib kosong: ${kosong.join(", ")}`);
  }
  if (Buffer.from(process.env.SESSION_SECRET ?? "", "utf8").length < 32 && peran === "web") {
    throw new Error("Tuya MCP tidak bisa menyala: SESSION_SECRET minimal 32 karakter");
  }
}
