import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { arahkanDbAplikasi, buatPengguna, siapkanBasisData, type Ujian } from "./harness";
import { mulaiTuyaTiruan, type Tiruan } from "./tuya-tiruan";

// Alur ujung-ke-ujung lapisan layanan + alat MCP terhadap Postgres sungguhan
// (PGlite, peran tuya_app ber-RLS) dan server Tuya tiruan.

let u: Ujian;
let tuya: Tiruan;
let A: string; // pemilik uji
let B: string; // pemilik lain (isolasi)
const KUNCI = "sk-AZujiKunciRumah123456";
const KUNCI_B = "sk-AZujiKunciLain9876543";

beforeAll(async () => {
  process.env.ENCRYPTION_KEK = randomBytes(32).toString("base64");
  process.env.APP_ORIGIN = "https://tuya.contoh";
  tuya = await mulaiTuyaTiruan();
  process.env.TUYA_BASIS_UJI = tuya.url;
  u = await siapkanBasisData();
  arahkanDbAplikasi(u);
  A = await buatPengguna(u, "Nugi Uji");
  B = await buatPengguna(u, "Orang Lain");
}, 60_000);

afterAll(async () => {
  await tuya?.tutup();
});

const L = () => import("@/lib/layanan/sambungan");
const R = () => import("@/lib/layanan/rumah");

describe("sambung kunci", () => {
  it("kunci berbentuk salah ditolak tanpa memanggil Tuya", async () => {
    const { simpanKunci } = await L();
    await expect(simpanKunci(A, "bukan-kunci")).rejects.toMatchObject({ kode: "kunci_tidak_sah" });
  });

  it("kunci yang ditolak Tuya (1010) tidak pernah disimpan", async () => {
    const { simpanKunci, bacaSambungan } = await L();
    tuya.kunciDitolak.add("sk-AZkunciKedaluwarsa00");
    await expect(simpanKunci(A, "sk-AZkunciKedaluwarsa00")).rejects.toMatchObject({ kode: "kunci_tidak_sah" });
    expect(await bacaSambungan(A)).toBeNull();
  });

  it("kunci sah: tersimpan terenkripsi + rumah/ruangan/perangkat tersinkron", async () => {
    const { simpanKunci, bacaSambungan } = await L();
    const r = await simpanKunci(A, `  "${KUNCI}" `);
    expect(r).toMatchObject({ rumah: 1, ruangan: 2, perangkat: 12, online: 11, wilayah: { kode: "AZ" } });
    const s = await bacaSambungan(A);
    expect(s?.kunciSandi).not.toContain("ujiKunci");
    expect(s?.kunciSamar).toBe("sk-AZ••••3456");
    const [baris] = await u.superuser.select({ k: schema.sambunganTuya.kunciSandi }).from(schema.sambunganTuya).where(eq(schema.sambunganTuya.penggunaId, A));
    expect(baris.k).not.toContain(KUNCI);
  });
});

