import { expect, test } from "@playwright/test";
import { asal, aturTiruan, bersihkan, bunyikanSekarang, buatLewatApi, denganDb, jawabHitungan, masukSebagai, NUGI, nyalakanWorker, pantauGalat, tangkap } from "./bantu";

// P8 ujung ke ujung dengan worker SUNGGUHAN: lembar Ubah alarm (buat, ubah, nyala/mati, lewati,
// hapus), uji alarm yang benar-benar berbunyi 1 menit kemudian, layar berbunyi dengan soal dari
// server, tunda dengan soal ringan, berbunyi lagi, Selamat pagi + skor, Masih bangun, dan dua
// alarm bersamaan. Untuk alarm sungguhan, jadwal dimajukan langsung di DB supaya uji tidak
// menunggu jam tertentu (penjadwal mengetuk tiap 1 detik).

test.describe.configure({ mode: "serial" });

let hentikanWorker: (() => Promise<void>) | null = null;

test.beforeAll(async () => {
  hentikanWorker = await nyalakanWorker();
});

test.afterAll(async ({ browser }) => {
  // Tinggalkan akun bersih untuk uji berikutnya (beranda kosong, tidak ada yang berbunyi).
  const page = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  try {
    await masukSebagai(page, "Nugi Pratama");
    await expect(page).toHaveURL(/\/app$/);
    await bersihkan(page);
  } finally {
    await page.close();
    await hentikanWorker?.();
  }
});

test.beforeEach(async () => {
  await aturTiruan(NUGI, { hak: "ok", izin: { kabar: true, suara: true } });
});

