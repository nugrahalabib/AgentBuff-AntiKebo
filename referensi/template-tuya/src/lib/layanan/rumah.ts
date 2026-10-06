import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { denganPengguna, schema } from "@/lib/db";
import { JSON_KELUAR_BELAJAR, jsonKirimPulsa, pulsaUntuk, sumberDari } from "@/lib/ir/kode-ac";
import { log } from "@/lib/log";
import { jenisDari, JENIS_SENSITIF, LABEL_JENIS, type JenisPerangkat } from "@/lib/tuya/jenis";
import { bacaKeadaan, nilaiBacaan, pilihanBermakna, rakitKemampuan, terjemahkan, uraikanKemampuan, type KeadaanRamah, type Kemampuan, type PerintahRamah } from "@/lib/tuya/kemampuan";
import { GalatTuya, type KlienTuya } from "@/lib/tuya/klien";
import { bandingkanLaporan } from "@/lib/tuya/konfirmasi";
import type { ModelPerangkat, PerangkatRingkas } from "@/lib/tuya/tipe";
import { catatAktivitas } from "./aktivitas";
import { GalatLayanan, normal, type Sumber } from "./dasar";
import { denganTuya, tanganiGalatTuya } from "./sambungan";

// Rumah = cermin perangkat Tuya di tabel `perangkat` + struktur rumah/ruangan
// di `sambungan_tuya.struktur`. Layar & agen membaca cermin (cepat, tanpa
// memukul batas laju Tuya); worker menyegarkan lewat WebSocket + sinkron berkala.

export type Struktur = {
  rumah: Array<{ id: string; nama: string; peran: string | null; lat: string | null; lon: string | null; ruangan: Array<{ id: string; nama: string }> }>;
};

export type RingkasanSinkron = { rumah: number; ruangan: number; perangkat: number; online: number };

const MODEL_BASI_MS = 7 * 24 * 60 * 60 * 1000;

/** Jalankan `fn` untuk setiap butir dengan paling banyak `n` serentak (sopan ke batas laju Tuya). */
export async function petaTerbatas<T, R>(daftar: T[], n: number, fn: (x: T) => Promise<R>): Promise<Array<PromiseSettledResult<R>>> {
  const hasil: Array<PromiseSettledResult<R>> = new Array(daftar.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, daftar.length) }, async () => {
      while (i < daftar.length) {
        const k = i++;
        try {
          hasil[k] = { status: "fulfilled", value: await fn(daftar[k]) };
        } catch (e) {
          hasil[k] = { status: "rejected", reason: e };
        }
      }
    }),
  );
  return hasil;
}

/**
 * Sinkron penuh: rumah, ruangan, perangkat, keadaan, dan model yang belum ada/basi.
 * Perangkat yang hilang dari akun ditandai `hilang_pada`, tidak dihapus (suasana/jadwal
 * yang merujuknya tetap terbaca dan bisa dijelaskan).
 */
