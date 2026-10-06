/**
 * Kode kategori Tuya → jenis perangkat yang dikenali manusia.
 * Sumber kode kategori: dokumentasi Standard Instruction Set Tuya (category code).
 * Kategori tak dikenal jatuh ke "lainnya" — tetap bisa dikendalikan lewat
 * properti generik, tidak pernah disembunyikan.
 */

export type JenisPerangkat =
  | "lampu"
  | "saklar"
  | "colokan"
  | "ac"
  | "kipas"
  | "tirai"
  | "pemanas"
  | "pembersih_udara"
  | "pelembap"
  | "sensor"
  | "keamanan"
  | "kamera"
  | "kunci"
  | "dapur"
  | "robot"
  | "remote"
  | "meteran"
  | "pintu_garasi"
  | "katup"
  | "hewan"
  | "lainnya";

const PETA: Record<string, JenisPerangkat> = {
  dj: "lampu", dd: "lampu", xdd: "lampu", fwd: "lampu", dc: "lampu", tyndj: "lampu", gyd: "lampu", fsd: "lampu", tgq: "lampu", sxd: "lampu",
  kg: "saklar", tgkg: "saklar", cjkg: "saklar", wxkg: "saklar", tdq: "saklar", szjqr: "saklar", pc: "colokan", cz: "colokan", wkcz: "colokan",
  kt: "ac", infrared_ac: "ac", ktkzq: "ac", wk: "ac", wkf: "ac",
  fs: "kipas", fsd_fan: "kipas", fskg: "kipas",
  cl: "tirai", clkg: "tirai", mc: "tirai",
  qn: "pemanas", rs: "pemanas", nnq: "pemanas", dr: "pemanas",
  kj: "pembersih_udara", xfj: "pembersih_udara",
  jsq: "pelembap", cs: "pelembap", xxj: "pelembap",
  mcs: "sensor", pir: "sensor", wsdcg: "sensor", ldcg: "sensor", hjjcy: "sensor", zd: "sensor", sj: "sensor", co2bj: "sensor", "pm2.5": "sensor", pm25: "sensor", hps: "sensor", jqbj: "sensor", ylcg: "sensor", sjz: "sensor", qxj: "sensor",
  ywbj: "keamanan", rqbj: "keamanan", cobj: "keamanan", sos: "keamanan", sgbj: "keamanan", mal: "keamanan", dgnbj: "keamanan", jwbj: "keamanan",
  sp: "kamera", dghsxj: "kamera", sp_wnq: "kamera",
  ms: "kunci", jtmspro: "kunci", videolock: "kunci",
  bh: "dapur", kfj: "dapur", mzj: "dapur", kfdj: "dapur", znfh: "dapur", dcl: "dapur",
  sd: "robot",
  wnykq: "remote", infrared: "remote", qt: "remote",
  zndb: "meteran", dlq: "meteran",
  ckmkzq: "pintu_garasi",
  sfkzq: "katup", ggq: "katup",
  cwwsq: "hewan", cwysj: "hewan", msp: "hewan",
};

export function jenisDari(category: string): JenisPerangkat {
  return PETA[category] ?? "lainnya";
}

/**
 * Perangkat yang menyala tanpa diawasi bisa berbahaya (panas, air, pintu).
 * Agen wajib meminta konfirmasi pengguna di chat (`confirm: true`) sebelum
 * MENYALAKAN / MEMBUKA-nya. Mematikan / menutup selalu boleh tanpa konfirmasi.
 */
export const JENIS_SENSITIF: ReadonlySet<JenisPerangkat> = new Set(["pemanas", "dapur", "pintu_garasi", "katup", "kunci"]);

export const LABEL_JENIS: Record<JenisPerangkat, { id: string; en: string }> = {
  lampu: { id: "Lampu", en: "Light" },
  saklar: { id: "Saklar", en: "Switch" },
  colokan: { id: "Colokan", en: "Plug" },
  ac: { id: "AC", en: "Air conditioner" },
  kipas: { id: "Kipas", en: "Fan" },
  tirai: { id: "Tirai", en: "Curtain" },
  pemanas: { id: "Pemanas", en: "Heater" },
  pembersih_udara: { id: "Pembersih udara", en: "Air purifier" },
  pelembap: { id: "Pelembap", en: "Humidifier" },
  sensor: { id: "Sensor", en: "Sensor" },
  keamanan: { id: "Alarm", en: "Alarm" },
  kamera: { id: "Kamera", en: "Camera" },
  kunci: { id: "Kunci pintu", en: "Door lock" },
  dapur: { id: "Alat dapur", en: "Kitchen appliance" },
  robot: { id: "Robot vakum", en: "Robot vacuum" },
  remote: { id: "Remote IR", en: "IR remote" },
  meteran: { id: "Meteran listrik", en: "Energy meter" },
  pintu_garasi: { id: "Pintu garasi", en: "Garage door" },
  katup: { id: "Katup air", en: "Water valve" },
  hewan: { id: "Hewan peliharaan", en: "Pet device" },
  lainnya: { id: "Perangkat", en: "Device" },
};
