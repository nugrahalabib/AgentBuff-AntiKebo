import { mulaiAgentBuffTiruan } from "./agentbuff";
import { mulaiTuyaTiruan } from "./tuya";

// `pnpm tiruan`: server tiruan AgentBuff + Tuya untuk pengembangan (membaca .env.local).
// Port AgentBuff dari AGENTBUFF_TIRUAN_URL atau AGENTBUFF_ISSUER bila keduanya http lokal, selain
// itu 3199. Port Tuya dari TUYA_BASIS_UJI (bawaan 3198). Kunci Tuya tiruan: sk-SG + huruf/angka bebas.

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
  const tuya = await mulaiTuyaTiruan({ port: portDari(process.env.TUYA_BASIS_UJI) ?? 3198 });
  console.log(`server tiruan AgentBuff menyala: ${t.issuer} (redirect ${appOrigin}/auth/agentbuff/callback)`);
  console.log(`server tiruan Tuya menyala: ${tuya.url}`);
  for (const sinyal of ["SIGINT", "SIGTERM"] as const) process.on(sinyal, () => void Promise.all([t.tutup(), tuya.tutup()]).then(() => process.exit(0)));
}

utama().catch((e) => {
  console.error("server tiruan gagal menyala:", (e as Error)?.message ?? e);
  process.exit(1);
});
