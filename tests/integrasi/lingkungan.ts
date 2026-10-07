import { randomBytes } from "node:crypto";
import { mulaiAgentBuffTiruan, type AgentBuffTiruan, type OpsiTiruan } from "../tiruan/agentbuff";

// Lingkungan uji: env aplikasi yang lengkap dan server tiruan AgentBuff di port acak.
// Tidak pernah menyentuh .env.local atau AgentBuff asli.

export const KLIEN = { id: "antikebo-uji", rahasia: randomBytes(18).toString("hex") };
export const ASAL_APP = "http://localhost:3100";

export async function siapkanTiruan(opsi: Partial<OpsiTiruan> = {}): Promise<AgentBuffTiruan> {
  const t = await mulaiAgentBuffTiruan({ clientId: KLIEN.id, clientSecret: KLIEN.rahasia, appOrigin: ASAL_APP, ...opsi });
  Object.assign(process.env, {
    APP_ORIGIN: ASAL_APP,
    SESSION_SECRET: randomBytes(32).toString("hex"),
    ENCRYPTION_KEK: randomBytes(32).toString("base64"),
    AGENTBUFF_ISSUER: t.issuer,
    AGENTBUFF_ORIGIN: t.url,
    AGENTBUFF_PRODUCT_KEY: "antikebo",
    AGENTBUFF_MASUK_CLIENT_ID: KLIEN.id,
    AGENTBUFF_MASUK_CLIENT_SECRET: KLIEN.rahasia,
    AGENTBUFF_TIRUAN: "1",
    AGENTBUFF_TIRUAN_URL: t.issuer,
    LOG_LEVEL: "silent",
    // Batas laju cek hak per proses (bawaan 4/dtk) dilonggarkan: tes memanggil beruntun.
    ANTIKEBO_HAK_LAJU_PER_DTK: "1000",
  });
  return t;
}