export async function sinkronkan(penggunaId: string, klien: KlienTuya): Promise<RingkasanSinkron> {
  const rumah = await klien.rumah();
  const struktur: Struktur = { rumah: [] };
  const perangkat: Array<PerangkatRingkas & { home_id: string }> = [];
  for (const r of rumah) {
    const [ruangan, alat] = await Promise.all([klien.ruangan(r.home_id).catch(() => []), klien.perangkatRumah(r.home_id)]);
    struktur.rumah.push({
      id: String(r.home_id),
      nama: r.name,
      peran: r.role ?? null,
      lat: r.latitude?.Value ?? null,
      lon: r.longitude?.Value ?? null,
      ruangan: ruangan.map((x) => ({ id: String(x.room_id), nama: x.name })),
    });
    for (const d of alat) perangkat.push({ ...d, home_id: String(r.home_id) });
  }
  // Perangkat yang tidak terikat rumah mana pun (jarang) tetap ikut.
  if (rumah.length === 0) {
    for (const d of await klien.semuaPerangkat()) perangkat.push({ ...d, home_id: "" });
  }

  const ada = await denganPengguna(penggunaId, (tx) =>
    tx.select({ deviceId: schema.perangkat.deviceId, modelDiperbarui: schema.perangkat.modelDiperbarui }).from(schema.perangkat).where(eq(schema.perangkat.penggunaId, penggunaId)),
  );
  const modelLama = new Map(ada.map((a) => [a.deviceId, a.modelDiperbarui]));
  const butuhModel = perangkat.filter((d) => {
    const t = modelLama.get(d.device_id);
    return !t || Date.now() - t.getTime() > MODEL_BASI_MS;
  });

  const [detail, model] = await Promise.all([
    petaTerbatas(perangkat, 3, (d) => klien.detail(d.device_id)),
    petaTerbatas(butuhModel, 3, (d) => klien.model(d.device_id)),
  ]);
  const modelPer = new Map<string, ModelPerangkat>();
  butuhModel.forEach((d, i) => {
    const m = model[i];
    if (m.status === "fulfilled") modelPer.set(d.device_id, m.value);
  });

  const kini = new Date();
  const idSekarang = new Set<string>();
  await denganPengguna(penggunaId, async (tx) => {
    for (const [i, d] of perangkat.entries()) {
      idSekarang.add(d.device_id);
      const det = detail[i].status === "fulfilled" ? detail[i].value : null;
      const m = modelPer.get(d.device_id);
      const nilai = {
        homeId: d.home_id || null,
        roomId: d.room_id ? String(d.room_id) : null,
        nama: (det?.name || d.name || "Perangkat").slice(0, 120),
        kategori: d.category || det?.category || "",
        kategoriNama: d.category_name ?? det?.category_name ?? null,
        produkNama: det?.product_name ?? null,
        online: det ? det.online : d.online,
        hilangPada: null,
        diubah: kini,
        ...(det?.properties ? { properti: det.properties, propertiDiperbarui: kini } : {}),
        ...(m ? { model: m, modelDiperbarui: kini } : {}),
      };
      await tx
        .insert(schema.perangkat)
        .values({ penggunaId, deviceId: d.device_id, ...nilai })
        .onConflictDoUpdate({ target: [schema.perangkat.penggunaId, schema.perangkat.deviceId], set: nilai });
    }
    for (const a of ada) {
      if (!idSekarang.has(a.deviceId)) {
        await tx
          .update(schema.perangkat)
          .set({ hilangPada: sql`coalesce(${schema.perangkat.hilangPada}, now())`, online: false })
          .where(and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, a.deviceId)));
      }
    }
    await tx
      .update(schema.sambunganTuya)
      .set({
        struktur,
        strukturDiperbarui: kini,
        diperiksaPada: kini,
        status: "aktif",
        statusPesan: null,
        rumahUtamaId: sql`coalesce(${schema.sambunganTuya.rumahUtamaId}, ${struktur.rumah[0]?.id ?? null})`,
      })
      .where(eq(schema.sambunganTuya.penggunaId, penggunaId));
  });

  return {
    rumah: struktur.rumah.length,
    ruangan: struktur.rumah.reduce((n, r) => n + r.ruangan.length, 0),
    perangkat: perangkat.length,
    online: perangkat.filter((d, i) => (detail[i].status === "fulfilled" ? (detail[i] as PromiseFulfilledResult<{ online: boolean }>).value.online : d.online)).length,
  };
}

export async function sinkronkanPengguna(penggunaId: string): Promise<RingkasanSinkron> {
  return denganTuya(penggunaId, (k) => sinkronkan(penggunaId, k));
}

// ------------------------------------------------------------------- baca

export type PerangkatRamah = {
  id: string;
  nama: string;
  jenis: JenisPerangkat;
  jenisLabel: string;
  kategori: string;
  rumahId: string | null;
  rumah: string | null;
  ruanganId: string | null;
  ruangan: string | null;
  online: boolean;
  hilang: boolean;
  sensitif: boolean;
  disembunyikan: boolean;
  keadaan: KeadaanRamah;
  bisa: string[];
  punyaModel: boolean;
  diperbarui: string | null;
  kontrol: Kontrol;
};

/** Spesifikasi kontrol untuk layar (tanpa kode mentah yang tidak perlu). */
export type Kontrol = {
  daya: boolean;
  saluran: number[];
  terang: boolean;
  warna: boolean;
  suhuPutih: boolean;
  suhuTarget: { min: number; max: number; langkah: number } | null;
  /** Pilihan mode dalam MAKNA (cold/hot/...), juga untuk AC remote IR yang aslinya "0".."4". */
  modeAc: string[];
  kipas: { pilihan: string[] } | { min: number; max: number } | null;
  /** Mode lampu: white / colour / scene / music. */
  modeLampu: string[];
  /** Timer bawaan perangkat (menit maksimum). */
  hitungMundur: { maksMenit: number } | null;
  tirai: string[];
  posisi: boolean;
  listrik: boolean;
  /** Dikendalikan lewat remote IR: keadaan asli tidak bisa dibaca balik. */
  inframerah: boolean;
  /** Hub pemancar IR (bukan perangkat yang dikendalikan). */
  pemancarIr: boolean;
  /** AC remote IR: kode remote yang sudah dipasangkan (null = belum, AC belum bisa dikendalikan). */
  kodeIr: { merek: string; pustaka: string; pemancar: string } | null;
  lainnya: Array<{ kode: string; nama: string; tipe: "bool" | "value" | "enum" | "string"; min?: number; max?: number; langkah?: number; skala?: number; satuan?: string; pilihan?: string[] }>;
  /** Semua yang hanya dilaporkan perangkat (sensor, status, alarm), sudah diskalakan. */
  bacaan: Array<{ kode: string; nama: string; nilai: string | number | boolean | string[] | null; satuan: string }>;
};