describe("rumah & kendali", () => {
  it("daftar perangkat ramah lengkap dengan ruangan & keadaan", async () => {
    const { daftarPerangkat } = await R();
    const d = await daftarPerangkat(A);
    const ac = d.find((p) => p.id === "ac1")!;
    expect(ac).toMatchObject({ ruangan: "Studio", jenis: "ac", online: true });
    expect(ac.keadaan).toMatchObject({ nyala: false, suhuTarget: 26, suhuRuang: 29.1, modeAc: "auto" });
    expect(ac.kontrol.suhuTarget).toEqual({ min: 16, max: 30, langkah: 0.5 });
    expect(d.find((p) => p.id === "heat1")?.sensitif).toBe(true);
  });

  it("cari perangkat: nama bebas, ambigu, tidak ada", async () => {
    const { cariPerangkat } = await R();
    expect((await cariPerangkat(A, "lampu meja")).id).toBe("lampu1");
    expect((await cariPerangkat(A, "ac studio")).id).toBe("ac1");
    await expect(cariPerangkat(A, "lampu")).rejects.toMatchObject({ kode: "ambigu" });
    await expect(cariPerangkat(A, "kulkas")).rejects.toMatchObject({ kode: "tidak_ditemukan" });
  });

  it("AC 24 derajat mode dingin: properti mentah benar terkirim + cermin diperbarui", async () => {
    const { kendalikan } = await R();
    tuya.perintah.length = 0;
    const r = await kendalikan(A, "ac1", { nyala: true, suhuTarget: 24, modeAc: "dingin" }, { sumber: "agen" });
    expect(tuya.perintah).toEqual([{ id: "ac1", properti: { switch: true, temp_set: 240, mode: "cold" } }]);
    expect(r.perangkat.keadaan).toMatchObject({ nyala: true, suhuTarget: 24, modeAc: "cold" });
  });

  it("perangkat offline ditolak dengan penjelasan, tanpa memanggil Tuya", async () => {
    const { kendalikan } = await R();
    tuya.perintah.length = 0;
    await expect(kendalikan(A, "plug1", { nyala: false }, { sumber: "web" })).rejects.toMatchObject({ kode: "offline" });
    expect(tuya.perintah).toHaveLength(0);
  });

  it("perangkat sensitif: agen wajib konfirmasi untuk MENYALAKAN, mematikan selalu boleh", async () => {
    const { kendalikan } = await R();
    await expect(kendalikan(A, "heat1", { nyala: true }, { sumber: "agen" })).rejects.toMatchObject({ kode: "perlu_konfirmasi" });
    await expect(kendalikan(A, "heat1", { nyala: true }, { sumber: "agen", konfirmasi: true })).resolves.toBeTruthy();
    await expect(kendalikan(A, "heat1", { nyala: false }, { sumber: "agen" })).resolves.toBeTruthy();
  });

  it("isolasi: pemilik lain tidak melihat perangkat / kunci A (RLS)", async () => {
    const { daftarPerangkat, cariPerangkat } = await R();
    const { bacaSambungan } = await L();
    expect(await daftarPerangkat(B)).toEqual([]);
    expect(await bacaSambungan(B)).toBeNull();
    await expect(cariPerangkat(B, "ac1")).rejects.toBeInstanceOf(GalatLayanan);
    // Bahkan kueri tanpa WHERE sebagai tuya_app dengan konteks B: nol baris milik A.
    const n = await u.jalan(B, async (tx) => (await tx.select().from(schema.perangkat)).length);
    expect(n).toBe(0);
  });
});

