import { z } from "zod";
import { daftarAktivitas } from "@/lib/layanan/aktivitas";
import { POLA_ID_KODE } from "@/lib/ir/kode-ac";
import { cariKodeModel, daftarMerek, hapusKodeAc, modelUntukMerek, simpanKodeAc, ujiKodeAc } from "@/lib/layanan/ir";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { cuacaRumah, kirimNotifikasi, pemakaianListrik, riwayatPerangkat, tangkapKamera } from "@/lib/layanan/ekstra";
import { daftarFoto, markdownFoto, UMUR_FOTO_HARI, type FotoTersimpan } from "@/lib/layanan/foto";
import { aturAktifJadwal, buatJadwal, daftarJadwal, deskripsiJadwal, hapusJadwal } from "@/lib/layanan/jadwal";
import { aturAktifOtomasi, buatOtomasi, cariOtomasi, daftarOtomasi, deskripsiOtomasi, hapusOtomasi, type MasukanAksi } from "@/lib/layanan/otomasi";
import { aturPerangkat, bacaStruktur, cariPerangkat, daftarPerangkat, gantiNama, kendalikan, kendalikanBanyak, segarkanPerangkat, sinkronkanPengguna, terjemahkanUntuk, type PerangkatRamah } from "@/lib/layanan/rumah";
import { bacaSambungan, namaWilayah, putuskan, simpanKunci } from "@/lib/layanan/sambungan";
import { cariSuasana, daftarSuasana, hapusSuasana, jalankanSuasana, potretKeadaan, simpanSuasana } from "@/lib/layanan/suasana";
import type { JenisPemicu } from "@/lib/otomasi/pemicu";
import type { JenisPerangkat } from "@/lib/tuya/jenis";
import { labelPilihan, labelProperti, punyaArtiAngka } from "@/lib/tuya/label-properti";
import type { PerintahRamah } from "@/lib/tuya/kemampuan";
import { alat, type DefinisiAlat, type KonteksAlat } from "./dasar";

// Alat MCP Tuya. Nama & deskripsi bahasa Inggris (konvensi MCP), teks hasil
// bahasa Indonesia (untuk disampaikan agen ke pengguna apa adanya).

const JENIS: Record<string, JenisPerangkat> = {
  light: "lampu", lamp: "lampu", lampu: "lampu",
  switch: "saklar", saklar: "saklar",
  plug: "colokan", socket: "colokan", colokan: "colokan", stopkontak: "colokan",
  ac: "ac", air_conditioner: "ac", thermostat: "ac",
  fan: "kipas", kipas: "kipas",
  curtain: "tirai", blind: "tirai", tirai: "tirai", gorden: "tirai",
  heater: "pemanas", pemanas: "pemanas",
  purifier: "pembersih_udara", humidifier: "pelembap",
  sensor: "sensor", alarm: "keamanan", camera: "kamera", kamera: "kamera", cctv: "kamera",
  kitchen: "dapur", vacuum: "robot", robot: "robot", ir_remote: "remote", remote: "remote",
  energy_meter: "meteran", garage: "pintu_garasi", valve: "katup", lock: "kunci", door_lock: "kunci", pet: "hewan", pet_feeder: "hewan",
};
const NAMA_JENIS = ["light", "switch", "plug", "ac", "fan", "curtain", "heater", "purifier", "humidifier", "sensor", "alarm", "camera", "kitchen", "vacuum", "ir_remote", "energy_meter", "garage", "valve", "lock", "pet"];

function jenisDari(t?: string): JenisPerangkat | undefined {
  if (!t) return undefined;
  const j = JENIS[t.toLowerCase().trim()];
  if (!j) throw new GalatLayanan("masukan", `Jenis "${t}" tidak dikenali. Pilihan: ${NAMA_JENIS.join(", ")}.`);
  return j;
}

/** Bidang aksi bersama control_device / control_devices / create_schedule. */
const AKSI = {
  power: z.boolean().optional().describe("true = turn on, false = turn off"),
  channel: z.number().int().min(1).max(8).optional().describe("For multi-gang switches/power strips: which channel (1-8). Omit = all channels."),
  brightness: z.number().min(0).max(100).optional().describe("Brightness percent 1-100 (0 turns the light off)"),
  color: z.string().max(30).optional().describe('Color name in Indonesian or English ("merah", "blue", "ungu", "pink"), "putih"/"white", "hangat"/"warm", "sejuk"/"cool", or hex "#ff8800"'),
  white_temperature: z.number().min(0).max(100).optional().describe("White light tone 0 = warmest .. 100 = coolest"),
  temperature: z.number().min(-20).max(100).optional().describe("Target temperature in degrees (AC, heater, thermostat)"),
  mode: z.string().max(30).optional().describe('AC/device mode, e.g. "dingin"/"cool", "panas"/"heat", "auto", "kipas"/"fan", "kering"/"dry"'),
  fan_speed: z.union([z.string().max(20), z.number()]).optional().describe('Fan speed: "auto", "low"/"pelan", "medium"/"sedang", "high"/"kencang", or a number'),
  curtain: z.enum(["open", "close", "stop"]).optional().describe("Curtain/blind motion"),
  position: z.number().min(0).max(100).optional().describe("Curtain position percent (0 closed .. 100 open)"),
  light_mode: z.string().max(20).optional().describe('Light mode: "white"/"putih", "colour"/"warna", "scene"/"adegan", "music"/"musik" (only modes listed by get_device)'),
  timer_minutes: z.number().min(0).max(1440).optional().describe("Built-in device timer: the device flips its power (on->off or off->on) after this many minutes. 0 cancels. Runs on the device itself."),
  properties: z.record(z.string(), z.unknown()).optional().describe("ADVANCED: other settings by code -> raw value, exactly as listed in get_device.settings (e.g. {swing:true}, {relay_status:'memory'})"),
};

function perintahDari(a: { power?: boolean; channel?: number; brightness?: number; color?: string; white_temperature?: number; temperature?: number; mode?: string; fan_speed?: string | number; curtain?: "open" | "close" | "stop"; position?: number; light_mode?: string; timer_minutes?: number; properties?: Record<string, unknown> }): PerintahRamah {
  const c: PerintahRamah = {};
  if (a.power !== undefined) c.nyala = a.power;
  if (a.channel !== undefined) c.saluran = a.channel;
  if (a.brightness !== undefined) c.terangPersen = a.brightness;
  if (a.color !== undefined) c.warna = a.color;
  if (a.white_temperature !== undefined) c.suhuPutihPersen = a.white_temperature;
  if (a.temperature !== undefined) c.suhuTarget = a.temperature;
  if (a.mode !== undefined) c.modeAc = a.mode;
  if (a.fan_speed !== undefined) c.kipas = a.fan_speed;
  if (a.curtain !== undefined) c.tirai = a.curtain === "open" ? "buka" : a.curtain === "close" ? "tutup" : "berhenti";
  if (a.position !== undefined) c.posisiPersen = a.position;
  if (a.light_mode !== undefined) c.modeLampu = a.light_mode;
  if (a.timer_minutes !== undefined) c.hitungMundurMenit = a.timer_minutes;
  if (a.properties) c.properti = a.properties;
  return c;
}

