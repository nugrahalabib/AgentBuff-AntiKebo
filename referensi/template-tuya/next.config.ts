import type { NextConfig } from "next";

// Header keamanan NON-CSP berlaku di semua jalur. CSP ber-nonce dipasang per
// permintaan oleh src/proxy.ts - tidak di sini, supaya peramban tidak pernah
// menerima dua header CSP sekaligus (dua CSP = irisan keduanya).
const isProd = process.env.NODE_ENV === "production";

const headerKeamanan = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["pino", "ws"],
  async headers() {
    return [{ source: "/:path*", headers: headerKeamanan }];
  },
};

export default nextConfig;
