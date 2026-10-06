import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

// Server Tuya end-user TIRUAN untuk uji integrasi: bentuk jawaban mengikuti
// references/*.md resmi (tuya-openclaw-skills). Merekam setiap perintah.

type Alat = { id: string; nama: string; kategori: string; room: string | null; online: boolean; properti: Record<string, unknown>; model: unknown };

const p = (code: string, typeSpec: unknown, accessMode = "rw") => ({ code, accessMode, typeSpec, name: code });
export const MODEL = {
  lampu: { services: [{ properties: [p("switch_led", { type: "bool" }), p("work_mode", { type: "enum", range: ["white", "colour"] }), p("bright_value_v2", { type: "value", min: 10, max: 1000, step: 1, scale: 0 }), p("temp_value_v2", { type: "value", min: 0, max: 1000, step: 1, scale: 0 }), p("colour_data_v2", { type: "string" })] }] },
  ac: { services: [{ properties: [p("switch", { type: "bool" }), p("temp_set", { type: "value", min: 160, max: 300, step: 5, scale: 1 }), p("temp_current", { type: "value", min: 0, max: 500, step: 1, scale: 1 }, "ro"), p("mode", { type: "enum", range: ["cold", "hot", "auto", "wind"] })] }] },
  colokan: { services: [{ properties: [p("switch_1", { type: "bool" }), p("cur_power", { type: "value", min: 0, max: 99999, step: 1, scale: 1 }, "ro")] }] },
  pemanas: { services: [{ properties: [p("switch", { type: "bool" }), p("temp_set", { type: "value", min: 5, max: 35, step: 1, scale: 0 })] }] },
  pintu: { services: [{ properties: [p("doorcontact_state", { type: "bool" }, "ro"), p("battery_percentage", { type: "value", min: 0, max: 100, step: 1, scale: 0 }, "ro")] }] },
  kamera: { services: [{ properties: [p("basic_flip", { type: "bool" })] }] },
  // Bentuk ASLI dari rumah pengguna pertama: AC lewat remote IR (qt) + pemancarnya (wnykq).
  acIr: {
    services: [
      {
        properties: [
          p("control", { type: "enum", range: ["send_ir", "study", "study_exit", "study_key"] }, "wr"),
          p("key_code", { type: "string", maxlen: 255 }),
          p("type", { type: "value", min: 0, max: 255, step: 1, scale: 0 }),
          p("switch_power", { type: "bool" }),
          p("mode", { type: "enum", range: ["0", "1", "2", "3", "4"] }),
          p("temperature", { type: "value", min: 10, max: 40, step: 1, scale: 0 }),
          p("fan", { type: "enum", range: ["0", "1", "2", "3"] }),
          p("swing", { type: "bool" }),
          p("ir_send", { type: "string", maxlen: 3072 }),
        ],
      },
    ],
  },
  pemancar: { services: [{ properties: [p("ir_send", { type: "string", maxlen: 3072 }), p("ir_study_code", { type: "raw", maxlen: 128 }, "ro")] }] },
  // Kategori yang tidak dimiliki pengguna pertama, kode dari Standard Instruction Set Tuya.
  cctv: {
    services: [
      {
        properties: [
          p("basic_private", { type: "bool" }),
          p("basic_nightvision", { type: "enum", range: ["0", "1", "2"] }),
          p("motion_switch", { type: "bool" }),
          p("motion_sensitivity", { type: "enum", range: ["0", "1", "2"] }),
          p("record_switch", { type: "bool" }),
          p("ptz_control", { type: "enum", range: ["0", "1", "2", "3", "4", "5", "6", "7"] }, "wr"),
          p("ptz_stop", { type: "bool" }, "wr"),
          p("sd_status", { type: "value", min: 1, max: 5, step: 1, scale: 0 }, "ro"),
        ],
      },
    ],
  },
  vakum: {
    services: [
      {
        properties: [
          p("power_go", { type: "bool" }),
          p("mode", { type: "enum", range: ["standby", "smart", "wall_follow", "spiral", "chargego"] }),
          p("direction_control", { type: "enum", range: ["forward", "backward", "turn_left", "turn_right", "stop"] }, "wr"),
          p("suction", { type: "enum", range: ["gentle", "normal", "strong"] }),
          p("electricity_left", { type: "value", min: 0, max: 100, step: 1, scale: 0, unit: "%" }, "ro"),
          p("fault", { type: "bitmap", label: ["edge_sweep", "middle_sweep", "left_wheel"] }, "ro"),
        ],
      },
    ],
  },
  co2: { services: [{ properties: [p("co2_value", { type: "value", min: 0, max: 5000, step: 1, scale: 0, unit: "ppm" }, "ro"), p("co2_state", { type: "enum", range: ["alarm", "normal"] }, "ro")] }] },
};