function ringkasPerintah(c: PerintahRamah): string {
  const d: string[] = [];
  if (c.nyala !== undefined) d.push(c.nyala ? "nyalakan" : "matikan");
  if (c.terangPersen !== undefined) d.push(`terang ${c.terangPersen}%`);
  if (c.warna) d.push(`warna ${c.warna}`);
  if (c.suhuTarget !== undefined) d.push(`suhu ${c.suhuTarget}°`);
  if (c.modeAc) d.push(`mode ${c.modeAc}`);
  if (c.kipas !== undefined) d.push(`kipas ${c.kipas}`);
  if (c.tirai) d.push(`tirai ${c.tirai}`);
  if (c.modeLampu) d.push(`mode lampu ${c.modeLampu}`);
  if (c.hitungMundurMenit !== undefined) d.push(c.hitungMundurMenit ? `timer ${c.hitungMundurMenit} menit` : "batalkan timer");
  return d.join(", ") || "atur";
}

/** Bentuk ringkas perangkat untuk agen (tanpa properti mentah yang tidak perlu). */
function untukAgen(p: PerangkatRamah, rinci = false) {
  const s = p.keadaan;
  const keadaan: Record<string, unknown> = { on: s.nyala };
  if (s.saluran) keadaan.channels = s.saluran.map((x) => ({ channel: x.nomor, on: x.nyala }));
  if (s.terangPersen != null) keadaan.brightness = s.terangPersen;
  if (s.warnaHex && s.modeKerja === "colour") keadaan.color = s.warnaHex;
  if (s.suhuPutihPersen != null && s.modeKerja !== "colour") keadaan.white_temperature = s.suhuPutihPersen;
  if (s.suhuTarget != null) keadaan.target_temperature = s.suhuTarget;
  if (s.suhuRuang != null) keadaan.room_temperature = s.suhuRuang;
  if (s.kelembapan != null) keadaan.humidity = s.kelembapan;
  if (s.modeAc) keadaan.mode = s.modeAc;
  if (s.kipas != null) keadaan.fan_speed = s.kipas;
  if (s.tirai) keadaan.curtain = s.tirai;
  if (s.posisiPersen != null) keadaan.position = s.posisiPersen;
  if (s.watt != null) keadaan.power_watt = s.watt;
  if (s.volt != null) keadaan.voltage = s.volt;
  if (s.ampere != null) keadaan.current_ampere = s.ampere;
  if (s.modeKerja && p.kontrol.modeLampu.length) keadaan.light_mode = s.modeKerja;
  if (s.hitungMundurDetik) keadaan.timer_left_minutes = Math.ceil(s.hitungMundurDetik / 60);
  if (s.bateraiPersen != null) keadaan.battery = s.bateraiPersen;
  const o: Record<string, unknown> = { id: p.id, name: p.nama, type: p.jenisLabel, room: p.ruangan, online: p.online, state: keadaan };
  if (p.sensitif) o.needs_confirmation_to_turn_on = true;
  if (p.kontrol.inframerah) {
    o.infrared_remote = true;
    o.ir_code = p.kontrol.kodeIr ? { brand: p.kontrol.kodeIr.merek, code_id: p.kontrol.kodeIr.pustaka } : null;
    o.note = p.kontrol.kodeIr
      ? "Controlled through an IR blaster with the paired remote code: commands are beamed like remote button presses; the real AC state cannot be read back, so 'state' is the last command sent."
      : "NOT CONTROLLABLE YET: this IR AC has no remote code paired. Guide the user through pair_ir_ac (brand -> test codes while watching the AC -> save) before controlling it.";
  }
  if (p.kontrol.pemancarIr) o.note = "This is the IR blaster itself. Control the remotes added inside it (they are separate devices, e.g. an AC). New remotes are added in the Smart Life app.";
  if (rinci) {
    const k = p.kontrol;
    o.home = p.rumah;
    o.capabilities = p.bisa;
    o.controls = {
      ...(k.modeAc.length ? { mode: k.modeAc } : {}),
      ...(k.kipas ? { fan_speed: "pilihan" in k.kipas ? k.kipas.pilihan : { min: k.kipas.min, max: k.kipas.max } } : {}),
      ...(k.suhuTarget ? { temperature: k.suhuTarget } : {}),
      ...(k.modeLampu.length ? { light_mode: k.modeLampu } : {}),
      ...(k.hitungMundur ? { timer_minutes: { max: k.hitungMundur.maksMenit } } : {}),
      ...(k.saluran.length ? { channel: k.saluran } : {}),
    };
    o.readings = k.bacaan.map((x) => ({
      code: x.kode,
      name: labelProperti(x.kode, x.nama).nama,
      value: Array.isArray(x.nilai)
        ? x.nilai.map((v) => labelPilihan(x.kode, v))
        : typeof x.nilai === "string" || (typeof x.nilai === "number" && punyaArtiAngka(x.kode, x.nilai))
          ? labelPilihan(x.kode, x.nilai)
          : x.nilai,
      unit: x.satuan || undefined,
    }));
    o.settings = k.lainnya.map((x) => ({
      code: x.kode,
      name: labelProperti(x.kode, x.nama).nama,
      type: x.tipe,
      value: s.lainnya[x.kode] ?? null,
      ...(x.pilihan ? { choices: x.pilihan.map((c) => ({ value: c, label: labelPilihan(x.kode, c) })) } : {}),
      ...(x.tipe === "value" ? { min: x.min, max: x.max, step: x.langkah, raw_scale: x.skala, unit: x.satuan } : {}),
    }));
    o.updated_at = p.diperbarui;
  }
  return o;
}

function kalimatKeadaan(p: PerangkatRamah): string {
  if (!p.online) return `${p.nama}: offline`;
  const s = p.keadaan;
  const bag: string[] = [s.nyala === null ? "" : s.nyala ? "nyala" : "mati"];
  if (s.nyala && s.terangPersen != null) bag.push(`${s.terangPersen}%`);
  if (s.nyala && s.suhuTarget != null) bag.push(`${s.suhuTarget}°`);
  if (s.suhuRuang != null) bag.push(`ruang ${s.suhuRuang}°`);
  if (s.watt != null && s.nyala) bag.push(`${s.watt} W`);
  return `${p.nama}${p.ruangan ? ` (${p.ruangan})` : ""}: ${bag.filter(Boolean).join(", ") || "-"}`;
}

const tautanSambung = (k: KonteksAlat) => `${k.asal}/app/sambungkan`;
/** Halaman masuk resmi Tuya (tujuan tombol "Get API Key" di tuya.ai/developer). */
const TUYA_AI = "https://auth.tuya.ai/login?loginSource=web_hey_tuya";
const LANGKAH_KUNCI = `buka ${TUYA_AI} di laptop/komputer (QR tidak bisa dipindai dari layar HP yang sama); pilih "SmartLife APP" atau "Tuya APP" (atau masuk dengan Google bila akun app-nya dibuat dengan Google, akun yang SAMA); pindai QR dari app di HP (tab Saya/Me, ikon pindai pojok kanan atas, lalu Konfirmasi); sesudah masuk halaman Hey Tuya terbuka: di menu kiri ketuk "Toolbox" lalu "API Key"; buat kunci baru (tombol Create/+, nama bebas misalnya AgentBuff); salin kunci yang diawali "sk-"`;

// ---------------------------------------------------------------- alat

