import { tanganiMintaToken } from "@/lib/agen/otomatis";
import { log } from "@/lib/log";

// POST /api/agentbuff/mcp-token: dipanggil AgentBuff, bukan
// peramban. Autentikasi = assertion ES256 di Authorization: Bearer. Token yang
// diterbitkan tidak pernah di-log.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const assertion = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  try {
    const { status, badan } = await tanganiMintaToken(assertion && assertion.length < 8_000 ? assertion : null);
    return Response.json(badan, { status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    log.error({ err: (e as Error)?.name }, "mcp-token gagal");
    return Response.json({ error: "server_error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