function kontrolDari(k: Kemampuan, kodeIr: BarisPerangkat["kodeIr"] = null, properti: Record<string, unknown> | null = null): Kontrol {
  const skala = (x: { scale: number }) => 10 ** x.scale;
  return {
    daya: !!k.daya,
    saluran: k.saluran?.map((s) => s.nomor) ?? [],
    terang: !!k.terang,
    warna: !!k.warna,
    suhuPutih: !!k.suhuPutih,
    suhuTarget: k.suhuTarget ? { min: k.suhuTarget.min / skala(k.suhuTarget), max: k.suhuTarget.max / skala(k.suhuTarget), langkah: k.suhuTarget.step / skala(k.suhuTarget) } : null,
    modeAc: k.modeAc ? pilihanBermakna(k.modeAc) : [],
    kipas: k.kipas ? ("pilihan" in k.kipas ? { pilihan: pilihanBermakna(k.kipas) } : { min: k.kipas.min, max: k.kipas.max }) : null,
    modeLampu: k.modeKerja?.pilihan ?? [],
    hitungMundur: k.hitungMundur ? { maksMenit: Math.floor(k.hitungMundur.max / skala(k.hitungMundur) / 60) } : null,
    tirai: k.tirai?.pilihan ?? [],
    posisi: !!k.posisi,
    listrik: !!k.listrik,
    inframerah: !!k.inframerah,
    pemancarIr: !!k.pemancarIr,
    kodeIr: k.inframerah && kodeIr ? { merek: kodeIr.merek, pustaka: kodeIr.pustaka, pemancar: kodeIr.pemancar } : null,
    bacaan: k.bacaan.filter((p) => properti && p.code in properti).map((p) => ({ kode: p.code, nama: p.name || p.code, ...nilaiBacaan(p, properti?.[p.code]) })),
    lainnya: k.lainnya.map((p) => {
      const t = p.typeSpec as Record<string, unknown> & { type: string };
      return {
        kode: p.code,
        nama: p.name || p.code,
        tipe: t.type as "bool" | "value" | "enum" | "string",
        ...(t.type === "value" ? { min: t.min as number, max: t.max as number, langkah: (t.step as number) || 1, skala: (t.scale as number) || 0, satuan: (t.unit as string) || "" } : {}),
        ...(t.type === "enum" ? { pilihan: (t.range as string[]) ?? [] } : {}),
      };
    }),
  };
}

export type BarisPerangkat = typeof schema.perangkat.$inferSelect;

export function kemampuanDari(b: Pick<BarisPerangkat, "model"> & Partial<Pick<BarisPerangkat, "properti">>): Kemampuan {
  return rakitKemampuan(b.model as ModelPerangkat | null, (b.properti as Record<string, unknown> | null | undefined) ?? undefined);
}

/** AC yang dikendalikan lewat remote IR tercatat Tuya sebagai kategori remote; tampilkan sebagai AC. */
function jenisEfektif(b: Pick<BarisPerangkat, "kategori">, k: Kemampuan): JenisPerangkat {
  const j = jenisDari(b.kategori);
  return j === "remote" && k.inframerah && k.suhuTarget && k.modeAc ? "ac" : j;
}

export function sensitif(b: Pick<BarisPerangkat, "kategori" | "sensitifManual">): boolean {
  return b.sensitifManual ?? JENIS_SENSITIF.has(jenisDari(b.kategori));
}