const getSetupStatus = alat({
  nama: "get_setup_status",
  judul: "Setup status",
  kelas: "baca",
  deskripsi: "Check whether the user's Smart Life/Tuya home is connected. Call this FIRST when unsure, or when another tool returns not_connected / key_problem. Returns the exact steps + link to give the user.",
  masukan: z.object({}),
  async jalankan(k) {
    const s = await bacaSambungan(k.penggunaId);
    if (!s) {
      return {
        data: { connected: false, connect_url: tautanSambung(k) },
        teks: `Rumah belum disambungkan. Pandu pengguna langkah demi langkah (sekali saja, sekitar 2 menit, kirim tautannya utuh): 1) ${LANGKAH_KUNCI}; 2) tempel kuncinya di chat ini lalu panggil connect_home, ATAU tempel sendiri di ${tautanSambung(k)} (halaman itu juga berisi panduan bergambar). Kunci itu bisa mengendalikan rumah: sarankan menghapus pesan berisi kunci sesudah tersambung.`,
      };
    }
    const n = (await daftarPerangkat(k.penggunaId, { termasukTersembunyi: true })).length;
    if (s.status === "kunci_bermasalah") {
      return { data: { connected: false, key_problem: true, connect_url: tautanSambung(k) }, teks: `Kunci Tuya pengguna sudah tidak berlaku. Minta pengguna mengambil kunci baru: ${LANGKAH_KUNCI}. Lalu tempel di chat ini (panggil connect_home) atau di ${tautanSambung(k)}. Suasana, jadwal, dan otomasinya tetap ada.` };
    }
    return { data: { connected: true, region: namaWilayah(s.wilayah), devices: n, connected_since: s.tersambungPada }, teks: `Rumah tersambung (server ${namaWilayah(s.wilayah)}), ${n} perangkat.` };
  },
});

const getHomeOverview = alat({
  nama: "get_home_overview",
  judul: "Home overview",
  kelas: "baca",
  deskripsi: "Summary of the whole home: homes, rooms, which devices are on, which are offline. Use for questions like 'apa saja yang masih nyala?' or before acting on 'semua'.",
  masukan: z.object({}),
  async jalankan(k) {
    const [semua, struktur] = await Promise.all([daftarPerangkat(k.penggunaId), bacaStruktur(k.penggunaId)]);
    const nyala = semua.filter((p) => p.online && p.keadaan.nyala);
    const offline = semua.filter((p) => !p.online);
    return {
      data: {
        homes: (struktur?.rumah ?? []).map((r) => ({ id: r.id, name: r.nama, rooms: r.ruangan.map((x) => x.nama) })),
        device_count: semua.length,
        on: nyala.map((p) => untukAgen(p)),
        offline: offline.map((p) => ({ id: p.id, name: p.nama, room: p.ruangan })),
      },
      teks: semua.length
        ? `${semua.length} perangkat. Menyala (${nyala.length}): ${nyala.map(kalimatKeadaan).join("; ") || "tidak ada"}.${offline.length ? ` Offline: ${offline.map((p) => p.nama).join(", ")}.` : ""}`
        : "Belum ada perangkat di akun Smart Life/Tuya ini.",
    };
  },
});

const listDevices = alat({
  nama: "list_devices",
  judul: "List devices",
  kelas: "baca",
  deskripsi: "List devices with their current state. Optional filters: room (name), type (light, switch, plug, ac, fan, curtain, heater, sensor, camera, ...), query (part of the name), online_only.",
  masukan: z.object({
    room: z.string().max(60).optional(),
    type: z.string().max(30).optional(),
    query: z.string().max(60).optional(),
    online_only: z.boolean().optional(),
  }),
  async jalankan(k, a) {
    const daftar = await daftarPerangkat(k.penggunaId, { ruangan: a.room, jenis: jenisDari(a.type), kata: a.query, hanyaOnline: a.online_only });
    return { data: { devices: daftar.map((p) => untukAgen(p)) }, teks: daftar.length ? daftar.map(kalimatKeadaan).join("\n") : "Tidak ada perangkat yang cocok." };
  },
});

const getDevice = alat({
  nama: "get_device",
  judul: "Device details",
  kelas: "baca",
  deskripsi: "Details of one device by name or id: current state, what it can do (capabilities), room. Set refresh=true to read the live state from Tuya instead of the cached state.",
  masukan: z.object({ device: z.string().min(1).max(120).describe("Device name (e.g. 'lampu meja') or id"), refresh: z.boolean().optional() }),
  async jalankan(k, a) {
    let p = await cariPerangkat(k.penggunaId, a.device);
    if (a.refresh) p = await segarkanPerangkat(k.penggunaId, p.id);
    return { data: { device: untukAgen(p, true) }, teks: `${kalimatKeadaan(p)}. Bisa: ${p.bisa.join("; ") || "belum diketahui"}.` };
  },
});

const controlDevice = alat({
  nama: "control_device",
  judul: "Control a device",
  kelas: "tulis",
  deskripsi:
    "Control ONE device by name or id: power, brightness, color, white tone, light mode, temperature, mode, fan speed, curtain, built-in timer, and any other setting listed in get_device.settings (via properties). Combine fields in one call (e.g. power:true, temperature:24, mode:'dingin'). If the result is 'ambiguous', ask the user which device. If 'needs_confirmation', ask the user explicitly, then repeat with confirm:true.",
  masukan: z.object({
    device: z.string().min(1).max(120).describe("Device name or id"),
    ...AKSI,
    confirm: z.boolean().optional().describe("Set true ONLY after the user explicitly confirmed turning on a sensitive device (heater, kettle, garage door, valve)"),
  }),
  async jalankan(k, a) {
    const p = await cariPerangkat(k.penggunaId, a.device);
    const r = await kendalikan(k.penggunaId, p.id, perintahDari(a), { sumber: "agen", konfirmasi: a.confirm });
    const awal =
      r.status === "terkonfirmasi"
        ? "Berhasil, perangkat sudah melaporkan keadaan barunya"
        : r.status === "belum_terkonfirmasi"
          ? "BELUM TERKONFIRMASI (jangan bilang ke pengguna bahwa ini sudah berhasil)"
          : r.status === "ir"
            ? "Sinyal remote IR sudah dipancarkan (katakan 'perintah sudah dikirim ke AC', bukan 'AC sudah ...')"
            : "Terkirim";
    return {
      data: { ok: r.status !== "belum_terkonfirmasi", status: r.status, device: untukAgen(r.perangkat) },
      teks: `${awal}: ${r.ringkasan}. ${r.catatan}`,
    };
  },
});

