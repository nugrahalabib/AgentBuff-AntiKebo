import type { AlasanBeku } from "./tafsir";

// Jalan keluar dari keadaan beku, SESUAI ALASAN - satu sumber untuk layar beku
// aplikasi dan galat MCP `access_frozen` (renew_url). Relatif = jalur di aplikasi ini.
export function tautanPerpanjang(alasan: AlasanBeku | string, agentbuff: string, produk: string): string | null {
  switch (alasan) {
    case "belum_beli":
      return `${agentbuff}/app/shop?produk=${encodeURIComponent(produk)}`;
    case "akses_berakhir":
      return `${agentbuff}/checkout`;
    case "belum_aktif":
      return `${agentbuff}/app`;
    case "dicabut":
      return "/auth/agentbuff/start";
    case "diblokir":
      return `${agentbuff}/bantuan`;
    case "tidak_terjangkau":
      return "/api/hak/periksa";
    default:
      return null;
  }
}