export function ramahkan(b: BarisPerangkat, struktur: Struktur | null): PerangkatRamah {
  const rumah = struktur?.rumah.find((r) => r.id === b.homeId) ?? null;
  const ruangan = rumah?.ruangan.find((x) => x.id === b.roomId) ?? null;
  const k = kemampuanDari(b);
  const jenis = jenisEfektif(b, k);
  return {
    id: b.deviceId,
    nama: b.nama,
    jenis,
    jenisLabel: jenis === "ac" && k.inframerah ? "AC (lewat remote IR)" : k.pemancarIr ? LABEL_JENIS.remote.id : b.kategoriNama || LABEL_JENIS[jenis].id,
    kategori: b.kategori,
    rumahId: b.homeId,
    rumah: rumah?.nama ?? null,
    ruanganId: b.roomId,
    ruangan: ruangan?.nama ?? null,
    online: b.online,
    hilang: b.hilangPada != null,
    sensitif: sensitif(b),
    disembunyikan: b.disembunyikan,
    // AC remote tanpa kode: "nyala" di cermin hanya tebakan (shadow), bukan keadaan AC.
    keadaan: k.inframerah && !b.kodeIr ? { ...bacaKeadaan(k, b.properti), nyala: null } : bacaKeadaan(k, b.properti),
    bisa: uraikanKemampuan(k),
    punyaModel: b.model != null,
    diperbarui: b.propertiDiperbarui?.toISOString() ?? null,
    kontrol: kontrolDari(k, b.kodeIr, b.properti),
  };
}

export async function bacaStruktur(penggunaId: string): Promise<Struktur | null> {
  const [s] = await denganPengguna(penggunaId, (tx) =>
    tx.select({ struktur: schema.sambunganTuya.struktur }).from(schema.sambunganTuya).where(eq(schema.sambunganTuya.penggunaId, penggunaId)).limit(1),
  );
  return (s?.struktur as Struktur | null) ?? null;
}

export type SaringPerangkat = { rumahId?: string; ruangan?: string; jenis?: JenisPerangkat; kata?: string; hanyaOnline?: boolean; termasukTersembunyi?: boolean };

export async function daftarPerangkat(penggunaId: string, saring: SaringPerangkat = {}): Promise<PerangkatRamah[]> {
  const [baris, struktur] = await Promise.all([
    denganPengguna(penggunaId, (tx) =>
      tx
        .select()
        .from(schema.perangkat)
        .where(and(eq(schema.perangkat.penggunaId, penggunaId), isNull(schema.perangkat.hilangPada)))
        .orderBy(asc(schema.perangkat.urutan), asc(schema.perangkat.nama)),
    ),
    bacaStruktur(penggunaId),
  ]);
  const kataRuang = saring.ruangan ? normal(saring.ruangan) : null;
  const kata = saring.kata ? normal(saring.kata) : null;
  return baris
    .map((b) => ramahkan(b, struktur))
    .filter((p) => saring.termasukTersembunyi || !p.disembunyikan)
    .filter((p) => !saring.rumahId || p.rumahId === saring.rumahId)
    .filter((p) => !kataRuang || (p.ruangan ? normal(p.ruangan).includes(kataRuang) || p.ruanganId === saring.ruangan : false))
    .filter((p) => !saring.jenis || p.jenis === saring.jenis)
    .filter((p) => !saring.hanyaOnline || p.online)
    .filter((p) => !kata || normal(p.nama).includes(kata) || normal(p.jenisLabel).includes(kata));
}

/**
 * Temukan satu perangkat dari id atau nama bebas ("lampu meja", "ac studio").
 * Urutan: id persis > nama persis > nama diawali > nama memuat > semua kata ada.
 * Lebih dari satu kandidat di tingkat terbaik -> galat `ambigu` + daftar kandidat.
 */
export async function cariPerangkat(penggunaId: string, rujukan: string): Promise<PerangkatRamah> {
  const semua = await daftarPerangkat(penggunaId, { termasukTersembunyi: true });
  const persisId = semua.find((p) => p.id === rujukan.trim());
  if (persisId) return persisId;
  const r = normal(rujukan);
  if (!r) throw new GalatLayanan("masukan", "Sebutkan nama perangkatnya.");
  const kata = r.split(" ");
  const label = (p: PerangkatRamah) => normal(p.nama);
  const labelRuang = (p: PerangkatRamah) => normal(`${p.nama} ${p.ruangan ?? ""}`);
  const tingkat: Array<(p: PerangkatRamah) => boolean> = [
    (p) => label(p) === r,
    (p) => label(p).startsWith(r),
    (p) => label(p).includes(r),
    (p) => kata.every((k) => labelRuang(p).split(" ").some((w) => w.startsWith(k))),
  ];
  for (const uji of tingkat) {
    const cocok = semua.filter(uji);
    if (cocok.length === 1) return cocok[0];
    if (cocok.length > 1) {
      throw new GalatLayanan("ambigu", `Ada ${cocok.length} perangkat yang cocok dengan "${rujukan}". Pilih salah satu.`, {
        kandidat: cocok.slice(0, 10).map((p) => ({ id: p.id, nama: p.nama, ruangan: p.ruangan })),
      });
    }
  }
  throw new GalatLayanan("tidak_ditemukan", `Perangkat "${rujukan}" tidak ditemukan.`, {
    contoh: semua.slice(0, 15).map((p) => p.nama),
  });
}