test("lembar Ubah alarm: buat, ubah, nyala/mati, lewati, hapus", async ({ page }) => {
  const galat = pantauGalat(page);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await bersihkan(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Belum ada alarm" })).toBeVisible();

  await page.getByRole("button", { name: "Pasang alarm" }).click();
  const lembar = page.getByRole("dialog", { name: "Alarm baru" });
  await expect(lembar).toBeVisible();
  const jam = lembar.getByRole("spinbutton", { name: "Jam" });
  await jam.focus();
  await page.keyboard.press("ArrowDown");
  await expect(jam).toHaveAttribute("aria-valuenow", "7");
  const menit = lembar.getByRole("spinbutton", { name: "Menit" });
  await menit.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("PageDown");
  await expect(menit).toHaveAttribute("aria-valuenow", "30");
  await lembar.getByRole("textbox", { name: "Mau bangun buat apa?" }).fill("Presentasi klien");
  await lembar.getByRole("textbox", { name: "Detail (boleh kosong)" }).fill("Bawa laptop");
  for (const h of ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]) await lembar.getByRole("switch", { name: h }).click();
  await expect(lembar.getByText("Hari kerja", { exact: true })).toBeVisible();
  await lembar.getByRole("radio", { name: "Pelatih Tentara" }).click();
  await lembar.getByRole("radiogroup", { name: "Soal" }).getByRole("radio", { name: "Ingat angka" }).click();
  await lembar.getByRole("radiogroup", { name: "Tingkat soal" }).getByRole("radio", { name: "Berat" }).click();
  await lembar.getByRole("group", { name: "Jatah tunda" }).getByRole("button", { name: "Tambah" }).click();
  await tangkap(page, "p8", "ubah-alarm", { setinggiHalaman: false });
  await lembar.getByRole("button", { name: "Simpan" }).click();
  // Suara omelan dibuat worker; bila klip yang sama sudah ada (uji sebelumnya), langsung siap.
  await expect(page.getByText(/^Alarm tersimpan\.( Suara omelan sedang dibuat\.)?$/)).toBeVisible();
  await expect(lembar).toHaveCount(0);
  const kartu = page.getByRole("region", { name: "Alarm berikutnya" });
  await expect(kartu.getByText("07.30")).toBeVisible();
  await expect(kartu.getByText("Presentasi klien")).toBeVisible();

  // Tersimpan di server: dimuat ulang, dibuka lagi dengan isi yang sama, lalu diubah.
  await page.reload();
  await page.getByRole("button", { name: "Ubah alarm Presentasi klien" }).click();
  const ubah = page.getByRole("dialog", { name: "Ubah alarm" });
  await expect(ubah.getByRole("textbox", { name: "Mau bangun buat apa?" })).toHaveValue("Presentasi klien");
  await expect(ubah.getByRole("radio", { name: "Pelatih Tentara" })).toHaveAttribute("aria-checked", "true");
  await expect(ubah.getByText("Hari kerja", { exact: true })).toBeVisible();
  await expect(ubah.getByRole("group", { name: "Jatah tunda" }).locator("output")).toHaveText("3");
  await ubah.getByRole("textbox", { name: "Mau bangun buat apa?" }).fill("Presentasi klien besar");
  await ubah.getByRole("button", { name: "Simpan" }).click();
  await expect(ubah).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Alarm berikutnya" }).getByText("Presentasi klien besar")).toBeVisible();

  // Alarm kedua lewat tautan "Alarm baru" (bilah samping laptop memakai ?alarm=baru).
  await page.goto("/app?alarm=baru");
  const kedua = page.getByRole("dialog", { name: "Alarm baru" });
  await kedua.getByRole("textbox", { name: "Mau bangun buat apa?" }).fill("Kuliah pagi");
  // Galat dari server tampil di lembar dengan kalimat ramah; lembar tetap terbuka.
  await kedua.getByRole("radio", { name: "Kustom" }).click();
  await kedua.getByRole("button", { name: "Simpan" }).click();
  await expect(kedua.getByRole("alert")).toHaveText(/karakter Kustom butuh paling sedikit satu kalimat pribadi/);
  await kedua.getByRole("button", { name: "Tambah kalimat" }).click();
  await kedua.getByRole("textbox", { name: "Kalimat 1" }).fill("Kuliah jam tujuh, jangan bolos lagi!");
  await kedua.getByRole("button", { name: "Simpan" }).click();
  await expect(kedua).toHaveCount(0);
  const saklar = page.getByRole("switch", { name: "Nyalakan Kuliah pagi" });
  await expect(saklar).toHaveAttribute("aria-checked", "true");
  const simpanAktif = page.waitForResponse((r) => r.url().endsWith("/aktif") && r.request().method() === "POST");
  await saklar.click();
  await expect(saklar).toHaveAttribute("aria-checked", "false");
  expect((await simpanAktif).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole("switch", { name: "Nyalakan Kuliah pagi" })).toHaveAttribute("aria-checked", "false");
  await page.waitForTimeout(400);
  await tangkap(page, "p8", "beranda");

  // Lewati sekali dan hapus dari lembar.
  await page.getByRole("button", { name: "Ubah alarm Presentasi klien besar" }).click();
  await page.getByRole("dialog", { name: "Ubah alarm" }).getByRole("button", { name: "Lewati sekali" }).click();
  await expect(page.getByText("Alarm berikutnya dilewati.")).toBeVisible();
  await page.getByRole("button", { name: "Ubah alarm Kuliah pagi" }).click();
  const hapus = page.getByRole("dialog", { name: "Ubah alarm" });
  await hapus.getByRole("button", { name: "Hapus alarm" }).click();
  await hapus.getByRole("button", { name: "Ya, hapus" }).click();
  await expect(page.getByText("Alarm dihapus.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ubah alarm Kuliah pagi" })).toHaveCount(0);
  // Satu-satunya galat konsol: penolakan Kustom tanpa kalimat yang memang disengaja.
  expect(galat).toEqual(["console: Failed to load resource: the server responded with a status of 400 (Bad Request)"]);
});

