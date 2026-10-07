import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

// Server Tuya end-user TIRUAN (disalin dari template AgentBuff-Tuya, dipangkas untuk AntiKebo):
// bentuk jawaban mengikuti references/*.md resmi (tuya-openclaw-skills). Merekam setiap perintah
// berikut waktunya, menolak kunci yang dicabut, menolak perangkat offline (kode asli 40000801), dan
// bisa membuat perangkat "menerima tapi tidak menjalankan" perintah (uji konfirmasi, PRD I4).
// Dipakai uji integrasi dan `pnpm tiruan` (port TUYA_BASIS_UJI) untuk pengembangan/e2e.

type Alat = { id: string; nama: string; kategori: string; room: string | null; online: boolean; properti: Record<string, unknown>; model: unknown };

const p = (code: string, typeSpec: unknown, accessMode = "rw") => ({ code, accessMode, typeSpec, name: code });
export const MODEL = {
  lampu: {
    services: [
      {
        properties: [
          p("switch_led", { type: "bool" }),
          p("work_mode", { type: "enum", range: ["white", "colour"] }),
          p("bright_value_v2", { type: "value", min: 10, max: 1000, step: 1, scale: 0 }),
          p("temp_value_v2", { type: "value", min: 0, max: 1000, step: 1, scale: 0 }),
          p("colour_data_v2", { type: "string" }),
        ],
      },
    ],
  },
  ac: {
    services: [
      {
        properties: [
          p("switch", { type: "bool" }),
          p("temp_set", { type: "value", min: 160, max: 300, step: 5, scale: 1 }),
          p("temp_current", { type: "value", min: 0, max: 500, step: 1, scale: 1 }, "ro"),
          p("mode", { type: "enum", range: ["cold", "hot", "auto", "wind"] }),
        ],
      },
    ],
  },
  colokan: { services: [{ properties: [p("switch_1", { type: "bool" }), p("cur_power", { type: "value", min: 0, max: 99999, step: 1, scale: 1 }, "ro")] }] },
  pintu: { services: [{ properties: [p("doorcontact_state", { type: "bool" }, "ro"), p("battery_percentage", { type: "value", min: 0, max: 100, step: 1, scale: 0 }, "ro")] }] },
};

export type TuyaTiruan = {
  url: string;
  tutup(): Promise<void>;
  /** Setiap perintah yang DITERIMA server (termasuk yang diabaikan perangkat), dengan waktu. */
  perintah: Array<{ id: string; properti: Record<string, unknown>; waktu: number }>;
  alat: Alat[];
  kunciDitolak: Set<string>;
  /** Telepon/SMS/push ke diri sendiri (lapisan darurat). */
  pesan: Array<{ jalur: string; badan: Record<string, unknown> }>;
  /** Perangkat yang MENERIMA perintah di server tapi tidak menjalankannya (keadaan tidak berubah). */
  abaikan: Set<string>;
  /** Kembalikan semua perangkat ke keadaan awal (antar uji). */
  setelUlang(): void;
};

function alatAwal(): Alat[] {
  return [
    {
      id: "lampu1",
      nama: "Lampu Kamar",
      kategori: "dj",
      room: "r1",
      online: true,
      properti: { switch_led: false, work_mode: "white", bright_value_v2: 500, temp_value_v2: 300 },
      model: MODEL.lampu,
    },
    {
      id: "lampu2",
      nama: "Lampu Plafon",
      kategori: "dj",
      room: "r1",
      online: true,
      properti: { switch_led: true, work_mode: "white", bright_value_v2: 1000, temp_value_v2: 0 },
      model: MODEL.lampu,
    },
    { id: "ac1", nama: "AC Kamar", kategori: "kt", room: "r1", online: true, properti: { switch: false, temp_set: 260, temp_current: 291, mode: "auto" }, model: MODEL.ac },
    { id: "plug1", nama: "Colokan Kipas", kategori: "cz", room: "r2", online: true, properti: { switch_1: false, cur_power: 0 }, model: MODEL.colokan },
    { id: "plug2", nama: "Dispenser", kategori: "cz", room: null, online: false, properti: { switch_1: true, cur_power: 420 }, model: MODEL.colokan },
    { id: "pintu1", nama: "Sensor Pintu", kategori: "mcs", room: "r2", online: true, properti: { doorcontact_state: false, battery_percentage: 80 }, model: MODEL.pintu },
  ];
}