// ----------------------------------------------------------------- kendali

export async function barisPerangkat(penggunaId: string, deviceId: string): Promise<BarisPerangkat> {
  const [b] = await denganPengguna(penggunaId, (tx) =>
    tx.select().from(schema.perangkat).where(and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, deviceId))).limit(1),
  );
  if (!b) throw new GalatLayanan("tidak_ditemukan", "Perangkat tidak ditemukan.");
  return b;
}

/** Pastikan model perangkat ada (diambil sekali, disimpan seminggu). */
async function pastikanModel(penggunaId: string, b: BarisPerangkat, klien: KlienTuya): Promise<BarisPerangkat> {
  if (b.model && b.modelDiperbarui && Date.now() - b.modelDiperbarui.getTime() < MODEL_BASI_MS) return b;
  const m = await klien.model(b.deviceId);
  await denganPengguna(penggunaId, (tx) =>
    tx
      .update(schema.perangkat)
      .set({ model: m, modelDiperbarui: new Date() })
      .where(and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, b.deviceId))),
  );
  return { ...b, model: m, modelDiperbarui: new Date() };
}

/**
 * terkonfirmasi = perangkat melaporkan keadaan baru; belum_terkonfirmasi = Tuya
 * menerima perintah tapi perangkat belum melaporkan perubahan; terkirim =
 * perangkat tidak melaporkan balik nilai itu; ir = sinyal remote dipancarkan
 * (AC remote tidak bisa melapor balik).
 */
export type StatusKendali = "terkonfirmasi" | "belum_terkonfirmasi" | "terkirim" | "ir";
export type HasilKendali = { perangkat: PerangkatRamah; ringkasan: string; status: StatusKendali; catatan: string };

const JEDA_KONFIRMASI = [800, 1200, 1800];

/** Tunggu sampai Tuya melaporkan keadaan baru (maks ~4 detik). */
async function tungguLaporan(klien: KlienTuya, b: BarisPerangkat, k: Kemampuan, harap: Record<string, unknown>) {
  let nyata: Record<string, unknown> | null = null;
  let status: ReturnType<typeof bandingkanLaporan>["status"] = "tak_terukur";
  for (const jeda of JEDA_KONFIRMASI) {
    await tunggu(jeda);
    const d = await klien.detail(b.deviceId).catch(() => null);
    if (!d) continue;
    nyata = d.properties ?? null;
    status = bandingkanLaporan(k, b.model as ModelPerangkat | null, harap, nyata).status;
    if (status !== "beda") break;
  }
  return { status, nyata };
}

function catatanStatus(status: StatusKendali, nama: string, pemancar?: string): string {
  if (status === "terkonfirmasi") return `${nama} sudah melaporkan keadaan barunya.`;
  if (status === "belum_terkonfirmasi")
    return `Perintah diterima server Tuya, tapi ${nama} belum melaporkan perubahan dalam 4 detik. Belum tentu berhasil: cek perangkatnya, atau coba lagi.`;
  if (status === "ir") return `Sinyal remote dipancarkan${pemancar ? ` lewat ${pemancar}` : ""}. AC remote tidak bisa melapor balik, jadi pastikan AC berbunyi bip atau berubah.`;
  return `Perintah terkirim ke ${nama} (perangkat ini tidak melaporkan balik nilai tersebut).`;
}

/** Dimatikan / ditutup / berhenti selalu aman; menyalakan perangkat sensitif butuh konfirmasi. */
export function menyalakan(cmd: PerintahRamah): boolean {
  return cmd.nyala === true || cmd.tirai === "buka" || cmd.suhuTarget !== undefined || cmd.modeAc !== undefined || cmd.modeLampu !== undefined || cmd.kipas !== undefined || cmd.properti !== undefined || cmd.terangPersen !== undefined;
}

