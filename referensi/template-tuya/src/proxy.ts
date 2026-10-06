import { NextResponse, type NextRequest } from "next/server";
import { kebijakanCsp } from "@/lib/keamanan/csp";

// Berkas proxy WAJIB di src/proxy.ts (proyek memakai src/): di akar repo ia
// TIDAK PERNAH dikompilasi, tanpa peringatan (pelajaran AgentBuff §0.22).
// Tugasnya hanya CSP ber-nonce per permintaan; gerbang sesi ada di layout/API.
export function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = kebijakanCsp(nonce, {
    dev: process.env.NODE_ENV === "development",
    agentbuffOrigin: process.env.AGENTBUFF_ORIGIN ?? "https://agentbuff.id",
  });
  const headerMasuk = new Headers(req.headers);
  headerMasuk.set("x-nonce", nonce);
  headerMasuk.set("Content-Security-Policy", csp);
  // Jalur saat ini untuk layout (gerbang sesi perlu tahu ke mana kembali sesudah masuk).
  headerMasuk.set("x-tuya-jalur", req.nextUrl.pathname.slice(0, 300));
  const res = NextResponse.next({ request: { headers: headerMasuk } });
  res.headers.set("Content-Security-Policy", csp);
  // no-transform: Cloudflare (zona agentbuff.id) menyisipkan skrip analitiknya ke setiap HTML
  // DAN menyalin nonce halaman, jadi CSP tidak menghentikannya. no-transform membuat Cloudflare
  // tidak mengubah halaman (pelajaran BYM 30 Sep 2026).
  // Next tidak menimpa Cache-Control yang sudah dipasang di sini (halaman dinamis).
  res.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate, no-transform");
  return res;
}

// matcher WAJIB literal: Next membacanya lewat AST saat build; nilai hasil
// impor/variabel diabaikan diam-diam (dijaga scripts/jaga.mjs).
export const config = {
  matcher: [
    {
      source: "/((?!api/|mcp$|_next/static|_next/image|favicon.ico|ikon/|vendor/|manifest.webmanifest|robots.txt|sw.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