export async function mulaiTuyaTiruan(opsi: { port?: number } = {}): Promise<TuyaTiruan> {
  const alat = alatAwal();
  const abaikan = new Set<string>();
  const pesan: TuyaTiruan["pesan"] = [];
  const perintah: TuyaTiruan["perintah"] = [];
  const kunciDitolak = new Set<string>();

  const server: Server = createServer((req, res) => {
    const kirim = (badan: unknown, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(badan));
    };
    const kunci = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    const j = new URL(req.url ?? "/", "http://x").pathname;
    let badan = "";
    req.on("data", (c) => (badan += c));
    req.on("end", () => {
      const cocok = (re: RegExp) => re.exec(j);
      // Kendali uji e2e (`pnpm tiruan`): tolak kunci, setel ulang, lihat perintah.
      if (j === "/_tiruan/tolak") {
        kunciDitolak.add(String((JSON.parse(badan || "{}") as { kunci?: string }).kunci ?? ""));
        return kirim({ ok: true });
      }
      if (j === "/_tiruan/setel-ulang") {
        alat.splice(0, alat.length, ...alatAwal());
        abaikan.clear();
        kunciDitolak.clear();
        perintah.length = 0;
        pesan.length = 0;
        return kirim({ ok: true });
      }
      if (j === "/_tiruan/perintah") return kirim({ perintah });
      if (kunciDitolak.has(kunci)) return kirim({ success: false, code: 1010, msg: "token invalid" });
      if (j === "/v1.0/end-user/homes/all") return kirim({ success: true, result: { homes: [{ home_id: "h1", name: "Rumah Uji", role: "owner" }] } });
      if (j === "/v1.0/end-user/homes/h1/rooms")
        return kirim({
          success: true,
          result: {
            rooms: [
              { room_id: "r1", name: "Kamar" },
              { room_id: "r2", name: "Ruang Tamu" },
            ],
          },
        });
      if (j === "/v1.0/end-user/homes/h1/devices")
        return kirim({
          success: true,
          result: { devices: alat.map((a) => ({ device_id: a.id, name: a.nama, category: a.kategori, online: a.online, ...(a.room ? { room_id: a.room } : {}) })) },
        });
      let m = cocok(/^\/v1\.0\/end-user\/devices\/([^/]+)\/detail$/);
      if (m) {
        const a = alat.find((x) => x.id === m![1]);
        return kirim({ success: true, result: a ? { device_id: a.id, name: a.nama, category: a.kategori, online: a.online, properties: a.properti } : null });
      }
      m = cocok(/^\/v1\.0\/end-user\/devices\/([^/]+)\/model$/);
      if (m) {
        const a = alat.find((x) => x.id === m![1]);
        return a ? kirim({ success: true, result: { model: JSON.stringify(a.model) } }) : kirim({ success: false, code: 40000901, msg: "The device does not exist" });
      }
      m = cocok(/^\/v1\.0\/end-user\/devices\/([^/]+)\/shadow\/properties\/issue$/);
      if (m) {
        const a = alat.find((x) => x.id === m![1]);
        const props = JSON.parse(JSON.parse(badan).properties as string) as Record<string, unknown>;
        // Tuya menolak perintah ke perangkat offline (kode asli, diukur 2026-10-03).
        if (a && !a.online) return kirim({ success: false, code: 40000801, msg: "device offline" });
        perintah.push({ id: m[1], properti: props, waktu: Date.now() });
        if (a && !abaikan.has(a.id)) Object.assign(a.properti, props);
        return kirim({ success: true, result: {} });
      }
      if (/^\/v1\.0\/end-user\/services\/(push|sms|voice)\/self-send$/.test(j)) {
        pesan.push({ jalur: j, badan: JSON.parse(badan) });
        return kirim({ success: true, result: true });
      }
      kirim({ success: false, code: 1108, msg: "uri path invalid" });
    });
  });
  await new Promise<void>((r) => server.listen(opsi.port ?? 0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    tutup: () => new Promise((r) => server.close(() => r())),
    perintah,
    alat,
    kunciDitolak,
    pesan,
    abaikan,
    setelUlang() {
      alat.splice(0, alat.length, ...alatAwal());
      abaikan.clear();
      kunciDitolak.clear();
      perintah.length = 0;
      pesan.length = 0;
    },
  };
}
