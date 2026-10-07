import { eq } from "drizzle-orm";
import { z } from "zod";
import { cekHak } from "@/lib/agentbuff/status";
import { tautanPerpanjang } from "@/lib/agentbuff/tautan-beku";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { alat, type DefinisiAlat, type KonteksAlat } from "./dasar";

// Alat MCP AntiKebo. Nama alat bahasa Inggris, teks jawaban bahasa pengguna, masukan
// z.strictObject. Daftar lengkap yang dituju: docs/11-ALAT-MCP.md (dibangun di P12).
// TIDAK ADA alat yang mematikan, menunda, atau menjawab alarm berbunyi (CLAUDE.md §5.2).

const tautanIzin = (k: KonteksAlat) => `${k.asal}/auth/agentbuff/start?izin=1&lanjut=${encodeURIComponent("/app/pengaturan")}`;

const getSetupStatus = alat({
  nama: "get_setup_status",
  judul: "Setup status",
  kelas: "baca",
  deskripsi:
    "Check the user's AntiKebo account: whether access is active, and whether the user granted the two AgentBuff permissions AntiKebo needs (send wake-up messages through the user's agent channels, and make scolding voice clips with the user's voice settings). Call this FIRST when unsure. Returns links to give the user.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const [p] = await db().select().from(schema.pengguna).where(eq(schema.pengguna.id, k.penggunaId)).limit(1);
    const hak = await cekHak({ id: k.penggunaId, agentbuffSub: k.agentbuffSub });
    const perpanjang = hak.aktif ? null : tautanPerpanjang(hak.alasan, env("AGENTBUFF_ORIGIN"), env("AGENTBUFF_PRODUCT_KEY"));
    const izin = { send_messages: !!p?.izinKabar, make_voice: !!p?.izinSuara };
    const kurang = [!izin.send_messages ? "kirim pesan lewat agen" : null, !izin.make_voice ? "buat suara omelan" : null].filter(Boolean);
    const baris = [
      hak.aktif ? "Akses AntiKebo aktif." : "Akses AntiKebo sedang dibekukan; alarm dan pengaturan tetap aman.",
      kurang.length
        ? `Izin AgentBuff yang belum diberi: ${kurang.join(" dan ")}. Kirim tautan ini ke pengguna supaya bisa memberi izin: ${tautanIzin(k)}`
        : "Izin kirim pesan dan buat suara omelan sudah diberi.",
    ];
    return {
      data: {
        access: hak.aktif ? "active" : "frozen",
        ...(hak.aktif ? {} : { reason: hak.alasan, renew_url: perpanjang?.startsWith("/") ? `${k.asal}${perpanjang}` : perpanjang }),
        permissions: izin,
        ...(kurang.length ? { grant_permissions_url: tautanIzin(k) } : {}),
        app_url: `${k.asal}/app`,
      },
      teks: baris.join(" "),
    };
  },
});

export const SEMUA_ALAT: DefinisiAlat[] = [getSetupStatus];

/** Alat yang tetap jalan saat akses dibekukan (supaya agen bisa menjelaskan keadaannya). */
export const ALAT_BEBAS = new Set(["get_setup_status"]);

export function cariAlat(nama: string): DefinisiAlat | undefined {
  return SEMUA_ALAT.find((a) => a.nama === nama);
}
