import { mulaiAgentBuffTiruan } from "./agentbuff";

// `pnpm tiruan`: server tiruan AgentBuff untuk pengembangan (membaca .env.local).
// Port diambil dari AGENTBUFF_TIRUAN_URL atau AGENTBUFF_ISSUER bila keduanya http lokal, selain itu 3199.

function portDari(url: string | undefined): number | null {
  try {
    const u = new URL(url ?? "");
    return u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost") ? Number(u.port || 80) : null;
  } catch {
    return null;
  }
}

async function utama() {
  const clientId = process.env.AGENTBUFF_MASUK_CLIENT_ID;
  const clientSecret = process.env.AGENTBUFF_MASUK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("AGENTBUFF_MASUK_CLIENT_ID/SECRET wajib (jalankan bash scripts/siapkan-lokal.sh)");
  const port = portDari(process.env.AGENTBUFF_TIRUAN_URL) ?? portDari(process.env.AGENTBUFF_ISSUER) ?? 3199;
  const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3100";
  const t = await mulaiAgentBuffTiruan({
    clientId,
    clientSecret,
    port,
    appOrigin,
    redirectUris: [`${appOrigin}/auth/agentbuff/callback`],
    kenalSemua: true,
  });
  console.log(`server tiruan AgentBuff menyala: ${t.issuer} (redirect ${appOrigin}/auth/agentbuff/callback)`);
  for (const sinyal of ["SIGINT", "SIGTERM"] as const) process.on(sinyal, () => void t.tutup().then(() => process.exit(0)));
}

utama().catch((e) => {
  console.error("server tiruan gagal menyala:", (e as Error)?.message ?? e);
  process.exit(1);
});
