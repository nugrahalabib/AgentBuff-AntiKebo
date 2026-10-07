import { eq } from "drizzle-orm";
import { z } from "zod";
import { cekHak } from "@/lib/agentbuff/status";
import { tautanPerpanjang } from "@/lib/agentbuff/tautan-beku";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { daftarPerangkatRumah, putuskan, simpanKunci, statusRumah } from "@/lib/layanan/tuya";
import { alat, type DefinisiAlat, type KonteksAlat } from "./dasar";

// Alat MCP AntiKebo. Nama alat bahasa Inggris, teks jawaban bahasa pengguna, masukan
// z.strictObject. Daftar lengkap yang dituju: docs/11-ALAT-MCP.md (dibangun di P12).
// TIDAK ADA alat yang mematikan, menunda, atau menjawab alarm berbunyi (CLAUDE.md §5.2).

const tautanIzin = (k: KonteksAlat) => `${k.asal}/auth/agentbuff/start?izin=1&lanjut=${encodeURIComponent("/app/pengaturan")}`;
const tautanRumah = (k: KonteksAlat) => `${k.asal}/app/rumah`;
/** Halaman masuk resmi Tuya (tujuan tombol "Get API Key" di tuya.ai/developer); langkah sama dengan template Tuya. */
const TUYA_AI = "https://auth.tuya.ai/login?loginSource=web_hey_tuya";
const LANGKAH_KUNCI = `buka ${TUYA_AI} di laptop/komputer (QR tidak bisa dipindai dari layar HP yang sama); pilih "SmartLife APP" atau "Tuya APP" (atau masuk dengan Google bila akun app-nya dibuat dengan Google, akun yang SAMA); pindai QR dari app di HP (tab Saya/Me, ikon pindai pojok kanan atas, lalu Konfirmasi); sesudah masuk halaman Hey Tuya terbuka: di menu kiri ketuk "Toolbox" lalu "API Key"; buat kunci baru (tombol Create/+, nama bebas misalnya AgentBuff); salin kunci yang diawali "sk-"`;

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
    const rumah = await statusRumah(k.penggunaId);
    baris.push(
      !rumah.tersambung
        ? `Rumah pintar (opsional) belum disambungkan; bila pengguna ingin lampu/AC ikut membangunkan: ${LANGKAH_KUNCI}, lalu tempel kuncinya di chat (panggil connect_home) atau di ${tautanRumah(k)}.`
        : rumah.bermasalah
          ? `Kunci rumah pintar sudah tidak berlaku. Minta kunci baru: ${LANGKAH_KUNCI}. Lalu tempel di chat (connect_home) atau di ${tautanRumah(k)}.`
          : `Rumah pintar tersambung (server ${rumah.wilayah.nama}), ${rumah.perangkat} perangkat.`,
    );
    return {
      data: {
        smart_home: !rumah.tersambung
          ? { connected: false, connect_url: tautanRumah(k) }
          : { connected: !rumah.bermasalah, key_problem: rumah.bermasalah, region: rumah.wilayah.nama, devices: rumah.perangkat },
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

const connectHome = alat({
  nama: "connect_home",
  judul: "Connect the Smart Life/Tuya home",
  kelas: "tulis",
  deskripsi:
    "Connect (or re-connect) the user's Smart Life/Tuya home so lights, AC and plugs can help wake them up. Use when the user pastes the key they created at tuya.ai (Toolbox > API Key, starts with 'sk-'). The key is checked with Tuya first, stored encrypted, and the home's rooms and devices are loaded. Never invent or reuse a key. Tell the user to delete the chat message containing the key afterwards.",
  masukan: z.strictObject({ key: z.string().min(10).max(300).describe("The key exactly as the user pasted it, e.g. sk-SG...") }),
  async jalankan(k, a) {
    const r = await simpanKunci(k.penggunaId, a.key, "agen");
    return {
      data: { connected: true, region: r.wilayah.nama, homes: r.rumah, rooms: r.ruangan, devices: r.perangkat, online: r.online, devices_url: tautanRumah(k) },
      teks: `Rumah tersambung (server ${r.wilayah.nama}): ${r.perangkat} perangkat, ${r.online} online. Sarankan pengguna menghapus pesan berisi kunci dari chat.`,
    };
  },
});

const listHomeDevices = alat({
  nama: "list_home_devices",
  judul: "Smart home devices",
  kelas: "baca",
  deskripsi:
    "List the user's Smart Life/Tuya devices per room, with online status and what each can do in an alarm (power, brightness, color, white temperature, AC temperature and mode). Use the device ids in alarm smart home rules.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const r = await daftarPerangkatRumah(k.penggunaId);
    const n = r.ruangan.reduce((x, y) => x + y.perangkat.length, 0);
    return {
      data: { rooms: r.ruangan.map((x) => ({ room: x.nama, devices: x.perangkat.map((p) => ({ id: p.id, name: p.nama, type: p.jenisLabel, online: p.online, can: p.bisa })) })) },
      teks: `${n} perangkat di ${r.ruangan.length} ruangan: ${r.ruangan.map((x) => `${x.nama} (${x.perangkat.map((p) => `${p.nama}${p.online ? "" : ", offline"}`).join("; ")})`).join(". ")}`,
    };
  },
});

const disconnectHome = alat({
  nama: "disconnect_home",
  judul: "Disconnect the smart home",
  kelas: "tulis",
  merusak: true,
  deskripsi:
    "Remove the Tuya key and the device list from AntiKebo. Smart home rules in alarms are kept but do nothing until a new key is connected. Only when the user explicitly asks; confirm first, then call with confirm:true.",
  masukan: z.strictObject({ confirm: z.literal(true) }),
  async jalankan(k) {
    await putuskan(k.penggunaId, "agen");
    return { data: { disconnected: true }, teks: "Rumah pintar diputus dan kuncinya dihapus dari server." };
  },
});

export const SEMUA_ALAT: DefinisiAlat[] = [getSetupStatus, connectHome, listHomeDevices, disconnectHome];

/** Alat yang tetap jalan saat akses dibekukan (supaya agen bisa menjelaskan keadaannya). */
export const ALAT_BEBAS = new Set(["get_setup_status"]);

export function cariAlat(nama: string): DefinisiAlat | undefined {
  return SEMUA_ALAT.find((a) => a.nama === nama);
}
