import { and, eq } from "drizzle-orm";
import { denganPengguna, schema } from "@/lib/db";
import {
  daftarMerek,
  JSON_KELUAR_BELAJAR,
  jsonKirimPulsa,
  KEADAAN_UJI_LENGKAP,
  KEADAAN_UJI_NYALA,
  kodeMerek,
  merekDari,
  modeSumber,
  pulsaUntuk,
  pustakaBerprotokolPanasonic,
  sumberDari,
  VARIAN_PANASONIC_RAMAH,
  type KeadaanAc,
} from "@/lib/ir/kode-ac";
import { VARIAN_PANASONIC } from "@/lib/ir/protokol/panasonic";
import { catatAktivitas } from "./aktivitas";
import { GalatLayanan, normal, type Sumber } from "./dasar";
import { barisPerangkat, kemampuanDari, type BarisPerangkat } from "./rumah";
import { denganTuya, tanganiGalatTuya } from "./sambungan";

// Memasangkan kode remote ke AC yang dikendalikan lewat pemancar IR: pilih merek ->
// satu tes lengkap per kode -> simpan. Kami tidak bisa melihat AC, jadi "bereaksi"
// selalu dijawab pengguna.
//
// TIDAK ADA "rekam dari remote": rekaman pemancar dilaporkan lewat DP ir_study_code
// (raw, maks 128 byte) sedangkan satu tombol remote AC ~880 byte; layanan rekam
// resmi Tuya (/v1.0/infrareds/*/learning-codes) menolak kunci sk-. Dicoba di rumah
// pengguna pertama 2026-10-03: nilai rekaman tidak pernah berubah.

export { daftarMerek };

export type KodeMerek = { id: string; urutan: number; model: string[]; dibangun: boolean };

export function modelUntukMerek(merek: string): { merek: string; kode: KodeMerek[] } {
  const asli = daftarMerek().find((m) => normal(m.merek) === normal(merek));
  if (!asli) throw new GalatLayanan("tidak_ditemukan", `Merek "${merek}" tidak ada di pustaka kode. Pilih merek lain.`, { merek: daftarMerek().map((m) => m.merek) });
  const pustaka = kodeMerek(asli.merek);
  // Panasonic: sinyal DIBANGUN dari protokol (semua suhu/kipas/ayunan pasti ada) menggantikan rekaman pustaka yang tidak lengkap.
  const daftar =
    asli.merek === "Panasonic"
      ? [...VARIAN_PANASONIC_RAMAH.map((v) => ({ ...v, dibangun: true })), ...pustaka.filter((k) => !pustakaBerprotokolPanasonic().has(k.id)).map((k) => ({ ...k, dibangun: false }))]
      : pustaka.map((k) => ({ ...k, dibangun: false }));
  return { merek: asli.merek, kode: daftar.map((k, i) => ({ ...k, urutan: i + 1 })) };
}

async function acIr(penggunaId: string, deviceId: string): Promise<BarisPerangkat> {
  const b = await barisPerangkat(penggunaId, deviceId);
  if (!kemampuanDari(b).inframerah) throw new GalatLayanan("tidak_didukung", `"${b.nama}" bukan AC yang dikendalikan lewat remote inframerah.`);
  return b;
}

/** Pemancar IR di rumah yang sama (Tuya tidak memberi tahu pemancar mana yang memegang remote ini). */
export async function pemancarUntuk(penggunaId: string, deviceId: string): Promise<Array<{ id: string; nama: string; online: boolean }>> {
  const ac = await acIr(penggunaId, deviceId);
  const semua = await denganPengguna(penggunaId, (tx) => tx.select().from(schema.perangkat).where(eq(schema.perangkat.penggunaId, penggunaId)));
  const hub = semua.filter((b) => !b.hilangPada && kemampuanDari(b).pemancarIr);
  const serumah = hub.filter((b) => b.homeId && b.homeId === ac.homeId);
  return (serumah.length ? serumah : hub).map((b) => ({ id: b.deviceId, nama: b.nama, online: b.online }));
}

async function pilihPemancar(penggunaId: string, deviceId: string, pemancar?: string | null) {
  const daftar = await pemancarUntuk(penggunaId, deviceId);
  if (!daftar.length) throw new GalatLayanan("tidak_ditemukan", "Tidak ada pemancar remote inframerah di akunmu. Pasang dulu pemancarnya di app Smart Life.");
  const p = pemancar ? daftar.find((x) => x.id === pemancar) : (daftar.find((x) => x.online) ?? daftar[0]);
  if (!p) throw new GalatLayanan("tidak_ditemukan", "Pemancar yang dipilih tidak ada di rumah ini.");
  if (!p.online) throw new GalatLayanan("offline", `Pemancar remote "${p.nama}" sedang offline. Periksa listrik dan Wi-Fi-nya.`);
  return p;
}