describe("suasana & jadwal", () => {
  it("simpan kondisi sekarang lalu jalankan suasana", async () => {
    const { potretKeadaan, simpanSuasana, jalankanSuasana } = await import("@/lib/layanan/suasana");
    const { kendalikan } = await R();
    await kendalikan(A, "lampu1", { nyala: true, warna: "biru", terangPersen: 60 }, { sumber: "web" });
    const aksi = await potretKeadaan(A, ["lampu1", "lampu2"]);
    const s = await simpanSuasana(A, { nama: "Nonton", aksi }, "web");
    await kendalikan(A, "lampu1", { nyala: false }, { sumber: "web" });
    tuya.perintah.length = 0;
    const r = await jalankanSuasana(A, "suasana nonton", "agen");
    expect(r.berhasil).toEqual(["Lampu Meja", "Lampu Plafon"]);
    const lampu1 = tuya.perintah.find((x) => x.id === "lampu1")!.properti;
    expect(lampu1).toMatchObject({ switch_led: true, work_mode: "colour" });
    expect(lampu1.bright_value_v2).toBeUndefined();
    expect(s.nama).toBe("Nonton");
  });

  it("jadwal jatuh tempo dijalankan worker sekali, lalu dimajukan / dinonaktifkan", async () => {
    const { buatJadwal, jalankanJatuhTempo } = await import("@/lib/layanan/jadwal");
    const j = await buatJadwal(A, { dalamMenit: 30, target: { perangkat: "lampu meja", perintah: { nyala: false }, ringkasan: "matikan" } }, "agen");
    const h = await buatJadwal(A, { jam: "23:00", target: { perangkat: "ac studio", perintah: { nyala: false }, ringkasan: "matikan" } }, "web");
    await u.superuser.execute(sql`update jadwal set berikutnya = now() - interval '1 minute' where id in (${j.id}, ${h.id})`);
    tuya.perintah.length = 0;
    arahkanDbAplikasi(u, "tuya_worker");
    try {
      expect(await jalankanJatuhTempo()).toBe(2);
      expect(await jalankanJatuhTempo()).toBe(0);
    } finally {
      arahkanDbAplikasi(u);
    }
    expect(tuya.perintah.map((x) => x.id).sort()).toEqual(["ac1", "lampu1"]);
    const [tj, th] = await Promise.all([
      u.superuser.select().from(schema.jadwal).where(eq(schema.jadwal.id, j.id)),
      u.superuser.select().from(schema.jadwal).where(eq(schema.jadwal.id, h.id)),
    ]);
    expect(tj[0]).toMatchObject({ aktif: false, terakhirHasil: "ok" });
    expect(th[0].aktif).toBe(true);
    expect(th[0].berikutnya!.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("alat MCP", () => {
  const konteks = async () => {
    const [token] = await u.superuser.insert(schema.tokenMcp).values({ penggunaId: A, label: "uji", hash: randomBytes(32).toString("hex"), awalan: "tuya_uji1", sumber: "manual" }).returning();
    return { penggunaId: A, token, zona: "Asia/Jakarta", asal: "https://tuya.contoh" };
  };

  it("control_devices: matikan semua lampu (offline dilewati, dilaporkan)", async () => {
    const { cariAlat } = await import("@/lib/mcp/alat");
    const k = await konteks();
    const a = cariAlat("control_devices")!;
    const r = await a.jalankan(k, a.masukan.parse({ type: "light", power: false }));
    expect((r.data.done as unknown[]).length).toBe(2);
    expect(r.teks).toContain("Lampu Meja");
  });

  it("get_home_overview & get_setup_status menjawab ringkas", async () => {
    const { cariAlat } = await import("@/lib/mcp/alat");
    const k = await konteks();
    const o = await cariAlat("get_home_overview")!.jalankan(k, {});
    expect(o.data.device_count).toBe(12);
    const s = await cariAlat("get_setup_status")!.jalankan(k, {});
    expect(s.data).toMatchObject({ connected: true, devices: 12 });
  });

  it("kunci kedaluwarsa di tengah jalan -> sambungan ditandai, agen diberi galat jelas", async () => {
    const { kendalikan } = await R();
    const { bacaSambungan } = await L();
    tuya.kunciDitolak.add(KUNCI);
    await expect(kendalikan(A, "lampu2", { nyala: true }, { sumber: "agen" })).rejects.toMatchObject({ kode: "kunci_bermasalah" });
    expect((await bacaSambungan(A))?.status).toBe("kunci_bermasalah");
    tuya.kunciDitolak.delete(KUNCI);
    const { simpanKunci } = await L();
    await simpanKunci(A, KUNCI); // perbarui kunci memulihkan
    expect((await bacaSambungan(A))?.status).toBe("aktif");
    expect(KUNCI_B).toBeTruthy();
  });
});

describe("otomasi, kamera, suasana dari kalimat, sambung lewat chat", () => {
  const O = () => import("@/lib/layanan/otomasi");
  const konteks = async (pemilik = A) => {
    const [token] = await u.superuser.insert(schema.tokenMcp).values({ penggunaId: pemilik, label: "uji", hash: randomBytes(32).toString("hex"), awalan: "tuya_uji2", sumber: "manual" }).returning();
    return { penggunaId: pemilik, token, zona: "Asia/Jakarta", asal: "https://tuya.contoh" };
  };
  const pintu = (buka: boolean) => ({ online: true, properti: { doorcontact_state: buka, battery_percentage: 80 } });

  it("create_automation: pintu terbuka -> lampu nyala + notifikasi; tepi saja, lalu jeda", async () => {
    const { cariAlat } = await import("@/lib/mcp/alat");
    const { evaluasiPerubahan } = await O();
    const k = await konteks();
    const a = cariAlat("create_automation")!;
    const r = await a.jalankan(k, a.masukan.parse({ when: { device: "sensor pintu", event: "door_opened" }, then: [{ device: "lampu meja", power: true }, { notify_title: "Pintu", notify_message: "Pintu terbuka" }] }));
    expect(r.teks).toContain("Sensor Pintu terbuka");
    expect(r.data.cooldown_minutes).toBe(10);
    const sebelum = tuya.perintah.length;
    expect(await evaluasiPerubahan(A, "pintu1", pintu(false), pintu(false))).toBe(0);
    expect(await evaluasiPerubahan(A, "pintu1", pintu(false), pintu(true))).toBe(1);
    expect(tuya.perintah.slice(sebelum)).toContainEqual({ id: "lampu1", properti: { switch_led: true } });
    expect(tuya.pesan.at(-1)).toMatchObject({ jalur: "/v1.0/end-user/services/push/self-send", badan: { subject: "Pintu" } });
    // Pintu ditutup lalu dibuka lagi dalam masa jeda: tidak menembak lagi.
    expect(await evaluasiPerubahan(A, "pintu1", pintu(true), pintu(false))).toBe(0);
    expect(await evaluasiPerubahan(A, "pintu1", pintu(false), pintu(true))).toBe(0);
    const l = await cariAlat("list_automations")!.jalankan(k, {});
    expect((l.data.automations as Array<{ last_result: string }>)[0].last_result).toBe("ok");
  });

  it("pemicu yang tidak dilaporkan perangkat ditolak; aksi menyalakan perangkat sensitif butuh konfirmasi", async () => {
    const { buatOtomasi } = await O();
    await expect(buatOtomasi(A, { pemicu: { perangkat: "ac studio", jenis: "pintu_terbuka" }, aksi: [{ suasana: "x" }] }, "agen")).rejects.toMatchObject({ kode: "tidak_didukung" });
    await expect(
      buatOtomasi(A, { pemicu: { perangkat: "ac studio", jenis: "suhu_di_atas", nilai: 30 }, aksi: [{ perangkat: "pemanas air", perintah: { nyala: true }, ringkasan: "nyalakan" }] }, "agen"),
    ).rejects.toMatchObject({ kode: "perlu_konfirmasi" });
  });

  it("rentang jam: di luar jendela tidak menembak", async () => {
    const { buatOtomasi, evaluasiPerubahan, hapusOtomasi } = await O();
    const o = await buatOtomasi(
      A,
      { nama: "Malam", pemicu: { perangkat: "ac studio", jenis: "suhu_di_atas", nilai: 30 }, aksi: [{ perangkat: "lampu plafon", perintah: { nyala: false }, ringkasan: "matikan" }], hanyaAntara: { mulai: "22:00", akhir: "05:00" } },
      "web",
    );
    const ac = (t: number) => ({ online: true, properti: { switch: true, temp_set: 260, temp_current: t, mode: "cold" } });
    const siangWib = new Date("2026-10-03T06:00:00Z"); // 13.00 WIB
    expect(await evaluasiPerubahan(A, "ac1", ac(291), ac(315), siangWib)).toBe(0);
    const malamWib = new Date("2026-10-03T16:30:00Z"); // 23.30 WIB
    expect(await evaluasiPerubahan(A, "ac1", ac(291), ac(315), malamWib)).toBe(1);
    await hapusOtomasi(A, o.id, "web");
  });

  it("kendali dari app/agen ikut memicu otomasi (cermin optimis tidak menelan tepinya)", async () => {
    const { buatOtomasi, hapusOtomasi } = await O();
    const { kendalikan } = await R();
    await kendalikan(A, "lampu2", { nyala: false }, { sumber: "web" });
    const o = await buatOtomasi(A, { pemicu: { perangkat: "lampu plafon", jenis: "menyala" }, aksi: [{ notifikasi: { judul: "Plafon", isi: "Lampu plafon menyala" } }] }, "web");
    const n = tuya.pesan.length;
    await kendalikan(A, "lampu2", { nyala: true }, { sumber: "agen" });
    await vi.waitFor(() => expect(tuya.pesan.length).toBe(n + 1), { timeout: 5000 });
    expect(tuya.pesan.at(-1)?.badan).toMatchObject({ subject: "Plafon" });
    await hapusOtomasi(A, o.id, "web");
  });

  it("isolasi: pemilik lain tidak melihat otomasi A", async () => {
    const { daftarOtomasi } = await O();
    expect((await daftarOtomasi(A)).length).toBeGreaterThan(0);
    expect(await daftarOtomasi(B)).toHaveLength(0);
  });

  it("save_scene dari kalimat: properti diterjemahkan, perangkat tidak disentuh", async () => {
    const { cariAlat } = await import("@/lib/mcp/alat");
    const k = await konteks();
    const sebelum = tuya.perintah.length;
    const a = cariAlat("save_scene")!;
    const r = await a.jalankan(k, a.masukan.parse({ name: "Baca", actions: [{ device: "lampu meja", power: true, brightness: 50 }, { device: "ac studio", power: true, temperature: 25 }] }));
    expect(r.data).toMatchObject({ name: "Baca", devices: 2 });
    expect(tuya.perintah.length).toBe(sebelum);
    const { cariSuasana } = await import("@/lib/layanan/suasana");
    const s = await cariSuasana(A, "Baca");
    expect(s.aksi).toContainEqual(expect.objectContaining({ deviceId: "ac1", properti: expect.objectContaining({ switch: true, temp_set: 250 }) }));
  });

  it("kamera: foto ditunggu sampai siap, tautan dikembalikan; bukan kamera ditolak", async () => {
    const { tangkapKamera } = await import("@/lib/layanan/ekstra");
    tuya.tangkapanBelumSiap.sisa = 2;
    const r = await tangkapKamera(A, "kamera teras", "foto", 10, async () => {});
    expect(r).toMatchObject({ perangkat: "Kamera Teras", jenis: "foto", gambar: `${tuya.url}/awan/a/0.jpg` });
    expect(r.tersimpan?.url).toMatch(/^https:\/\/tuya\.contoh\/api\/foto\/[A-Za-z0-9_-]{32}\.jpg$/);
    await expect(tangkapKamera(A, "lampu meja", "foto", 10, async () => {})).rejects.toMatchObject({ kode: "tidak_didukung" });
  });

  it("notify_me lewat email; preferensi perangkat", async () => {
    const { cariAlat } = await import("@/lib/mcp/alat");
    const k = await konteks();
    const nm = cariAlat("notify_me")!;
    await nm.jalankan(k, nm.masukan.parse({ title: "Uji", message: "Halo", channel: "email" }));
    expect(tuya.pesan.at(-1)?.jalur).toBe("/v1.0/end-user/services/mail/self-send");
    const pref = cariAlat("set_device_preferences")!;
    await pref.jalankan(k, pref.masukan.parse({ device: "dispenser", needs_confirmation: true }));
    const { cariPerangkat } = await R();
    expect((await cariPerangkat(A, "dispenser")).sensitif).toBe(true);
  });

  it("connect_home: pemilik baru menempel kunci di chat -> tersambung", async () => {
    const { cariAlat } = await import("@/lib/mcp/alat");
    const k = await konteks(B);
    const a = cariAlat("connect_home")!;
    await expect(a.jalankan(k, a.masukan.parse({ key: "sk-ZZbukanWilayahSah123" }))).rejects.toMatchObject({ kode: "kunci_tidak_sah" });
    const r = await a.jalankan(k, a.masukan.parse({ key: KUNCI_B }));
    expect(r.data).toMatchObject({ connected: true, devices: 12 });
    const s = await cariAlat("get_setup_status")!.jalankan(k, {});
    expect(s.data).toMatchObject({ connected: true });
  });
});

describe("jujur: berhasil hanya bila perangkat melapor; AC remote IR memancarkan sinyal sungguhan", () => {
  const konteks = async () => {
    const [token] = await u.superuser.insert(schema.tokenMcp).values({ penggunaId: A, label: "uji-ir", hash: randomBytes(32).toString("hex"), awalan: "tuya_ujir", sumber: "manual" }).returning();
    return { penggunaId: A, token, zona: "Asia/Jakarta", asal: "https://tuya.contoh" };
  };
  const kirimanPemancar = () => tuya.perintah.filter((x) => x.id === "hub1").map((x) => JSON.parse(String(x.properti.ir_send)) as Record<string, unknown>);

  it("perangkat menerima perintah tapi tidak berubah -> belum_terkonfirmasi, agen diberi tahu", async () => {
    const { kendalikan } = await R();
    const { cariAlat } = await import("@/lib/mcp/alat");
    tuya.alat.find((x) => x.id === "lampu2")!.properti.switch_led = true;
    tuya.abaikan.add("lampu2");
    try {
      const r = await kendalikan(A, "lampu2", { nyala: false }, { sumber: "web" });
      expect(r.status).toBe("belum_terkonfirmasi");
      expect(r.perangkat.keadaan.nyala).toBe(true); // yang dilaporkan, bukan tebakan
      const a = cariAlat("control_device")!;
      const m = await a.jalankan(await konteks(), a.masukan.parse({ device: "Lampu Plafon", power: false }));
      expect(m.data.ok).toBe(false);
      expect(m.teks).toContain("BELUM TERKONFIRMASI");
    } finally {
      tuya.abaikan.delete("lampu2");
    }
    const ok = await kendalikan(A, "lampu2", { nyala: false }, { sumber: "web" });
    expect(ok.status).toBe("terkonfirmasi");
  }, 30_000);

  it("AC remote tanpa kode: ditolak dengan arahan, tidak ada perintah palsu ke Tuya", async () => {
    const { kendalikan, daftarPerangkat } = await R();
    const ac = (await daftarPerangkat(A)).find((p) => p.id === "acir1")!;
    expect(ac.jenis).toBe("ac");
    expect(ac.kontrol.inframerah).toBe(true);
    expect(ac.kontrol.kodeIr).toBeNull();
    tuya.perintah.length = 0;
    await expect(kendalikan(A, "acir1", { nyala: true }, { sumber: "agen" })).rejects.toMatchObject({ kode: "ir_belum_dipasang" });
    expect(tuya.perintah).toHaveLength(0);
  });

  it("pasangkan kode lewat agen: merek -> kode -> tes memancarkan send_ir (keluar mode belajar dulu) -> simpan", async () => {
    const { cariAlat } = await import("@/lib/mcp/alat");
    const k = await konteks();
    const a = cariAlat("pair_ir_ac")!;
    const merek = await a.jalankan(k, a.masukan.parse({ action: "brands" }));
    expect((merek.data.brands as Array<{ brand: string }>).map((x) => x.brand)).toContain("Daikin");
    const kode = await a.jalankan(k, a.masukan.parse({ action: "codes", brand: "daikin" }));
    const id = (kode.data.codes as Array<{ code_id: string }>)[0].code_id;
    tuya.perintah.length = 0;
    const uji = await a.jalankan(k, a.masukan.parse({ action: "test", device: "AC Kamar", code_id: id, test: "on" }));
    expect(uji.teks).toContain("Tanyakan");
    const kirim = kirimanPemancar();
    expect(kirim[0]).toEqual({ control: "study_exit" });
    const sinyal = kirim.filter((x) => x.control === "send_ir");
    expect(sinyal.length).toBeGreaterThanOrEqual(1);
    expect(String(sinyal[0].key1).startsWith("1")).toBe(true);
    expect(Buffer.from(String(sinyal[0].key1).slice(1), "base64").length).toBeGreaterThan(20);
    const simpan = await a.jalankan(k, a.masukan.parse({ action: "save", device: "AC Kamar", code_id: id }));
    expect(simpan.data).toMatchObject({ saved: true, merek: "Daikin" });
  }, 30_000);

  it("AC remote berkode: dingin 24 kipas kencang = sinyal dipancarkan + status 'ir' (bukan klaim AC sudah dingin)", async () => {
    const { kendalikan } = await R();
    const { cariAlat } = await import("@/lib/mcp/alat");
    tuya.perintah.length = 0;
    const r = await kendalikan(A, "acir1", { nyala: true, suhuTarget: 24, modeAc: "dingin", kipas: "kencang" }, { sumber: "web" });
    expect(r.status).toBe("ir");
    expect(kirimanPemancar().some((x) => x.control === "send_ir")).toBe(true);
    expect(tuya.perintah.find((x) => x.id === "acir1")?.properti).toMatchObject({ switch_power: true, mode: "0", fan: "3" });
    tuya.perintah.length = 0;
    const a = cariAlat("control_device")!;
    const m = await a.jalankan(await konteks(), a.masukan.parse({ device: "AC Kamar", power: false }));
    expect(m.teks).toContain("Sinyal remote IR");
    expect(kirimanPemancar().filter((x) => x.control === "send_ir")).toHaveLength(1); // kode "off" saja
  }, 30_000);

  it("cermin bilang online tapi Tuya bilang offline -> pesan 'offline' yang jujur + cermin diperbarui", async () => {
    const { kendalikan, daftarPerangkat, sinkronkanPengguna } = await R();
    const lampu = tuya.alat.find((x) => x.id === "lampu1")!;
    lampu.online = false;
    try {
      await expect(kendalikan(A, "lampu1", { nyala: true }, { sumber: "agen" })).rejects.toMatchObject({ kode: "offline" });
      expect((await daftarPerangkat(A)).find((p) => p.id === "lampu1")?.online).toBe(false);
    } finally {
      lampu.online = true;
      await sinkronkanPengguna(A);
    }
  });

  it("suasana berisi AC remote ikut memancarkan sinyal", async () => {
    const { simpanSuasana, jalankanSuasana } = await import("@/lib/layanan/suasana");
    await simpanSuasana(A, { nama: "Dingin", aksi: [{ deviceId: "acir1", properti: { switch_power: true, temperature: 25, mode: "0", fan: "0" } }] }, "web");
    tuya.perintah.length = 0;
    const h = await jalankanSuasana(A, "Dingin", "web");
    expect(h.berhasil).toContain("AC Kamar");
    expect(kirimanPemancar().some((x) => x.control === "send_ir")).toBe(true);
  }, 30_000);
});

describe("Panasonic: sinyal dibangun dari protokol", () => {
  const sinyalTerakhir = async () => {
    const { dekodePanasonic, keadaanPanasonic } = await import("@/lib/ir/protokol/panasonic");
    const kirim = tuya.perintah.filter((x) => x.id === "hub1").map((x) => JSON.parse(String(x.properti.ir_send)) as { control: string; key1?: string });
    const s = kirim.filter((x) => x.control === "send_ir").pop();
    const raw = s?.key1 ? Buffer.from(s.key1.slice(1), "base64") : null;
    const b = raw ? dekodePanasonic(Array.from({ length: raw.length / 2 }, (_, i) => raw.readUInt16LE(i * 2))) : null;
    return b ? { bita: b, keadaan: keadaanPanasonic(b) } : null;
  };

  it("cari kode dari stiker model: CS-RE9GKE -> varian Panasonic yang sama; FTXS25 -> Daikin; seri CS- tak dikenal -> varian Panasonic", async () => {
    const { cariKodeModel } = await import("@/lib/layanan/ir");
    expect(cariKodeModel("cs re9gke")[0]).toMatchObject({ merek: "Panasonic", id: "pana:5", cocok: "persis" });
    expect(cariKodeModel("FTXS25")[0]).toMatchObject({ merek: "Daikin", cocok: "persis" });
    const pn = cariKodeModel("CS-PN9WKJ");
    expect(pn.length).toBeGreaterThan(0);
    expect(pn.every((h) => h.merek === "Panasonic" && h.id.startsWith("pana:"))).toBe(true);
    expect(() => cariKodeModel("a")).toThrow();
  });

  it("Panasonic tampil sebagai varian 'semua pengaturan' (bukan 13 rekaman yang tidak lengkap)", async () => {
    const { modelUntukMerek } = await import("@/lib/layanan/ir");
    const r = modelUntukMerek("panasonic");
    expect(r.kode.slice(0, 7).every((k) => k.dibangun && k.id.startsWith("pana:"))).toBe(true);
    expect(r.kode.filter((k) => !k.dibangun).length).toBeLessThanOrEqual(2);
  });

  it("varian tersimpan: suhu 26, kipas kencang, ayunan = semuanya ada di sinyal yang dipancarkan", async () => {
    const { simpanKodeAc } = await import("@/lib/layanan/ir");
    const { kendalikan } = await R();
    await simpanKodeAc(A, "acir1", "pana:1", null, "web");
    tuya.perintah.length = 0;
    await kendalikan(A, "acir1", { nyala: true, suhuTarget: 26, modeAc: "dingin", kipas: "kencang", properti: { swing: true } }, { sumber: "web" });
    const s = await sinyalTerakhir();
    expect(s?.keadaan).toEqual({ nyala: true, mode: "cold", suhu: 26, kipas: "high", ayun: true });
    tuya.perintah.length = 0;
    await kendalikan(A, "acir1", { properti: { swing: false } }, { sumber: "web" });
    expect((await sinyalTerakhir())?.keadaan).toMatchObject({ suhu: 26, kipas: "high", ayun: false });
  }, 30_000);
});

describe("perangkat yang tidak dimiliki pengguna pertama: CCTV, robot vakum, sensor CO2", () => {
  const konteks = async () => {
    const [token] = await u.superuser.insert(schema.tokenMcp).values({ penggunaId: A, label: "uji-lain", hash: randomBytes(32).toString("hex"), awalan: "tuya_ujil", sumber: "manual" }).returning();
    return { penggunaId: A, token, zona: "Asia/Jakarta", asal: "https://tuya.contoh" };
  };

  it("CCTV: privasi, deteksi gerakan, penglihatan malam diatur dan terkonfirmasi; arah kamera (PTZ) terkirim; nilai di luar daftar ditolak", async () => {
    const { kendalikan, daftarPerangkat } = await R();
    const cam = (await daftarPerangkat(A)).find((p) => p.id === "cctv1")!;
    expect(cam.jenis).toBe("kamera");
    expect(cam.kontrol.lainnya.map((x) => x.kode)).toEqual(expect.arrayContaining(["basic_private", "motion_switch", "basic_nightvision", "ptz_control", "ptz_stop"]));
    expect((await kendalikan(A, "cctv1", { properti: { basic_private: true } }, { sumber: "web" })).status).toBe("terkonfirmasi");
    expect((await kendalikan(A, "cctv1", { properti: { motion_switch: false, basic_nightvision: "2" } }, { sumber: "web" })).status).toBe("terkonfirmasi");
    tuya.perintah.length = 0;
    await kendalikan(A, "cctv1", { properti: { ptz_control: "2" } }, { sumber: "web" });
    expect(tuya.perintah.at(-1)).toEqual({ id: "cctv1", properti: { ptz_control: "2" } });
    await expect(kendalikan(A, "cctv1", { properti: { ptz_control: "9" } }, { sumber: "web" })).rejects.toBeInstanceOf(GalatLayanan);
  }, 30_000);

  it("CCTV lewat agen: foto (Cloud Capture) + pengaturan terdaftar di get_device", async () => {
    const { cariAlat } = await import("@/lib/mcp/alat");
    const k = await konteks();
    tuya.tangkapanBelumSiap.sisa = 0;
    const foto = cariAlat("capture_camera")!;
    const r = await foto.jalankan(k, foto.masukan.parse({ device: "CCTV Garasi" }));
    expect(r.teks).toMatch(/!\[Foto CCTV Garasi\]\(https:\/\/tuya\.contoh\/api\/foto\/[A-Za-z0-9_-]{32}\.jpg\)/);
    const g = cariAlat("get_device")!;
    const d = await g.jalankan(k, g.masukan.parse({ device: "CCTV Garasi" }));
    expect(JSON.stringify(d.data)).toContain("ptz_control");
    expect(JSON.stringify(d.data)).toContain("basic_private");
  }, 30_000);

  it("robot vakum: mulai bersih, mode, daya hisap, pulang ke dok; baterai & gangguan terbaca", async () => {
    const { kendalikan, daftarPerangkat } = await R();
    const v = (await daftarPerangkat(A)).find((p) => p.id === "vakum1")!;
    expect(v.jenis).toBe("robot");
    expect(v.keadaan.bateraiPersen).toBe(87);
    expect(v.kontrol.bacaan.find((b) => b.kode === "fault")?.nilai).toEqual([]);
    expect((await kendalikan(A, "vakum1", { properti: { power_go: true, mode: "smart", suction: "strong" } }, { sumber: "web" })).status).toBe("terkonfirmasi");
    tuya.perintah.length = 0;
    await kendalikan(A, "vakum1", { properti: { mode: "chargego" } }, { sumber: "web" });
    expect(tuya.perintah.at(-1)?.properti).toEqual({ mode: "chargego" });
  }, 30_000);

  it("sensor CO2: bacaan bersatuan + otomasi 'CO2 di atas 1000 ppm' menembak di tepi naik saja", async () => {
    const { daftarPerangkat } = await R();
    const { buatOtomasi, evaluasiPerubahan, hapusOtomasi } = await import("@/lib/layanan/otomasi");
    const s = (await daftarPerangkat(A)).find((p) => p.id === "co2a")!;
    expect(s.kontrol.bacaan.find((b) => b.kode === "co2_value")).toMatchObject({ nilai: 600, satuan: "ppm" });
    await expect(buatOtomasi(A, { pemicu: { perangkat: "Sensor CO2", jenis: "nilai_di_atas", nilai: 1000 }, aksi: [{ notifikasi: { judul: "CO2", isi: "x" } }] }, "agen")).rejects.toBeInstanceOf(GalatLayanan);
    const o = await buatOtomasi(A, { nama: "CO2 tinggi", pemicu: { perangkat: "Sensor CO2", jenis: "nilai_di_atas", kode: "co2_value", nilai: 1000 }, aksi: [{ notifikasi: { judul: "CO2", isi: "CO2 tinggi" } }], jedaMenit: 1 }, "agen");
    const co2 = (n: number) => ({ online: true, properti: { co2_value: n, co2_state: "normal" } });
    expect(await evaluasiPerubahan(A, "co2a", co2(600), co2(800))).toBe(0);
    expect(await evaluasiPerubahan(A, "co2a", co2(800), co2(1200))).toBe(1);
    expect(await evaluasiPerubahan(A, "co2a", co2(1200), co2(1300))).toBe(0);
    await hapusOtomasi(A, o.id, "agen");
  }, 30_000);
});