const controlDevices = alat({
  nama: "control_devices",
  judul: "Control many devices",
  kelas: "tulis",
  deskripsi:
    "Apply ONE action to many devices at once, e.g. 'matikan semua lampu' (type:'light', power:false) or 'matikan semua di kamar' (room:'kamar', power:false). Needs at least one of: room, type, device_ids, or all:true. Offline devices are skipped and reported.",
  masukan: z.object({
    room: z.string().max(60).optional(),
    type: z.string().max(30).optional(),
    device_ids: z.array(z.string().max(80)).max(50).optional(),
    all: z.boolean().optional().describe("true = every device in the home (use only when the user clearly said 'semua'/everything)"),
    ...AKSI,
    confirm: z.boolean().optional(),
  }),
  async jalankan(k, a) {
    if (!a.room && !a.type && !a.device_ids?.length && !a.all) throw new GalatLayanan("masukan", "Sebutkan ruangan, jenis perangkat, daftar perangkat, atau all:true.");
    const daftar = a.device_ids?.length
      ? (await daftarPerangkat(k.penggunaId)).filter((p) => a.device_ids!.includes(p.id))
      : await daftarPerangkat(k.penggunaId, { ruangan: a.room, jenis: jenisDari(a.type) });
    if (!daftar.length) throw new GalatLayanan("tidak_ditemukan", "Tidak ada perangkat yang cocok dengan saringan itu.");
    const r = await kendalikanBanyak(k.penggunaId, daftar.map((p) => p.id), perintahDari(a), { sumber: "agen", konfirmasi: a.confirm });
    return {
      data: { done: r.berhasil, not_done: r.gagal },
      teks: `Berhasil (${r.berhasil.length}): ${r.berhasil.map((x) => (x.status === "ir" ? `${x.nama} (sinyal IR dikirim)` : x.nama)).join(", ") || "-"}.${r.gagal.length ? ` TIDAK berhasil / belum terkonfirmasi: ${r.gagal.map((g) => `${g.nama} (${g.alasan})`).join("; ")}. Sampaikan ini apa adanya ke pengguna.` : ""}`,
    };
  },
});

const listScenes = alat({
  nama: "list_scenes",
  judul: "List scenes",
  kelas: "baca",
  deskripsi: "List the user's saved scenes (suasana) such as 'Kerja', 'Tidur', 'Nonton'.",
  masukan: z.object({}),
  async jalankan(k) {
    const s = await daftarSuasana(k.penggunaId);
    return { data: { scenes: s.map((x) => ({ id: x.id, name: x.nama, devices: x.aksi.length, last_used: x.terakhirDipakai })) }, teks: s.length ? s.map((x) => `${x.nama} (${x.aksi.length} perangkat)`).join(", ") : "Belum ada suasana tersimpan." };
  },
});

const runScene = alat({
  nama: "run_scene",
  judul: "Run a scene",
  kelas: "tulis",
  deskripsi: "Activate a saved scene by name or id ('aktifkan suasana tidur').",
  masukan: z.object({ scene: z.string().min(1).max(80) }),
  async jalankan(k, a) {
    const r = await jalankanSuasana(k.penggunaId, a.scene, "agen");
    return { data: r, teks: `Suasana ${r.suasana} aktif: ${r.berhasil.length} perangkat.${r.gagal.length ? ` Dilewati: ${r.gagal.map((g) => `${g.nama} (${g.alasan})`).join("; ")}.` : ""}` };
  },
});

const saveScene = alat({
  nama: "save_scene",
  judul: "Save current state as a scene",
  kelas: "tulis",
  deskripsi:
    "Create or update a named scene. Either from the CURRENT state ('simpan kondisi sekarang sebagai suasana Kerja': pick devices by names/ids or room, or omit both for every online device), or from explicit `actions` ('buat suasana Tidur: lampu kamar 10% hangat, AC 26 derajat, lainnya mati'). Saving with an existing name updates that scene.",
  masukan: z.object({
    name: z.string().min(1).max(40),
    devices: z.array(z.string().max(120)).max(40).optional().describe("Device names or ids"),
    room: z.string().max(60).optional(),
    actions: z
      .array(z.object({ device: z.string().min(1).max(120), ...AKSI }))
      .max(40)
      .optional()
      .describe("Build the scene from explicit settings instead of the current state, e.g. [{device:'lampu kamar', power:true, brightness:20, color:'hangat'}, {device:'AC', power:true, temperature:25}]. Devices are NOT changed now."),
    icon: z.enum(["sparkles", "sun", "moon", "film", "briefcase", "coffee", "bed", "home", "party-popper", "book-open", "utensils", "dumbbell", "leaf", "power"]).optional(),
  }),
  async jalankan(k, a) {
    let aksi: Awaited<ReturnType<typeof potretKeadaan>>;
    if (a.actions?.length) {
      aksi = [];
      for (const x of a.actions) {
        const p = await cariPerangkat(k.penggunaId, x.device);
        const perintah = perintahDari(x);
        if (!Object.keys(perintah).length) throw new GalatLayanan("masukan", `Aksi untuk "${p.nama}" kosong. Contoh power:true.`);
        aksi.push({ deviceId: p.id, properti: await terjemahkanUntuk(k.penggunaId, p.id, perintah) });
      }
    } else {
      let ids: string[];
      if (a.devices?.length) ids = await Promise.all(a.devices.map(async (d) => (await cariPerangkat(k.penggunaId, d)).id));
      else ids = (await daftarPerangkat(k.penggunaId, { ruangan: a.room, hanyaOnline: true })).map((p) => p.id);
      aksi = await potretKeadaan(k.penggunaId, ids);
    }
    const s = await simpanSuasana(k.penggunaId, { nama: a.name, ikon: a.icon, aksi }, "agen");
    return { data: { id: s.id, name: s.nama, devices: aksi.length }, teks: `Suasana "${s.nama}" tersimpan (${aksi.length} perangkat).` };
  },
});

const deleteScene = alat({
  nama: "delete_scene",
  judul: "Delete a scene",
  kelas: "tulis",
  merusak: true,
  deskripsi: "Delete a saved scene by name or id. Confirm with the user first.",
  masukan: z.object({ scene: z.string().min(1).max(80) }),
  async jalankan(k, a) {
    const s = await cariSuasana(k.penggunaId, a.scene);
    await hapusSuasana(k.penggunaId, s.id, "agen");
    return { data: { deleted: s.nama }, teks: `Suasana "${s.nama}" dihapus.` };
  },
});

