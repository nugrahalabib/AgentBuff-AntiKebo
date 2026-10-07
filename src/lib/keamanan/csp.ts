// Kebijakan CSP: satu sumber, dipakai src/proxy.ts. Semua aset disajikan
// sendiri (tanpa CDN), jadi daftar host cukup 'self'. 'unsafe-eval' HANYA saat
// dev (React memakai eval untuk jejak galat).

export function kebijakanCsp(nonce: string, opsi: { dev: boolean; agentbuffOrigin: string }): string {
  const skrip = [`'self'`, `'nonce-${nonce}'`, ...(opsi.dev ? [`'unsafe-eval'`] : [])];
  const arahan: Record<string, string[]> = {
    "default-src": [`'self'`],
    "script-src": skrip,
    "style-src": [`'self'`, `'unsafe-inline'`],
    "img-src": [`'self'`, "data:", "blob:"],
    "media-src": [`'self'`, "blob:"],
    "font-src": [`'self'`],
    "connect-src": [`'self'`, ...(opsi.dev ? ["ws:"] : [])],
    "worker-src": [`'self'`, "blob:"],
    "manifest-src": [`'self'`],
    "frame-ancestors": [`'none'`],
    "form-action": [`'self'`, opsi.agentbuffOrigin],
    "object-src": [`'none'`],
    "base-uri": [`'self'`],
  };
  return Object.entries(arahan)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}