export async function kendalikan(
  penggunaId: string,
  deviceId: string,
  cmd: PerintahRamah,
  opsi: { sumber: Sumber; konfirmasi?: boolean },
): Promise<HasilKendali> {
  let b = await barisPerangkat(penggunaId, deviceId);
  if (b.hilangPada) throw new GalatLayanan("tidak_ditemukan", `"${b.nama}" tidak ada lagi di akun Smart Life/Tuya-mu.`);
  if (!b.online) {
    throw new GalatLayanan("offline", `"${b.nama}" sedang offline. Periksa listrik dan Wi-Fi perangkatnya, lalu coba lagi.`);
  }
  if (opsi.sumber === "agen" && sensitif(b) && menyalakan(cmd) && !opsi.konfirmasi) {
    throw new GalatLayanan("perlu_konfirmasi", `"${b.nama}" termasuk perangkat yang bisa berbahaya bila menyala tanpa diawasi. Tanyakan dulu ke pengguna, lalu ulangi dengan confirm: true.`, {
      perangkat: b.nama,
    });
  }
  return denganTuya(penggunaId, async (klien) => {
    b = await pastikanModel(penggunaId, b, klien);
    const k = kemampuanDari(b);
    const t = terjemahkan(k, cmd, b.properti);
    if (!t.ok) {
      const kode = t.kode === "kosong" ? "masukan" : t.kode;
      throw new GalatLayanan(kode, t.pesan, { bisa: uraikanKemampuan(k) });
    }
    let pemancar: string | undefined;
    try {
      // AC lewat remote IR: Tuya tidak mengubah properti jadi sinyal IR, kita yang mengirimnya.
      if (k.inframerah) pemancar = await kirimIrAc(penggunaId, klien, b, k, t);
      await klien.kirimProperti(b.deviceId, t.properti);
    } catch (e) {
      await catatAktivitas(penggunaId, { sumber: opsi.sumber, jenis: "kendali", deviceId: b.deviceId, ringkasan: `${b.nama}: ${t.ringkasan.join(", ")}`, berhasil: false, galat: (e as Error).message });
      if (e instanceof GalatLayanan) throw e;
      if (e instanceof GalatTuya && e.jenis === "perangkat_offline") {
        await denganPengguna(penggunaId, (tx) =>
          tx.update(schema.perangkat).set({ online: false }).where(and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, b.deviceId))),
        );
        throw new GalatLayanan("offline", `"${b.nama}" sedang offline menurut Tuya. Periksa listrik dan Wi-Fi perangkatnya, lalu coba lagi.`);
      }
      return tanganiGalatTuya(penggunaId, e);
    }
    // Bukan "selesai" sebelum perangkat melapor: shadow/issue hanya berarti server Tuya menerima.
    let status: StatusKendali = "ir";
    let propBaru: Record<string, unknown> = { ...(b.properti ?? {}), ...t.properti };
    if (!k.inframerah) {
      const l = await tungguLaporan(klien, b, k, t.properti);
      status = l.status === "cocok" ? "terkonfirmasi" : l.status === "beda" ? "belum_terkonfirmasi" : "terkirim";
      if (l.nyata && status !== "terkirim") propBaru = { ...(b.properti ?? {}), ...l.nyata };
    }
    const catatan = catatanStatus(status, b.nama, pemancar);
    await denganPengguna(penggunaId, (tx) =>
      tx
        .update(schema.perangkat)
        .set({ properti: propBaru, propertiDiperbarui: new Date() })
        .where(and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, b.deviceId))),
    );
    const ringkasan = `${b.nama}: ${t.ringkasan.join(", ")}`;
    await catatAktivitas(penggunaId, {
      sumber: opsi.sumber,
      jenis: "kendali",
      deviceId: b.deviceId,
      ringkasan,
      detail: { properti: t.properti, status },
      ...(status === "belum_terkonfirmasi" ? { berhasil: false, galat: "Perangkat belum melaporkan perubahan" } : {}),
    });
    // Otomasi berpemicu perangkat ini (mis. "kalau lampu teras nyala, nyalakan lampu taman").
    // Cermin sudah optimis, jadi pesan WebSocket berikutnya tidak lagi melihat tepinya.
    const sebelum = { online: true, properti: b.properti ?? {} };
    void import("./otomasi")
      .then((m) => m.evaluasiPerubahan(penggunaId, b.deviceId, sebelum, { online: true, properti: propBaru }))
      .catch((e) => log.warn({ err: (e as Error)?.message }, "evaluasi otomasi gagal"));
    return { perangkat: ramahkan({ ...b, properti: propBaru }, await bacaStruktur(penggunaId)), ringkasan, status, catatan };
  });
}

const tunggu = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Teks galat untuk AC remote IR yang belum punya kode (dipakai web, agen, jadwal). */
export function pesanIrBelumDipasang(nama: string): string {
  return `"${nama}" dikendalikan lewat pemancar remote inframerah. Pasangkan dulu kode remote AC-nya (sekali saja: pilih merek AC lalu tes sampai AC bereaksi) di layar perangkat ini di tuya.agentbuff.id, atau minta agen "pasangkan kode remote AC".`;
}

