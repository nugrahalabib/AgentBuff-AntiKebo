import { layaniMcp } from "@/lib/mcp/server";

// Server MCP Tuya - https://tuya.agentbuff.id/mcp. Streamable HTTP stateless
// lewat SDK resmi; autentikasi & batas di src/lib/mcp/server.ts. GET/DELETE ikut
// dilayani supaya klien lama menerima 405/401 yang benar, bukan 404 Next.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return layaniMcp(req);
}
export async function GET(req: Request) {
  return layaniMcp(req);
}
export async function DELETE(req: Request) {
  return layaniMcp(req);
}