export type JenisUji = "nyala" | "mati" | "lengkap";

const KEADAAN_UJI: Record<JenisUji, KeadaanAc> = { nyala: KEADAAN_UJI_NYALA, mati: { nyala: false }, lengkap: KEADAAN_UJI_LENGKAP };

const PERTANYAAN_UJI: Record<JenisUji, string> = {
  nyala: "Kode NYALAKAN (dingin 24 derajat, kipas otomatis) sudah dipancarkan. Apakah AC menyala atau berbunyi bip?",
  mati: "Kode MATIKAN sudah dipancarkan. Apakah AC mati atau berbunyi bip?",
  lengkap: "Kode TES LENGKAP sudah dipancarkan: nyala, dingin 27 derajat, kipas kencang, ayunan. Apakah AC menyala dengan layar 27, kipas kencang, DAN bilahnya bergerak? Kalau hanya sebagian, coba kode berikutnya.",
};

async function pancarkan(penggunaId: string, hubId: string, pulsa: number[][]) {
  await denganTuya(penggunaId, async (klien) => {
    try {
      // Keluar dari mode belajar dulu: pemancar yang sedang belajar tidak memancarkan.
      await klien.kirimProperti(hubId, { ir_send: JSON_KELUAR_BELAJAR });
      for (const [i, p] of pulsa.entries()) {
        if (i > 0) await new Promise((r) => setTimeout(r, 700));
        await klien.kirimProperti(hubId, { ir_send: jsonKirimPulsa(p) });
      }
    } catch (e) {
      return tanganiGalatTuya(penggunaId, e);
    }
  });
}

export type HasilUji = { terkirim: true; uji: JenisUji; merek: string; pemancar: string; keterangan: string };

/** Kirim satu tes lewat pemancar. `kode` = id pustaka/varian; tanpa kode = kode yang sudah tersimpan. */
export async function ujiKodeAc(penggunaId: string, deviceId: string, kode: string | null, uji: JenisUji, pemancarId: string | null, sumber: Sumber): Promise<HasilUji> {
  const ac = await acIr(penggunaId, deviceId);
  const id = kode ?? ac.kodeIr?.pustaka;
  if (!id) throw new GalatLayanan("ir_belum_dipasang", "Pilih kode yang mau dites dulu.");
  const s = sumberDari(id, id === ac.kodeIr?.pustaka ? ac.kodeIr?.templat : null);
  if (!s) throw new GalatLayanan("tidak_ditemukan", "Kode remote itu tidak ada di pustaka.");
  const hub = await pilihPemancar(penggunaId, deviceId, pemancarId ?? (kode ? null : ac.kodeIr?.pemancar));
  const h = pulsaUntuk(s, KEADAAN_UJI[uji], uji === "mati");
  if (!h.ok) throw new GalatLayanan("tidak_didukung", h.pesan);
  await pancarkan(penggunaId, hub.id, h.pulsa);
  const merek = s.jenis === "panasonic" ? "Panasonic" : s.p.merek;
  await catatAktivitas(penggunaId, { sumber, jenis: "kendali", deviceId, ringkasan: `${ac.nama}: tes kode remote ${merek} ${id} (${uji})` });
  return { terkirim: true, uji, merek, pemancar: hub.nama, keterangan: PERTANYAAN_UJI[uji] };
}

async function simpan(penggunaId: string, ac: BarisPerangkat, kodeIr: NonNullable<BarisPerangkat["kodeIr"]>, sumber: Sumber, catatan: string) {
  await denganPengguna(penggunaId, (tx) =>
    tx.update(schema.perangkat).set({ kodeIr }).where(and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, ac.deviceId))),
  );
  await catatAktivitas(penggunaId, { sumber, jenis: "lainnya", deviceId: ac.deviceId, ringkasan: `${ac.nama}: ${catatan}` });
}