/**
 * Kirim sinyal IR ke AC lewat pemancarnya, sesuai keadaan sesudah perintah.
 * Suhu yang tidak ada di kode remote disesuaikan ke yang terdekat (ditulis ke `t`).
 */
async function kirimIrAc(penggunaId: string, klien: KlienTuya, b: BarisPerangkat, k: Kemampuan, t: { properti: Record<string, unknown>; ringkasan: string[] }): Promise<string> {
  if (!b.kodeIr) throw new GalatLayanan("ir_belum_dipasang", pesanIrBelumDipasang(b.nama), { perangkat: b.nama });
  const pustaka = sumberDari(b.kodeIr.pustaka, b.kodeIr.templat);
  if (!pustaka) throw new GalatLayanan("ir_belum_dipasang", pesanIrBelumDipasang(b.nama), { perangkat: b.nama });
  const hub = await barisPerangkat(penggunaId, b.kodeIr.pemancar).catch(() => null);
  if (!hub || hub.hilangPada) throw new GalatLayanan("ir_belum_dipasang", `Pemancar remote untuk "${b.nama}" tidak ditemukan lagi. Pasangkan ulang kode remote AC-nya.`);
  if (!hub.online) throw new GalatLayanan("offline", `Pemancar remote "${hub.nama}" sedang offline. Periksa listrik dan Wi-Fi-nya, lalu coba lagi.`);

  const target = { ...(b.properti ?? {}), ...t.properti };
  const s = bacaKeadaan(k, target);
  const sebelum = bacaKeadaan(k, b.properti ?? {});
  const h = pulsaUntuk(pustaka, { nyala: s.nyala === true, mode: s.modeAc, kipas: s.kipas, suhu: s.suhuTarget, ayun: target.swing === true }, sebelum.nyala === true);
  if (!h.ok) throw new GalatLayanan("nilai_tidak_sah", h.pesan);

  if (typeof hub.properti?.ir_send === "string" && hub.properti.ir_send.includes('"study"')) {
    await klien.kirimProperti(hub.deviceId, { ir_send: JSON_KELUAR_BELAJAR });
    await denganPengguna(penggunaId, (tx) =>
      tx
        .update(schema.perangkat)
        .set({ properti: { ...(hub.properti ?? {}), ir_send: JSON_KELUAR_BELAJAR } })
        .where(and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, hub.deviceId))),
    );
  }
  for (const [i, pulsa] of h.pulsa.entries()) {
    if (i > 0) await tunggu(700);
    await klien.kirimProperti(hub.deviceId, { ir_send: jsonKirimPulsa(pulsa) });
  }
  if (s.nyala && k.suhuTarget && h.dipakai.suhu !== undefined && h.dipakai.suhu !== s.suhuTarget) {
    t.properti[k.suhuTarget.kode] = h.dipakai.suhu;
    if (!(k.daya && k.daya.kode in t.properti)) t.properti[k.daya?.kode ?? "switch_power"] = true;
    t.ringkasan.push(`suhu disesuaikan ke ${h.dipakai.suhu}° (batas remote AC)`);
  }
  return hub.nama;
}

export type HasilBanyak = { berhasil: Array<{ id: string; nama: string; ringkasan: string; status: StatusKendali }>; gagal: Array<{ id: string; nama: string; alasan: string; kode: string }> };

/** Satu perintah ke banyak perangkat (3 sekaligus: tiap perangkat ditunggu laporannya). */
export async function kendalikanBanyak(penggunaId: string, ids: string[], cmd: PerintahRamah, opsi: { sumber: Sumber; konfirmasi?: boolean }): Promise<HasilBanyak> {
  const hasil: HasilBanyak = { berhasil: [], gagal: [] };
  const semua = await daftarPerangkat(penggunaId, { termasukTersembunyi: true });
  const nama = new Map(semua.map((p) => [p.id, p.nama]));
  const antre = ids.slice(0, 50);
  let berhenti = false;
  const pekerja = async () => {
    for (let id = antre.shift(); id !== undefined && !berhenti; id = antre.shift()) {
      try {
        const r = await kendalikan(penggunaId, id, cmd, opsi);
        if (r.status === "belum_terkonfirmasi") hasil.gagal.push({ id, nama: r.perangkat.nama, alasan: "belum melaporkan perubahan (cek perangkatnya)", kode: "belum_terkonfirmasi" });
        else hasil.berhasil.push({ id, nama: r.perangkat.nama, ringkasan: r.ringkasan, status: r.status });
      } catch (e) {
        const g = e instanceof GalatLayanan ? e : null;
        if (!g) log.warn({ err: (e as Error)?.message }, "kendali massal gagal");
        hasil.gagal.push({ id, nama: nama.get(id) ?? id, alasan: g?.message ?? "Gagal", kode: g?.kode ?? "tuya_gangguan" });
        if (g?.kode === "kunci_bermasalah" || g?.kode === "belum_tersambung") berhenti = true;
      }
    }
  };
  await Promise.all([pekerja(), pekerja(), pekerja()]);
  return hasil;
}