const createSchedule = alat({
  nama: "create_schedule",
  judul: "Create a schedule or timer",
  kelas: "tulis",
  deskripsi:
    "Schedule a device action or a scene. Exactly one of: in_minutes (timer, 'matikan 30 menit lagi'), at (ISO datetime with timezone, one-time), or time ('HH:MM' 24h, repeating daily; add days 0=Sunday..6=Saturday for specific weekdays). Target: device + action fields, OR scene.",
  masukan: z.object({
    in_minutes: z.number().int().min(1).max(10080).optional(),
    at: z.string().max(40).optional(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    name: z.string().max(80).optional(),
    scene: z.string().max(80).optional(),
    device: z.string().max(120).optional(),
    ...AKSI,
  }),
  async jalankan(k, a) {
    const caraWaktu = [a.in_minutes !== undefined, !!a.at, !!a.time].filter(Boolean).length;
    if (caraWaktu !== 1) throw new GalatLayanan("masukan", "Pilih tepat satu: in_minutes, at, atau time.");
    if (!!a.scene === !!a.device) throw new GalatLayanan("masukan", "Pilih tepat satu target: device (+aksi) atau scene.");
    const perintah = perintahDari(a);
    if (a.device && Object.keys(perintah).length === 0) throw new GalatLayanan("masukan", "Aksinya apa? Contoh power:false.");
    const j = await buatJadwal(
      k.penggunaId,
      {
        nama: a.name,
        dalamMenit: a.in_minutes,
        pada: a.at,
        jam: a.time,
        hari: a.days,
        target: a.scene ? { suasana: a.scene } : { perangkat: a.device!, perintah, ringkasan: ringkasPerintah(perintah) },
      },
      "agen",
    );
    return { data: { id: j.id, name: j.nama, when: deskripsiJadwal(j), next_run: j.berikutnya }, teks: `Jadwal dibuat: ${j.nama} (${deskripsiJadwal(j)}).` };
  },
});

const listSchedules = alat({
  nama: "list_schedules",
  judul: "List schedules",
  kelas: "baca",
  deskripsi: "List schedules and timers with their next run time and last result.",
  masukan: z.object({}),
  async jalankan(k) {
    const d = await daftarJadwal(k.penggunaId);
    return {
      data: { schedules: d.map((j) => ({ id: j.id, name: j.nama, when: deskripsiJadwal(j), active: j.aktif, next_run: j.berikutnya, last_result: j.terakhirHasil })) },
      teks: d.length ? d.map((j) => `${j.nama}: ${deskripsiJadwal(j)}${j.aktif ? "" : " (nonaktif)"}`).join("\n") : "Belum ada jadwal.",
    };
  },
});

const cancelSchedule = alat({
  nama: "cancel_schedule",
  judul: "Cancel a schedule",
  kelas: "tulis",
  merusak: true,
  deskripsi: "Delete a schedule/timer by id (get ids from list_schedules).",
  masukan: z.object({ schedule_id: z.string().uuid() }),
  async jalankan(k, a) {
    await hapusJadwal(k.penggunaId, a.schedule_id, "agen");
    return { data: { deleted: a.schedule_id }, teks: "Jadwal dihapus." };
  },
});

const getEnergyUsage = alat({
  nama: "get_energy_usage",
  judul: "Energy usage",
  kelas: "baca",
  deskripsi: "Electricity used by a smart plug/meter on one day (hourly + total). date = YYYY-MM-DD, default today.",
  masukan: z.object({ device: z.string().min(1).max(120), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  async jalankan(k, a) {
    const r = await pemakaianListrik(k.penggunaId, a.device, a.date ?? null, k.zona);
    return { data: r, teks: `${r.perangkat} pada ${r.tanggal}: ${r.total} ${r.satuan}.` };
  },
});

const getDeviceHistory = alat({
  nama: "get_device_history",
  judul: "Device history",
  kelas: "baca",
  deskripsi:
    "Hourly history that Tuya records for a device on one day (energy, temperature, door-open counts, etc. - whatever Tuya keeps for it). Without metric, uses the first available and lists all available metrics. date = YYYY-MM-DD, default today.",
  masukan: z.object({ device: z.string().min(1).max(120), metric: z.string().max(60).optional().describe("dp code from 'available' of a previous call"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  async jalankan(k, a) {
    const r = await riwayatPerangkat(k.penggunaId, a.device, a.metric ?? null, a.date ?? null, k.zona);
    const isi = r.perJam.map((x) => `${x.jam} ${x.nilai}`).join(", ");
    return { data: r, teks: `${r.perangkat} ${r.tanggal}, ${r.kode} (${r.jenis}): ${r.total !== null ? `total ${r.total}; ` : ""}${isi || "belum ada data"}. Tersedia: ${r.tersedia.map((x) => x.kode).join(", ")}.` };
  },
});

const getWeather = alat({
  nama: "get_weather",
  judul: "Weather at home",
  kelas: "baca",
  deskripsi: "Current weather and next hours at the home's location (from the Smart Life home location).",
  masukan: z.object({}),
  async jalankan(k) {
    const c = await cuacaRumah(k.penggunaId);
    return { data: c, teks: `Cuaca di ${c.rumah}: ${c.kondisi ?? "-"}, ${c.suhu ?? "-"}°C, kelembapan ${c.kelembapan ?? "-"}%.` };
  },
});

const pairIrAc = alat({
  nama: "pair_ir_ac",
  judul: "Pair an IR AC remote code",
  kelas: "tulis",
  deskripsi:
    "Pair the remote code of an AC controlled through an IR blaster (get_device shows infrared_remote:true and ir_code:null, or the user says the AC reacts wrongly). Tuya does not beam IR for third-party apps, so we beam it ourselves; recording from the user's remote is NOT possible through Tuya. Steps: if the user can read the model code on the sticker (right side of the indoor unit, or back of the remote), action:'find' {model} gives the exact code; otherwise ask the AC brand -> action:'codes' {brand} -> for each code in order, with the user standing near the AC: action:'test' {code_id, test:'full'} (turns the AC on at 27 degrees, high fan, swing) and ASK whether the AC turned on showing 27, high fan AND swinging louvers. Only if ALL changed: action:'save'. If nothing or only part changed: next code. Panasonic codes 'pana:*' are built from the protocol (every setting included). Never assume a reaction. action:'remove' unpairs.",
  masukan: z.object({
    action: z.enum(["find", "brands", "codes", "test", "save", "remove"]),
    model: z.string().max(40).optional().describe("Model code from the sticker on the AC indoor unit or the back of the remote (e.g. CS-PN9WKJ), for action:'find'"),
    device: z.string().min(1).max(120).optional().describe("The IR AC (name or id); required for test/save/remove"),
    brand: z.string().max(60).optional().describe("AC brand, for action:'codes'"),
    code_id: z.string().regex(POLA_ID_KODE).optional().describe("Code id from action:'codes' (e.g. '1020' or 'pana:1'); for test it may be omitted to test the saved code"),
    test: z.enum(["on", "off", "full"]).optional().describe("'on' = cool 24 auto fan, 'off' = power off, 'full' = cool 27 + high fan + swing (checks every setting reaches the AC)"),
  }),
  async jalankan(k, a) {
    if (a.action === "find") {
      if (!a.model) throw new GalatLayanan("masukan", "Sebutkan kode model dari stiker (model).");
      const h = cariKodeModel(a.model);
      return {
        data: { matches: h.map((x) => ({ brand: x.merek, code_id: x.id, model: x.model, match: x.cocok === "persis" ? "exact" : "similar" })) },
        teks: h.length ? `Kode yang cocok: ${h.map((x) => `${x.merek} ${x.model} (${x.id}, ${x.cocok})`).join("; ")}. Tes berurutan dengan test:'full'.` : "Kode model itu belum ada di daftar. Tanyakan mereknya lalu pakai action:'codes'.",
      };
    }
    if (a.action === "brands") {
      const m = daftarMerek();
      return { data: { brands: m.map((x) => ({ brand: x.merek, codes: x.jumlah })) }, teks: `${m.length} merek tersedia, misalnya: ${m.slice(0, 15).map((x) => x.merek).join(", ")}. Tanyakan merek AC pengguna.` };
    }
    if (a.action === "codes") {
      if (!a.brand) throw new GalatLayanan("masukan", "Sebutkan merek AC (brand).");
      const r = modelUntukMerek(a.brand);
      return {
        data: { brand: r.merek, codes: r.kode.map((x) => ({ code_id: x.id, order: x.urutan, models: x.model, built_from_protocol: x.dibangun })) },
        teks: `${r.kode.length} kode untuk ${r.merek}.${r.kode.some((x) => x.dibangun) ? " Kode 'pana:*' dibangun dari protokol (semua suhu/kipas/ayunan pasti ada)." : ""} Tes berurutan; tanyakan pengguna setiap kali.`,
      };
    }
    if (!a.device) throw new GalatLayanan("masukan", "Sebutkan AC-nya (device).");
    const p = await cariPerangkat(k.penggunaId, a.device);
    if (a.action === "remove") {
      await hapusKodeAc(k.penggunaId, p.id, "agen");
      return { data: { removed: true }, teks: `Kode remote ${p.nama} dilepas.` };
    }
    if (a.action === "test") {
      const r = await ujiKodeAc(k.penggunaId, p.id, a.code_id ?? null, a.test === "off" ? "mati" : a.test === "on" ? "nyala" : "lengkap", null, "agen");
      return { data: { sent: true, brand: r.merek, code_id: a.code_id ?? "saved", blaster: r.pemancar }, teks: `${r.keterangan} Tanyakan ke pengguna; simpan hanya bila pengguna menjawab ya.` };
    }
    if (!a.code_id) throw new GalatLayanan("masukan", "Sebutkan code_id dari action:'codes'.");
    const r = await simpanKodeAc(k.penggunaId, p.id, a.code_id, null, "agen");
    return { data: { saved: true, ...r }, teks: `Kode remote ${r.merek} tersimpan untuk ${p.nama}. Mode tersedia: ${r.mode.join(", ")}. AC sekarang bisa diatur dengan control_device.` };
  },
});

const renameDevice = alat({
  nama: "rename_device",
  judul: "Rename a device",
  kelas: "tulis",
  deskripsi: "Rename a device (also changes the name in the Smart Life/Tuya app).",
  masukan: z.object({ device: z.string().min(1).max(120), new_name: z.string().min(1).max(60) }),
  async jalankan(k, a) {
    const p = await cariPerangkat(k.penggunaId, a.device);
    const r = await gantiNama(k.penggunaId, p.id, a.new_name, "agen");
    return { data: { device: untukAgen(r) }, teks: `Nama diganti jadi "${r.nama}".` };
  },
});

const notifyMe = alat({
  nama: "notify_me",
  judul: "Push notification to the user",
  kelas: "tulis",
  deskripsi: "Send a message to the user THEMSELVES through Tuya: push to the Smart Life/Tuya app (default), email to the account's email, SMS, or an automated voice call to the account's phone. Self only; Tuya limits how many per day.",
  masukan: z.object({ title: z.string().min(1).max(50), message: z.string().min(1).max(300), channel: z.enum(["app", "email", "sms", "voice"]).optional().describe("voice = automated phone call to the account's phone (max 15/day); use only for urgent alerts") }),
  async jalankan(k, a) {
    const saluran = a.channel === "voice" ? "telepon" : (a.channel ?? "app");
    await kirimNotifikasi(k.penggunaId, a.title, a.message, "agen", saluran);
    const teks = { app: "Notifikasi terkirim ke app Smart Life/Tuya.", email: "Email terkirim ke alamat akun Smart Life.", sms: "SMS terkirim ke nomor akun Smart Life.", telepon: "Telepon suara dikirim ke nomor akun Smart Life." }[saluran];
    return { data: { sent: true, channel: a.channel ?? "app" }, teks };
  },
});

const getActivity = alat({
  nama: "get_activity",
  judul: "Recent activity",
  kelas: "baca",
  deskripsi: "Recent actions on the home (by the user on the web, by the agent, by schedules/scenes).",
  masukan: z.object({ limit: z.number().int().min(1).max(50).optional() }),
  async jalankan(k, a) {
    const d = await daftarAktivitas(k.penggunaId, { batas: a.limit ?? 15 });
    return { data: { activity: d.map((x) => ({ at: x.dibuat, by: x.sumber, summary: x.ringkasan, ok: x.berhasil })) }, teks: d.map((x) => `${x.ringkasan} [${x.sumber}]`).join("\n") || "Belum ada aktivitas." };
  },
});

const refreshDevices = alat({
  nama: "refresh_devices",
  judul: "Refresh device list",
  kelas: "tulis",
  deskripsi: "Re-read homes, rooms and devices from Tuya (use after the user adds/renames/moves devices in the Smart Life app).",
  masukan: z.object({}),
  async jalankan(k) {
    const r = await sinkronkanPengguna(k.penggunaId);
    return { data: r, teks: `Diperbarui: ${r.perangkat} perangkat di ${r.rumah} rumah (${r.online} online).` };
  },
});

const connectHome = alat({
  nama: "connect_home",
  judul: "Connect the Smart Life/Tuya home",
  kelas: "tulis",
  deskripsi:
    "Connect (or re-connect) the user's Smart Life/Tuya home with the key the user created at tuya.ai (Toolbox > API Key, starts with 'sk-'). Use when the user pastes such a key in chat. The key is checked with Tuya first, stored encrypted, and all homes/rooms/devices are loaded. Never invent or reuse a key.",
  masukan: z.object({ key: z.string().min(10).max(300).describe("The key exactly as the user pasted it, e.g. sk-AY...") }),
  async jalankan(k, a) {
    const r = await simpanKunci(k.penggunaId, a.key, "agen");
    return {
      data: { connected: true, region: r.wilayah.nama, homes: r.rumah, rooms: r.ruangan, devices: r.perangkat, online: r.online },
      teks: `Rumah tersambung (server ${r.wilayah.nama}): ${r.perangkat} perangkat di ${r.rumah} rumah, ${r.online} online. Sarankan pengguna menghapus pesan berisi kunci dari chat.`,
    };
  },
});

const disconnectHome = alat({
  nama: "disconnect_home",
  judul: "Disconnect the home",
  kelas: "tulis",
  merusak: true,
  deskripsi: "Remove the Tuya key and the device list from this service (scenes, schedules and automations stay but stop working until a new key is connected). Only when the user explicitly asks; confirm first, then call with confirm:true.",
  masukan: z.object({ confirm: z.literal(true) }),
  async jalankan(k) {
    await putuskan(k.penggunaId, "agen");
    return { data: { disconnected: true }, teks: "Sambungan rumah diputus dan kunci dihapus dari server." };
  },
});

const setScheduleActive = alat({
  nama: "set_schedule_active",
  judul: "Pause or resume a schedule",
  kelas: "tulis",
  deskripsi: "Pause (enabled:false) or resume (enabled:true) a schedule without deleting it. Get ids from list_schedules.",
  masukan: z.object({ schedule_id: z.string().uuid(), enabled: z.boolean() }),
  async jalankan(k, a) {
    const j = await aturAktifJadwal(k.penggunaId, a.schedule_id, a.enabled);
    return { data: { id: j.id, active: j.aktif, next_run: j.berikutnya }, teks: `Jadwal ${j.nama} ${j.aktif ? `aktif lagi (${deskripsiJadwal(j)})` : "dijeda"}.` };
  },
});

const PEMICU: Record<string, JenisPemicu> = {
  turned_on: "menyala",
  turned_off: "mati",
  went_offline: "offline",
  came_online: "online",
  door_opened: "pintu_terbuka",
  door_closed: "pintu_tertutup",
  motion_detected: "gerakan",
  smoke_detected: "asap",
  water_leak: "bocor_air",
  gas_detected: "gas",
  temperature_above: "suhu_di_atas",
  temperature_below: "suhu_di_bawah",
  humidity_above: "lembap_di_atas",
  humidity_below: "lembap_di_bawah",
  power_above: "daya_di_atas",
  battery_below: "baterai_di_bawah",
  property_equals: "properti_sama",
  value_above: "nilai_di_atas",
  value_below: "nilai_di_bawah",
};
const NAMA_PEMICU = Object.keys(PEMICU) as [string, ...string[]];

const createAutomation = alat({
  nama: "create_automation",
  judul: "Create an automation (if this, then that)",
  kelas: "tulis",
  deskripsi:
    "Create a rule that runs by itself when a device changes, e.g. 'kalau pintu depan terbuka malam hari, nyalakan lampu teras dan kabari aku', 'kalau suhu kamar di atas 29, nyalakan AC 25 derajat', 'kalau ada gerakan di garasi, kirim notifikasi', 'kalau dispenser offline, kabari aku'. when.event: turned_on, turned_off, went_offline, came_online, door_opened, door_closed, motion_detected, smoke_detected, water_leak, gas_detected, temperature_above, temperature_below, humidity_above, humidity_below, power_above, battery_below (these last 6 need when.value), property_equals (needs when.property + when.equals), value_above / value_below (any numeric reading or setting, e.g. co2_value, pm25_value, bright_value of a light sensor, water level: needs when.property + when.value in real units as shown by get_device readings). then: 1-10 actions, each ONE of: a device + action fields, a scene, a notification (notify_title + notify_message, sent to the user's Smart Life app), or camera_photo (a camera name: take a photo when the rule fires, keep it 7 days, and send its link via send_photo_to: app (default, Smart Life push), email, sms, or none = only keep it; the agent can show it later with list_camera_photos). Example: 'kalau pintu depan terbuka, foto CCTV teras dan kirim ke aku' = when door_opened + then [{camera_photo:'CCTV teras'}]. Fires once each time the condition becomes true, then waits cooldown_minutes.",
  masukan: z.object({
    name: z.string().max(80).optional(),
    when: z.object({
      device: z.string().min(1).max(120).describe("The device whose change triggers the rule"),
      event: z.enum(NAMA_PEMICU),
      value: z.number().optional().describe("Threshold for *_above / *_below events (degrees, %, watt)"),
      property: z.string().max(60).optional().describe("Property code (from get_device readings/settings) for property_equals / value_above / value_below"),
      equals: z.union([z.string().max(60), z.number(), z.boolean()]).optional(),
    }),
    then: z
      .array(
        z.object({
          device: z.string().max(120).optional(),
          scene: z.string().max(80).optional(),
          notify_title: z.string().max(50).optional(),
          notify_message: z.string().max(300).optional(),
          camera_photo: z.string().max(120).optional().describe("Camera name: take a photo when the rule fires"),
          send_photo_to: z.enum(["app", "email", "sms", "none"]).optional().describe("Where the camera_photo link goes (default app = Smart Life push); none = only keep it 7 days"),
          ...AKSI,
        }),
      )
      .min(1)
      .max(10),
    only_between: z
      .object({ from: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), to: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) })
      .optional()
      .describe("Only run inside this local time window, e.g. from 18:00 to 06:00"),
    cooldown_minutes: z.number().int().min(1).max(1440).optional().describe("Minimum minutes between two runs (default 5; 10 when it sends notifications)"),
    confirm: z.boolean().optional().describe("Set true ONLY after the user agreed that this rule may turn on a sensitive device (heater, kettle, garage door, valve)"),
  }),
  async jalankan(k, a) {
    const aksi: MasukanAksi[] = a.then.map((x) => {
      const jumlah = [!!x.device, !!x.scene, !!(x.notify_title || x.notify_message), !!x.camera_photo].filter(Boolean).length;
      if (jumlah !== 1) throw new GalatLayanan("masukan", "Setiap aksi pilih tepat satu: device (+aksi), scene, notify_title + notify_message, atau camera_photo.");
      if (x.camera_photo) return { foto: { perangkat: x.camera_photo, kirim: x.send_photo_to === "none" ? "simpan" : (x.send_photo_to ?? "app") } };
      if (x.scene) return { suasana: x.scene };
      if (x.notify_title || x.notify_message) return { notifikasi: { judul: x.notify_title ?? "AgentBuff", isi: x.notify_message ?? x.notify_title ?? "" } };
      const perintah = perintahDari(x);
      return { perangkat: x.device!, perintah, ringkasan: ringkasPerintah(perintah) };
    });
    const o = await buatOtomasi(
      k.penggunaId,
      {
        nama: a.name,
        pemicu: { perangkat: a.when.device, jenis: PEMICU[a.when.event], nilai: a.when.value, kode: a.when.property, sama: a.when.equals },
        aksi,
        hanyaAntara: a.only_between ? { mulai: a.only_between.from, akhir: a.only_between.to } : null,
        jedaMenit: a.cooldown_minutes,
        konfirmasi: a.confirm,
      },
      "agen",
    );
    return { data: { id: o.id, name: o.nama, rule: deskripsiOtomasi(o), cooldown_minutes: o.jedaMenit }, teks: `Otomasi dibuat: ${deskripsiOtomasi(o)}.` };
  },
});

const listAutomations = alat({
  nama: "list_automations",
  judul: "List automations",
  kelas: "baca",
  deskripsi: "List the user's automations (if-this-then-that rules) with their last run and result.",
  masukan: z.object({}),
  async jalankan(k) {
    const d = await daftarOtomasi(k.penggunaId);
    return {
      data: { automations: d.map((o) => ({ id: o.id, name: o.nama, rule: deskripsiOtomasi(o), active: o.aktif, last_run: o.terakhirJalan, last_result: o.terakhirHasil })) },
      teks: d.length ? d.map((o) => `${o.nama}${o.aktif ? "" : " (dijeda)"}: ${deskripsiOtomasi(o)}`).join("\n") : "Belum ada otomasi.",
    };
  },
});

const setAutomationActive = alat({
  nama: "set_automation_active",
  judul: "Pause or resume an automation",
  kelas: "tulis",
  deskripsi: "Pause (enabled:false) or resume (enabled:true) an automation by name or id.",
  masukan: z.object({ automation: z.string().min(1).max(120), enabled: z.boolean() }),
  async jalankan(k, a) {
    const o = await cariOtomasi(k.penggunaId, a.automation);
    const u = await aturAktifOtomasi(k.penggunaId, o.id, a.enabled, "agen");
    return { data: { id: u.id, active: u.aktif }, teks: `Otomasi ${u.nama} ${u.aktif ? "aktif" : "dijeda"}.` };
  },
});

const deleteAutomation = alat({
  nama: "delete_automation",
  judul: "Delete an automation",
  kelas: "tulis",
  merusak: true,
  deskripsi: "Delete an automation by name or id. Confirm with the user first.",
  masukan: z.object({ automation: z.string().min(1).max(120) }),
  async jalankan(k, a) {
    const o = await cariOtomasi(k.penggunaId, a.automation);
    await hapusOtomasi(k.penggunaId, o.id, "agen");
    return { data: { deleted: o.nama }, teks: `Otomasi "${o.nama}" dihapus.` };
  },
});

const setDevicePreferences = alat({
  nama: "set_device_preferences",
  judul: "Device preferences",
  kelas: "tulis",
  deskripsi:
    "Change how this service treats a device: needs_confirmation (true = always ask before turning it on, false = never ask, 'default' = follow its type) and hidden (true = hide from lists and 'all' actions, e.g. a device the user never wants touched).",
  masukan: z.object({
    device: z.string().min(1).max(120),
    needs_confirmation: z.union([z.boolean(), z.literal("default")]).optional(),
    hidden: z.boolean().optional(),
  }),
  async jalankan(k, a) {
    if (a.needs_confirmation === undefined && a.hidden === undefined) throw new GalatLayanan("masukan", "Pilih yang diubah: needs_confirmation atau hidden.");
    const p = await cariPerangkat(k.penggunaId, a.device);
    await aturPerangkat(k.penggunaId, p.id, {
      ...(a.needs_confirmation !== undefined ? { sensitif: a.needs_confirmation === "default" ? null : a.needs_confirmation } : {}),
      ...(a.hidden !== undefined ? { disembunyikan: a.hidden } : {}),
    });
    const bag: string[] = [];
    if (a.needs_confirmation !== undefined) bag.push(a.needs_confirmation === "default" ? "konfirmasi mengikuti jenisnya" : a.needs_confirmation ? "selalu minta konfirmasi sebelum menyala" : "tanpa konfirmasi");
    if (a.hidden !== undefined) bag.push(a.hidden ? "disembunyikan" : "ditampilkan lagi");
    return { data: { device: p.nama, updated: true }, teks: `${p.nama}: ${bag.join(", ")}.` };
  },
});

function jamFoto(f: FotoTersimpan, zona: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: zona, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(f.dibuat);
}

function dataFoto(f: FotoTersimpan, zona: string) {
  return {
    device: f.perangkat,
    kind: f.jenis === "video" ? "video" : "photo",
    url: f.url,
    markdown: markdownFoto(f),
    taken_at: f.dibuat.toISOString(),
    taken_local: jamFoto(f, zona),
    source: f.sumber,
    note: f.catatan,
    expires_at: f.kedaluwarsa.toISOString(),
  };
}

const PETUNJUK_TAMPIL =
  "Tampilkan ke pengguna dengan menyalin baris markdown di atas PERSIS (foto tampil sebagai gambar di chat AgentBuff dan terkirim sebagai foto di Telegram; klip diputar di chat AgentBuff, di WhatsApp/Telegram cukup kirim tautannya). Untuk menilai isi foto (misalnya ada orang atau tidak), pakai alat analisis gambar kamu pada url itu.";

const captureCamera = alat({
  nama: "capture_camera",
  judul: "Photo or clip from a camera",
  kelas: "tulis",
  deskripsi:
    "Ask a Tuya camera to take a photo (default) or a short video clip (1-60 s). The result is kept 7 days at a private link and comes with a ready markdown line: show it to the user exactly as given so the image appears in the AgentBuff chat and as a photo in Telegram. Use when the user asks to see/check a camera. Takes up to ~30 s. Live streaming is not available. Needs the camera's cloud capture feature.",
  masukan: z.object({ device: z.string().min(1).max(120), kind: z.enum(["photo", "video"]).optional(), seconds: z.number().int().min(1).max(60).optional() }),
  async jalankan(k, a) {
    const r = await tangkapKamera(k.penggunaId, a.device, a.kind === "video" ? "video" : "foto", a.seconds ?? 10);
    const label = r.jenis === "video" ? "Klip" : "Foto";
    if (r.tersimpan) {
      const f = r.tersimpan;
      return {
        data: { ...dataFoto(f, k.zona), image_url: r.jenis === "foto" ? f.url : null, video_url: r.jenis === "video" ? f.url : null },
        teks: `${label} dari ${r.perangkat} (${jamFoto(f, k.zona)}, tersimpan ${UMUR_FOTO_HARI} hari):\n${markdownFoto(f)}\n${PETUNJUK_TAMPIL}`,
      };
    }
    const url = r.jenis === "video" ? r.video : r.gambar;
    return {
      data: { device: r.perangkat, kind: a.kind ?? "photo", url, image_url: r.gambar, video_url: r.video, stored: false },
      teks: `${label} dari ${r.perangkat}: ${url} (tidak bisa disimpan, tautan dari Tuya hanya berlaku beberapa menit; kirim tautan ini apa adanya).`,
    };
  },
});

const listCameraPhotos = alat({
  nama: "list_camera_photos",
  judul: "Recent camera photos",
  kelas: "baca",
  deskripsi:
    "Recent photos and clips kept from the user's cameras (last 7 days): taken by you, from the app, or by automations (e.g. 'foto CCTV saat pintu terbuka'). Each comes with a ready markdown line to show the image in chat. Use for 'ada foto apa tadi?', 'tunjukkan foto dari otomasi pintu', 'foto CCTV terakhir'.",
  masukan: z.object({
    device: z.string().max(120).optional().describe("Camera name; omit for all cameras"),
    limit: z.number().int().min(1).max(20).optional().describe("Default 5"),
    from_automations_only: z.boolean().optional(),
  }),
  async jalankan(k, a) {
    const p = a.device ? await cariPerangkat(k.penggunaId, a.device) : null;
    const d = await daftarFoto(k.penggunaId, { deviceId: p?.id, batas: a.limit ?? 5, sumber: a.from_automations_only ? "otomasi" : undefined });
    if (!d.length) {
      return { data: { photos: [] }, teks: `Belum ada foto${p ? ` dari ${p.nama}` : ""} dalam ${UMUR_FOTO_HARI} hari terakhir. Ambil foto baru dengan capture_camera.` };
    }
    const asal: Record<string, string> = { agen: "diminta lewat agen", web: "diambil di app", otomasi: "otomasi" };
    const baris = d.map((f) => `${jamFoto(f, k.zona)} - ${f.perangkat} (${asal[f.sumber] ?? f.sumber}${f.catatan ? `: ${f.catatan}` : ""})\n${markdownFoto(f)}`);
    return { data: { photos: d.map((f) => dataFoto(f, k.zona)) }, teks: `${baris.join("\n\n")}\n\n${PETUNJUK_TAMPIL}` };
  },
});

export const SEMUA_ALAT: DefinisiAlat[] = [
  getSetupStatus,
  connectHome,
  getHomeOverview,
  listDevices,
  getDevice,
  controlDevice,
  controlDevices,
  listScenes,
  runScene,
  saveScene,
  deleteScene,
  createSchedule,
  listSchedules,
  cancelSchedule,
  setScheduleActive,
  createAutomation,
  listAutomations,
  setAutomationActive,
  deleteAutomation,
  getEnergyUsage,
  getDeviceHistory,
  getWeather,
  pairIrAc,
  renameDevice,
  notifyMe,
  getActivity,
  refreshDevices,
  setDevicePreferences,
  captureCamera,
  listCameraPhotos,
  disconnectHome,
] as unknown as DefinisiAlat[];

/** Alat yang tetap boleh dipakai walau rumah belum tersambung / akses beku. */
export const ALAT_BEBAS = new Set(["get_setup_status"]);

export function cariAlat(nama: string): DefinisiAlat | undefined {
  return SEMUA_ALAT.find((a) => a.nama === nama);
}