test("uji alarm benar-benar berbunyi 1 menit kemudian: jawab soal, Selamat pagi", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Menunggu 1 menit penuh; cukup sekali (HP diuji lewat alarm sungguhan di bawah).");
  test.setTimeout(180_000);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await bersihkan(page);
  await buatLewatApi(page, { agendaJudul: "Presentasi klien", jam: "07:30", pengulangan: { jenis: "hari_kerja" } });
  await page.reload();
  await page.getByRole("button", { name: "Ubah alarm Presentasi klien" }).click();
  const lembar = page.getByRole("dialog", { name: "Ubah alarm" });
  await lembar.getByRole("button", { name: "Uji alarm ini" }).click();
  await lembar.getByRole("button", { name: "Bunyikan 1 menit lagi" }).click();
  await expect(page.getByText("Uji alarm berbunyi 1 menit lagi.")).toBeVisible();
  const mulai = Date.now();

  // Pengawas di beranda membuka layar alarm begitu worker membunyikannya.
  await expect(page).toHaveURL(/\/app\/bunyi\//, { timeout: 100_000 });
  expect(Date.now() - mulai).toBeGreaterThan(50_000);
  await expect(page.getByRole("heading", { name: "Presentasi klien" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Tunda/ })).toHaveCount(0);
  await jawabHitungan(page);
  await expect(page.getByRole("heading", { name: "Selamat pagi, Nugi!" })).toBeVisible();
  await expect(page.getByText("Uji", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Oke" }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("alarm sungguhan: tunda dengan soal ringan, berbunyi lagi, jawab 2 kali, Masih bangun", async ({ page }) => {
  test.setTimeout(150_000);
  const galat = pantauGalat(page);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await bersihkan(page);
  const id = await buatLewatApi(page, {
    agendaJudul: "Rapat pagi",
    agendaDetail: "Jam 9 di kantor klien",
    soal: { jenis: "hitungan", tingkat: "ringan", benar: 2 },
    tunda: { jatah: 1, menit: 5 },
    masihBangun: { aktif: true, menit: 3, batasDtk: 60 },
  });
  await bunyikanSekarang(id);
  await page.reload();
  await expect(page).toHaveURL(/\/app\/bunyi\//, { timeout: 30_000 });
  const kejadian = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { name: "Rapat pagi" })).toBeVisible();
  await expect(page.getByText("Jam 9 di kantor klien")).toBeVisible();
  await page.waitForTimeout(500);
  await tangkap(page, "p8", "berbunyi", { setinggiHalaman: false });

  // Tunda butuh satu soal ringan.
  await page.getByRole("button", { name: "Tunda 5 menit (sisa 1)" }).click();
  await expect(page.getByText("Soal tunda")).toBeVisible();
  await jawabHitungan(page);
  await expect(page.getByRole("heading", { name: "Tidur sebentar" })).toBeVisible();
  await expect(page.getByText(/^0[45]:\d\d$/)).toBeVisible();
  await expect(page.getByText("Jatah tunda habis")).toBeVisible();
  await tangkap(page, "p8", "ditunda", { setinggiHalaman: false });

  // Tunda habis (dimajukan): worker membunyikan lagi, jatah tunda habis.
  await denganDb((sql) => sql`update kejadian_alarm set tunda_sampai = now() where id = ${kejadian}`);
  await expect(page.getByRole("heading", { name: "Rapat pagi" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /^Tunda/ })).toHaveCount(0);
  await jawabHitungan(page, true);
  await expect(page.getByText("Salah, soal baru ya")).toBeVisible();
  await jawabHitungan(page);
  await expect(page.getByText("Benar! Satu lagi")).toBeVisible();
  await jawabHitungan(page);
  await expect(page.getByRole("heading", { name: "Selamat pagi, Nugi!" })).toBeVisible();
  await expect(page.getByText("Aku cek lagi 3 menit lagi ya.")).toBeVisible();
  await tangkap(page, "p8", "selamat-pagi", { setinggiHalaman: false });

  // "Masih bangun?" tiba (dimajukan), diketuk: selesai, skor 90 (satu tunda).
  await denganDb((sql) => sql`update kejadian_alarm set cek_pada = now(), cek_batas = now() + interval '60 seconds' where id = ${kejadian}`);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Masih bangun?" })).toBeVisible();
  await tangkap(page, "p8", "masih-bangun", { setinggiHalaman: false });
  await page.getByRole("button", { name: "Masih!" }).click();
  await expect(page.getByRole("heading", { name: "Selamat pagi, Nugi!" })).toBeVisible();
  await expect(page.getByText("Aku cek lagi", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Skor bangun 90" })).toBeVisible();
  const [akhir] = await denganDb((sql) => sql<{ status: string; jumlah_tunda: number }[]>`select status, jumlah_tunda from kejadian_alarm where id = ${kejadian}`);
  expect(akhir).toEqual({ status: "bangun", jumlah_tunda: 1 });
  expect(galat).toEqual([]);
});

test("dua alarm bersamaan: 1 dari 2, dijawab satu per satu", async ({ page }) => {
  test.setTimeout(120_000);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await bersihkan(page);
  const a = await buatLewatApi(page, { agendaJudul: "Minum obat", masihBangun: { aktif: false } });
  const b = await buatLewatApi(page, { agendaJudul: "Jemput adik", masihBangun: { aktif: false } });
  await bunyikanSekarang(a, b);
  await page.reload();
  await expect(page).toHaveURL(/\/app\/bunyi\//, { timeout: 30_000 });
  await expect(page.getByText("1 dari 2")).toBeVisible({ timeout: 10_000 });
  const pertama = page.url();
  await jawabHitungan(page);
  await expect(page).not.toHaveURL(pertama, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Minum obat|Jemput adik/ })).toBeVisible();
  await jawabHitungan(page);
  await expect(page.getByRole("heading", { name: "Selamat pagi, Nugi!" })).toBeVisible();
  const status = await denganDb((sql) => sql<{ status: string }[]>`select status from kejadian_alarm where alarm_id in ${sql([a, b])} and status <> 'menunggu'`);
  expect(status.map((x) => x.status)).toEqual(["bangun", "bangun"]);
});

test("soal ingat angka, ketik kalimat, dan Misi QR saat kamera ditolak (diganti hitungan berat 3 kali)", async ({ page }) => {
  test.setTimeout(150_000);
  const galat = pantauGalat(page);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await bersihkan(page);
  const o = await asal(page);
  const tunggu = async (judul: string) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/bunyi\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: judul })).toBeVisible();
  };

  // Ingat angka: tampil 3 detik, lalu disembunyikan; diketik dari ingatan.
  const ingat = await buatLewatApi(page, { agendaJudul: "Ingat angka", soal: { jenis: "ingat", tingkat: "ringan", benar: 1 }, masihBangun: { aktif: false } });
  await bunyikanSekarang(ingat);
  await tunggu("Ingat angka");
  await expect(page.getByText("Ingat angka ini")).toBeVisible();
  const angka = (await page.locator("section[aria-label] p.t-jam").first().innerText()).trim();
  expect(angka).toMatch(/^\d{6}$/);
  await expect(page.getByText("Ketik angka tadi")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(angka)).toHaveCount(0);
  for (const a of angka) await page.getByRole("button", { name: a, exact: true }).click();
  await page.getByRole("button", { name: "Kirim jawaban" }).click();
  await expect(page.getByRole("heading", { name: "Selamat pagi, Nugi!" })).toBeVisible();

  // Ketik kalimat: judul agenda yang cukup panjang jadi kalimatnya; tempel ditolak.
  const ketik = await buatLewatApi(page, { agendaJudul: "Kasur bukan tempat kerja", soal: { jenis: "ketik", tingkat: "ringan", benar: 1 }, masihBangun: { aktif: false } });
  await bunyikanSekarang(ketik);
  await tunggu("Kasur bukan tempat kerja");
  await expect(page.getByText("Ketik kalimat ini persis")).toBeVisible();
  await page.getByRole("textbox", { name: "Jawaban" }).fill("kasur  BUKAN tempat kerja");
  await page.getByRole("button", { name: "Kirim jawaban" }).click();
  await expect(page.getByRole("heading", { name: "Selamat pagi, Nugi!" })).toBeVisible();

  // Misi QR: tanpa izin kamera, pengguna diganti soal hitungan berat 3 kali benar (PRD D6).
  const qr = await page.request.post("/api/app/kode-qr", { data: { nama: "kamar mandi" }, headers: { Origin: o } });
  const kode = ((await qr.json()) as { kodeQr: { id: string } }).kodeQr.id;
  const misi = await buatLewatApi(page, { agendaJudul: "Misi kamar mandi", soal: { jenis: "qr", tingkat: "ringan", benar: 1, kodeQr: [kode] }, masihBangun: { aktif: false } });
  await bunyikanSekarang(misi);
  await tunggu("Misi kamar mandi");
  await expect(page.getByRole("heading", { name: "Pindai kode di kamar mandi" })).toBeVisible();
  await expect(page.getByText("Kamera tidak bisa dibuka. Izinkan kamera, atau ganti soal hitungan.")).toBeVisible({ timeout: 10_000 });
  await tangkap(page, "p8", "misi-qr", { setinggiHalaman: false });
  await page.getByRole("button", { name: "Kamera bermasalah? Ganti soal hitungan" }).click();
  await expect(page.getByText("Diganti soal hitungan berat, 3 kali benar.")).toBeVisible();
  for (let i = 0; i < 3; i++) {
    if (i > 0) await expect(page.getByRole("img", { name: `Benar berturut-turut: ${i}/3` })).toBeVisible();
    await jawabHitungan(page);
  }
  await expect(page.getByRole("heading", { name: "Selamat pagi, Nugi!" })).toBeVisible();
  // Bersihkan: alarm dan kode QR uji dihapus (batas 10 kode per pengguna).
  await page.request.delete(`/api/app/alarm/${misi}`, { headers: { Origin: o } });
  expect((await page.request.delete(`/api/app/kode-qr/${kode}`, { headers: { Origin: o } })).status()).toBe(200);
  expect(galat).toEqual([]);
});