/** Ambil keadaan terbaru satu perangkat dari Tuya. */
export async function segarkanPerangkat(penggunaId: string, deviceId: string): Promise<PerangkatRamah> {
  const b = await barisPerangkat(penggunaId, deviceId);
  return denganTuya(penggunaId, async (klien) => {
    const [det, bm] = await Promise.all([klien.detail(deviceId), pastikanModel(penggunaId, b, klien)]);
    const kini = new Date();
    await denganPengguna(penggunaId, (tx) =>
      tx
        .update(schema.perangkat)
        .set({ online: det.online, properti: det.properties ?? b.properti, propertiDiperbarui: kini, nama: det.name || b.nama })
        .where(and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, deviceId))),
    );
    return ramahkan({ ...bm, online: det.online, properti: det.properties ?? b.properti, nama: det.name || b.nama, propertiDiperbarui: kini }, await bacaStruktur(penggunaId));
  });
}

export async function gantiNama(penggunaId: string, deviceId: string, namaBaru: string, sumber: Sumber): Promise<PerangkatRamah> {
  const nama = namaBaru.trim().slice(0, 60);
  if (!nama) throw new GalatLayanan("masukan", "Nama baru tidak boleh kosong.");
  const b = await barisPerangkat(penggunaId, deviceId);
  await denganTuya(penggunaId, (k) => k.gantiNama(deviceId, nama));
  await denganPengguna(penggunaId, (tx) =>
    tx.update(schema.perangkat).set({ nama }).where(and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, deviceId))),
  );
  await catatAktivitas(penggunaId, { sumber, jenis: "lainnya", deviceId, ringkasan: `Ganti nama "${b.nama}" jadi "${nama}"` });
  return ramahkan({ ...b, nama }, await bacaStruktur(penggunaId));
}

export async function aturPerangkat(penggunaId: string, deviceId: string, ubah: { sensitif?: boolean | null; disembunyikan?: boolean; urutan?: number }) {
  await denganPengguna(penggunaId, (tx) =>
    tx
      .update(schema.perangkat)
      .set({
        ...(ubah.sensitif !== undefined ? { sensitifManual: ubah.sensitif } : {}),
        ...(ubah.disembunyikan !== undefined ? { disembunyikan: ubah.disembunyikan } : {}),
        ...(ubah.urutan !== undefined ? { urutan: ubah.urutan } : {}),
      })
      .where(and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, deviceId))),
  );
}

/** Semua kode properti di model Thing perangkat (untuk memeriksa dukungan pemicu). */
export function kodeModel(b: Pick<BarisPerangkat, "model">): Set<string> {
  const m = b.model as { services?: Array<{ properties?: Array<{ code?: string }> }> } | null;
  const hasil = new Set<string>();
  for (const sv of m?.services ?? []) for (const pr of sv.properties ?? []) if (pr?.code) hasil.add(pr.code);
  return hasil;
}

/** Baris perangkat + modelnya (diambil dari Tuya bila belum ada). */
export async function perangkatDenganModel(penggunaId: string, deviceId: string): Promise<BarisPerangkat> {
  const b = await barisPerangkat(penggunaId, deviceId);
  if (b.model) return b;
  return denganTuya(penggunaId, (klien) => pastikanModel(penggunaId, b, klien));
}

/** Terjemahkan perintah ramah ke properti mentah (untuk suasana yang disusun dari kalimat). */
export async function terjemahkanUntuk(penggunaId: string, deviceId: string, cmd: PerintahRamah): Promise<Record<string, unknown>> {
  const b = await perangkatDenganModel(penggunaId, deviceId);
  const k = kemampuanDari(b);
  const t = terjemahkan(k, cmd, b.properti);
  if (!t.ok) throw new GalatLayanan(t.kode === "kosong" ? "masukan" : t.kode, `${b.nama}: ${t.pesan}`, { bisa: uraikanKemampuan(k) });
  return t.properti;
}