export type Tiruan = {
  url: string;
  tutup(): Promise<void>;
  perintah: Array<{ id: string; properti: Record<string, unknown> }>;
  alat: Alat[];
  kunciDitolak: Set<string>;
  pesan: Array<{ jalur: string; badan: Record<string, unknown> }>;
  /** Perangkat yang MENERIMA perintah di server tapi tidak menjalankannya (keadaan tidak berubah). */
  abaikan: Set<string>;
  /** Berapa kali `resolve` menjawab NOT_READY sebelum tautan siap. */
  tangkapanBelumSiap: { sisa: number };
  /** Awan "Tuya" menyajikan isi yang bukan gambar (uji penyalinan ditolak). */
  awanRusak: { aktif: boolean };
  /** Berapa kali berkas foto/klip diunduh dari awan tiruan. */
  unduhan: string[];
};

/** JPEG 1x1 sungguhan + MP4 kecil berkop ftyp: penyalin memeriksa isi, bukan header. */
export const JPEG_UJI = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);
export const MP4_UJI = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(64, 7)]);

export async function mulaiTuyaTiruan(): Promise<Tiruan> {
  const alat: Alat[] = [
    { id: "lampu1", nama: "Lampu Meja", kategori: "dj", room: "r1", online: true, properti: { switch_led: false, work_mode: "white", bright_value_v2: 500 }, model: MODEL.lampu },
    { id: "lampu2", nama: "Lampu Plafon", kategori: "dj", room: "r1", online: true, properti: { switch_led: true, work_mode: "white", bright_value_v2: 1000 }, model: MODEL.lampu },
    { id: "ac1", nama: "AC Studio", kategori: "kt", room: "r2", online: true, properti: { switch: false, temp_set: 260, temp_current: 291, mode: "auto" }, model: MODEL.ac },
    { id: "plug1", nama: "Dispenser", kategori: "cz", room: null, online: false, properti: { switch_1: true, cur_power: 420 }, model: MODEL.colokan },
    { id: "heat1", nama: "Pemanas Air", kategori: "qn", room: "r2", online: true, properti: { switch: false, temp_set: 20 }, model: MODEL.pemanas },
    { id: "pintu1", nama: "Sensor Pintu", kategori: "mcs", room: "r1", online: true, properti: { doorcontact_state: false, battery_percentage: 80 }, model: MODEL.pintu },
    { id: "cam1", nama: "Kamera Teras", kategori: "sp", room: null, online: true, properti: { basic_flip: false }, model: MODEL.kamera },
    { id: "acir1", nama: "AC Kamar", kategori: "qt", room: "r1", online: true, properti: { fan: "0", mode: "0", type: 0, swing: false, control: "send_ir", temperature: 16, switch_power: false }, model: MODEL.acIr },
    { id: "cctv1", nama: "CCTV Garasi", kategori: "sp", room: null, online: true, properti: { basic_private: false, basic_nightvision: "0", motion_switch: true, motion_sensitivity: "1", record_switch: true, sd_status: 1 }, model: MODEL.cctv },
    { id: "vakum1", nama: "Robot Vakum", kategori: "sd", room: null, online: true, properti: { power_go: false, mode: "standby", suction: "normal", electricity_left: 87, fault: 0 }, model: MODEL.vakum },
    { id: "co2a", nama: "Sensor CO2", kategori: "co2bj", room: "r1", online: true, properti: { co2_value: 600, co2_state: "normal" }, model: MODEL.co2 },
    { id: "hub1", nama: "Remote", kategori: "wnykq", room: "r1", online: true, properti: { ir_send: '{"control":"study"}', ir_study_code: "KwEwdQ==" }, model: MODEL.pemancar },
  ];
  const abaikan = new Set<string>();
  const pesan: Tiruan["pesan"] = [];
  const tangkapanBelumSiap = { sisa: 1 };
  const awanRusak = { aktif: false };
  const unduhan: string[] = [];
  const perintah: Tiruan["perintah"] = [];
  const kunciDitolak = new Set<string>();

  const server: Server = createServer((req, res) => {
    const kirim = (badan: unknown, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(badan));
    };
    const kunci = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (kunciDitolak.has(kunci)) return kirim({ success: false, code: 1010, msg: "token invalid" });
    const url = new URL(req.url ?? "/", "http://x");
    const j = url.pathname;
    let badan = "";
    req.on("data", (c) => (badan += c));
    req.on("end", () => {
      const cocok = (re: RegExp) => re.exec(j);
      // Awan penyimpanan tiruan (decrypt_*_url menunjuk ke sini).
      if (j.startsWith("/awan/")) {
        unduhan.push(j);
        if (awanRusak.aktif) {
          res.writeHead(200, { "content-type": "text/html" });
          return res.end("<html>bukan gambar</html>");
        }
        const isi = j.endsWith(".mp4") ? MP4_UJI : JPEG_UJI;
        res.writeHead(200, { "content-type": "application/octet-stream", "content-length": String(isi.length) });
        return res.end(isi);
      }
      if (j === "/v1.0/end-user/homes/all") return kirim({ success: true, result: { homes: [{ home_id: "h1", name: "Rumah Uji", role: "owner", latitude: { Value: "-6.2" }, longitude: { Value: "106.8" } }] } });
      if (j === "/v1.0/end-user/homes/h1/rooms") return kirim({ success: true, result: { rooms: [{ room_id: "r1", name: "Kamar" }, { room_id: "r2", name: "Studio" }] } });
      if (j === "/v1.0/end-user/homes/h1/devices")
        return kirim({ success: true, result: { devices: alat.map((a) => ({ device_id: a.id, name: a.nama, category: a.kategori, online: a.online, ...(a.room ? { room_id: a.room } : {}) })) } });
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
        perintah.push({ id: m[1], properti: props });
        if (a && !abaikan.has(a.id)) Object.assign(a.properti, props);
        return kirim({ success: true, result: {} });
      }
      m = cocok(/^\/v1\.0\/end-user\/devices\/([^/]+)\/attribute$/);
      if (m) {
        const a = alat.find((x) => x.id === m![1]);
        if (a) a.nama = JSON.parse(badan).name;
        return kirim({ success: true, result: {} });
      }
      if (/^\/v1\.0\/end-user\/services\/(push|mail|sms)\/self-send$/.test(j)) {
        pesan.push({ jalur: j, badan: JSON.parse(badan) });
        return kirim({ success: true, result: true });
      }
      m = cocok(/^\/v1\.0\/end-user\/ipc\/([^/]+)\/capture\/(allocate|resolve)$/);
      if (m) {
        if (m[2] === "allocate") {
          const isi = JSON.parse(JSON.parse(badan).capture_json as string) as Record<string, unknown>;
          const video = isi.capture_type === "VIDEO" ? { video_object_key: "/a/0.mp4", cover_image_object_key: "/a/0-sampul.jpg" } : { image_object_key: "/a/0.jpg" };
          return kirim({ success: true, result: { success: true, status: "ACCEPTED", device_id: m[1], capture_type: isi.capture_type, bucket: "ember", encryption_key: "kunci", ...video } });
        }
        if (tangkapanBelumSiap.sisa-- > 0) return kirim({ success: true, result: { status: "NOT_READY", error_code: "OBJECT_NOT_READY" } });
        const isi = JSON.parse(JSON.parse(badan).resolve_json as string) as Record<string, unknown>;
        const awan = `http://${req.headers.host}/awan`;
        if (isi.capture_type === "VIDEO") {
          return kirim({ success: true, result: { status: "ACCEPTED", decrypt_video_url: `${awan}${String(isi.video_object_key)}`, decrypt_cover_image_url: `${awan}${String(isi.cover_image_object_key)}` } });
        }
        return kirim({ success: true, result: { status: "ACCEPTED", decrypt_image_url: `${awan}${String(isi.image_object_key)}`, message_for_user: "ok" } });
      }
      if (j === "/v1.0/end-user/services/weather/recent") return kirim({ success: true, result: { data: { "w.temp.0": 31, "w.humidity.0": 70, "w.condition.0": "cloudy" } } });
      kirim({ success: false, code: 1108, msg: "uri path invalid" });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, tutup: () => new Promise((r) => server.close(() => r())), perintah, alat, kunciDitolak, pesan, tangkapanBelumSiap, abaikan, awanRusak, unduhan };
}
