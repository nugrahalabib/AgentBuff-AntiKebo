import type { MetadataRoute } from "next";

/**
 * Manifest PWA (P9, PRD H2): AntiKebo bisa dipasang ke layar utama HP/tablet/laptop dan dibuka
 * tanpa bilah peramban. Ikon dibuat `scripts/bangun-ikon.ts`. Pintasan langsung ke Mode Jam Meja.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "AntiKebo",
    short_name: "AntiKebo",
    description: "Alarm yang tidak berhenti sampai kamu benar-benar bangun.",
    lang: "id",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#07070d",
    theme_color: "#07070d",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/ikon/ikon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/ikon/ikon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/ikon/ikon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Mode Jam Meja", short_name: "Jam Meja", url: "/app/jam-meja", icons: [{ src: "/ikon/ikon-192.png", sizes: "192x192" }] }],
  };
}