/** Simpan kode yang sudah terbukti membuat AC bereaksi. */
export async function simpanKodeAc(penggunaId: string, deviceId: string, kode: string, pemancarId: string | null, sumber: Sumber) {
  const ac = await acIr(penggunaId, deviceId);
  if (kode === "pana:rekam") throw new GalatLayanan("masukan", "Kode rekaman tersimpan otomatis saat merekam.");
  const s = sumberDari(kode);
  if (!s) throw new GalatLayanan("tidak_ditemukan", "Kode remote itu tidak ada di pustaka.");
  const merek = s.jenis === "panasonic" ? "Panasonic" : (merekDari(kode) ?? s.p.merek);
  const hub = await pilihPemancar(penggunaId, deviceId, pemancarId);
  await simpan(penggunaId, ac, { pustaka: kode, merek, pemancar: hub.id, dipasang: new Date().toISOString() }, sumber, `kode remote ${merek} ${kode} dipasangkan (lewat ${hub.nama})`);
  return { merek, pustaka: kode, pemancar: hub.nama, mode: modeSumber(s), dibangun: s.jenis === "panasonic" };
}

export async function hapusKodeAc(penggunaId: string, deviceId: string, sumber: Sumber) {
  const ac = await acIr(penggunaId, deviceId);
  await denganPengguna(penggunaId, (tx) =>
    tx.update(schema.perangkat).set({ kodeIr: null }).where(and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, deviceId))),
  );
  await catatAktivitas(penggunaId, { sumber, jenis: "lainnya", deviceId, ringkasan: `${ac.nama}: kode remote dilepas` });
}

const rata = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, "");

let petaVarianPanasonic: Map<string, string> | null = null;
/** Id pustaka Panasonic berprotokol -> varian "pana:N" dengan byte model yang sama. */
function varianUntukPustaka(id: string): string | null {
  if (!petaVarianPanasonic) {
    petaVarianPanasonic = new Map();
    for (const pid of pustakaBerprotokolPanasonic()) {
      const s = sumberDari(pid);
      if (s?.jenis !== "panasonic") continue;
      const t = s.templat;
      const v = VARIAN_PANASONIC.find((x) => x.bita[0] === (t[13] & 0x08) && x.bita[1] === t[17] && x.bita[2] === t[19] && x.bita[3] === t[20] && x.bita[4] === t[23] && x.bita[5] === t[25]);
      if (v) petaVarianPanasonic.set(pid, `pana:${v.id}`);
    }
  }
  return petaVarianPanasonic.get(id) ?? null;
}

export type HasilCariModel = { merek: string; id: string; model: string; cocok: "persis" | "mirip" };

/**
 * Cari kode dari kode model di stiker unit AC / remote (mis. "CS-RE9GKE", "A75C3208").
 * Persis = kode model tercantum di pustaka; mirip = awalan seri sama (mis. CS-RE...).
 */
export function cariKodeModel(kueri: string): HasilCariModel[] {
  const q = rata(kueri);
  if (q.length < 3) throw new GalatLayanan("masukan", "Ketik minimal 3 huruf/angka dari kode model.");
  const hasil: Array<HasilCariModel & { skor: number }> = [];
  for (const m of daftarMerek()) {
    for (const k of kodeMerek(m.merek)) {
      for (const model of k.model) {
        // Satu baris bisa memuat beberapa model ("SRK25ZMP-S, SRK35ZMP-S").
        for (const bagian of model.split(/[,/;]|\s+-\s+/)) {
          const r = rata(bagian);
          if (r.length < 3) continue;
          let skor = 0;
          if (r === q) skor = 100;
          else if (r.includes(q) || q.includes(r)) skor = 80;
          else {
            let n = 0;
            while (n < Math.min(r.length, q.length) && r[n] === q[n]) n++;
            if (n >= 4) skor = 40 + n;
          }
          if (!skor) continue;
          const id = varianUntukPustaka(k.id) ?? k.id;
          hasil.push({ merek: m.merek, id, model: bagian.trim(), cocok: skor >= 80 ? "persis" : "mirip", skor });
        }
      }
    }
  }
  // Panasonic tanpa kecocokan: kode CS-/CU- tetap Panasonic -> semua varian buatan protokol.
  if (!hasil.some((x) => x.merek === "Panasonic") && /^(CS|CU)/.test(q)) {
    VARIAN_PANASONIC_RAMAH.forEach((v, i) => hasil.push({ merek: "Panasonic", id: v.id, model: v.model[0], cocok: "mirip", skor: 30 - i }));
  }
  const unik = new Map<string, HasilCariModel & { skor: number }>();
  for (const h of hasil.sort((a, b) => b.skor - a.skor)) if (!unik.has(h.id)) unik.set(h.id, h);
  return [...unik.values()].slice(0, 8).map((h) => ({ merek: h.merek, id: h.id, model: h.model, cocok: h.cocok }));
}
