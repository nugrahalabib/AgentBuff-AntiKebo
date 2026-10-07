import { z } from "zod";
import { isi } from "@/lib/i18n";
import { aturDarurat, daftarPerangkatRumah, putuskan, simpanKunci, sinkronkanPengguna, statusRumah, ujiPerangkat, type DaruratTuya } from "@/lib/layanan/tuya";
import { alat, type KonteksAlat } from "../dasar";
import { tautan } from "./umum";

// Rumah pintar Smart Life/Tuya (PRD I). Aturan perangkat per alarm diatur lewat create_alarm /
// update_alarm (smart_home). Kunci `sk-` hanya diterima dari tempelan pengguna, disimpan tersandi.

/** Halaman masuk resmi Tuya (tujuan tombol "Get API Key" di tuya.ai/developer); langkah sama dengan template Tuya. */
const TUYA_AI = "https://auth.tuya.ai/login?loginSource=web_hey_tuya";
export const langkahKunci = (k: KonteksAlat) => isi(k.t.mcp.langkahKunci, { url: TUYA_AI, rumah: tautan.rumah(k) });

function teksDarurat(k: KonteksAlat, d: DaruratTuya): string {
  return d.aktif ? isi(k.t.mcp.daruratNyala, { cara: d.cara === "sms" ? k.t.rumah.darurat.sms : k.t.rumah.darurat.telepon, menit: d.menit }) : k.t.mcp.daruratMati;
}

const getHomeStatus = alat({
  nama: "get_home_status",
  judul: "Smart home status",
  kelas: "baca",
  deskripsi: "Whether the Smart Life/Tuya home is connected, its server region, device count, key problems, and the hidden emergency layer setting.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const r = await statusRumah(k.penggunaId);
    if (!r.tersambung) return { data: { connected: false, connect_url: tautan.rumah(k) }, teks: `${k.t.mcp.rumahStatusBelum} ${langkahKunci(k)}` };
    return {
      data: { connected: !r.bermasalah, key_problem: r.bermasalah, region: r.wilayah.nama, devices: r.perangkat, emergency: r.darurat, devices_url: tautan.rumah(k) },
      teks: r.bermasalah
        ? `${k.t.mcp.rumahBermasalah} ${langkahKunci(k)}`
        : `${isi(k.t.mcp.rumahStatus, { wilayah: r.wilayah.nama, n: r.perangkat })} ${isi(k.t.mcp.rumahDarurat, { status: teksDarurat(k, r.darurat) })}`,
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
      data: { connected: true, region: r.wilayah.nama, homes: r.rumah, rooms: r.ruangan, devices: r.perangkat, online: r.online, devices_url: tautan.rumah(k) },
      teks: isi(k.t.mcp.rumahTersambung, { wilayah: r.wilayah.nama, n: r.perangkat, online: r.online }),
    };
  },
});

const listHomeDevices = alat({
  nama: "list_home_devices",
  judul: "Smart home devices",
  kelas: "baca",
  deskripsi:
    "List the user's Smart Life/Tuya devices per room, with online status and what each can do in an alarm (power, brightness, color, white temperature, AC temperature and mode). Use the device ids in alarm smart_home rules.",
  masukan: z.strictObject({ refresh: z.boolean().optional().describe("Reload the list from Tuya first (after adding a device in the Smart Life app)") }),
  async jalankan(k, m) {
    if (m.refresh) await sinkronkanPengguna(k.penggunaId);
    const r = await daftarPerangkatRumah(k.penggunaId);
    const n = r.ruangan.reduce((x, y) => x + y.perangkat.length, 0);
    return {
      data: { rooms: r.ruangan.map((x) => ({ room: x.nama, devices: x.perangkat.map((p) => ({ id: p.id, name: p.nama, type: p.jenisLabel, online: p.online, can: p.bisa })) })) },
      teks: isi(k.t.mcp.rumahPerangkat, {
        n,
        r: r.ruangan.length,
        isi: r.ruangan.map((x) => `${x.nama} (${x.perangkat.map((p) => `${p.nama}${p.online ? "" : `, ${k.t.mcp.offline}`}`).join("; ")})`).join(". "),
      }),
    };
  },
});

const testHomeDevice = alat({
  nama: "test_home_device",
  judul: "Test a smart home device",
  kelas: "tulis",
  deskripsi: "Briefly switch one device on (full brightness for lights) and back to how it was, to check it responds before relying on it in an alarm.",
  masukan: z.strictObject({ device_id: z.string().min(1).max(64).describe("From list_home_devices") }),
  async jalankan(k, m) {
    const r = await ujiPerangkat(k.penggunaId, m.device_id);
    return { data: { status: r.status === "terkonfirmasi" ? "confirmed" : r.status === "belum_terkonfirmasi" ? "unconfirmed" : "sent" }, teks: r.pesan };
  },
});

const setHomeEmergency = alat({
  nama: "set_home_emergency",
  judul: "Smart home emergency layer",
  kelas: "tulis",
  deskripsi:
    "Turn the hidden emergency layer on or off: if the user still has not solved the challenge after X minutes, the user's Tuya account calls or texts them (Tuya's own alert). Off by default; only for a connected home.",
  masukan: z.strictObject({
    enabled: z.boolean(),
    after_minutes: z.int().min(5).max(60).optional().describe("Default 15"),
    method: z.enum(["call", "sms"]).optional().describe("Default call"),
  }),
  async jalankan(k, m) {
    const d = await aturDarurat(k.penggunaId, { aktif: m.enabled, menit: m.after_minutes ?? 15, cara: m.method === "sms" ? "sms" : "telepon" }, "agen");
    return {
      data: { emergency: { enabled: d.aktif, after_minutes: d.menit, method: d.cara === "sms" ? "sms" : "call" } },
      teks: isi(k.t.mcp.daruratDisimpan, { status: teksDarurat(k, d) }),
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
    return { data: { disconnected: true }, teks: k.t.mcp.rumahDiputus };
  },
});

export const ALAT_RUMAH = [getHomeStatus, connectHome, listHomeDevices, testHomeDevice, setHomeEmergency, disconnectHome];
