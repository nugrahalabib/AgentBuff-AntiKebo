import { expect, test, type Page } from "@playwright/test";
import { asal, buatLewatApi, denganDb, masukSebagai, pantauGalat, tangkap } from "./bantu";

// P11: Pengaturan lengkap (PRD M), template (PRD B10), kode QR, hapus semua data (PRD A5).
// Memakai Sari (pengguna aktif kedua) supaya data Nugi untuk uji lain tidak tersentuh.

test.describe.configure({ mode: "serial" });

const SARI = "ab_tiruan_sari";

async function siapkanSari(page: Page) {
  await denganDb(async (sql) => {
    await sql`update kejadian_alarm set status = 'dibatalkan' where status in ('menunggu', 'berbunyi', 'ditunda', 'cek_bangun')
      and pengguna_id = (select id from pengguna where agentbuff_sub = ${SARI})`;
    await sql`update pengguna set orientasi_selesai = now(), nama_panggilan = null, bawaan = '{}'::jsonb, zona_waktu = 'Asia/Jakarta', bahasa = 'id', tema = 'sistem', jam_tidur = '22:00'
      where agentbuff_sub = ${SARI}`;
  });
  await masukSebagai(page, "Sari Pengguna Baru");
  await expect(page).toHaveURL(/\/app$/);
  const o = await asal(page);
  for (const jalur of ["alarm", "template", "kode-qr"] as const) {
    const r = (await (await page.request.get(`/api/app/${jalur}`)).json()) as Record<string, Array<{ id: string; bawaan?: boolean }>>;
    const daftar = r[jalur === "kode-qr" ? "kodeQr" : jalur].filter((x) => !x.bawaan);
    for (const x of daftar) await page.request.delete(`/api/app/${jalur}/${x.id}`, { headers: { Origin: o } });
  }
}

test("Kamu: nama panggilan, zona, bahasa, jam tidur, tema tersimpan", async ({ page }) => {
  const galat = pantauGalat(page);
  await siapkanSari(page);
  await page.goto("/app/pengaturan");
  await expect(page.getByRole("heading", { name: "Pengaturan", level: 1 })).toBeVisible();
  await tangkap(page, "p11", "pengaturan");

  // Nama panggilan: simpan, lalu kembali ke nama AgentBuff.
  await page.getByRole("button", { name: /^Nama panggilan/ }).click();
  let lembar = page.getByRole("dialog", { name: "Nama panggilan" });
  await lembar.getByRole("textbox", { name: "Nama panggilan" }).fill("Sasa");
  await tangkap(page, "p11", "pengaturan-nama", { setinggiHalaman: false });
  await lembar.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Nama panggilan/ })).toContainText("Sasa");
  await page.getByRole("button", { name: /^Nama panggilan/ }).click();
  await page.getByRole("dialog", { name: "Nama panggilan" }).getByRole("button", { name: "Pakai nama dari AgentBuff (Sari Pengguna Baru)" }).click();
  await expect(page.getByRole("button", { name: /^Nama panggilan/ })).toContainText("Sari Pengguna Baru");

  // Zona: cari lalu pilih; jam alarm tetap mengikuti zona baru.
  await page.getByRole("button", { name: /^Zona waktu/ }).click();
  lembar = page.getByRole("dialog", { name: "Zona waktu" });
  await lembar.getByRole("textbox", { name: "Cari zona, misal Jakarta" }).fill("makassar");
  await lembar.getByRole("radio", { name: /Asia\/Makassar|Asia Makassar/ }).click();
  await tangkap(page, "p11", "pengaturan-zona", { setinggiHalaman: false });
  await lembar.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Zona waktu/ })).toContainText("Asia/Makassar");

  // Bahasa Inggris: seluruh layar ikut, lalu kembali.
  await page.getByRole("button", { name: /^Bahasa/ }).click();
  lembar = page.getByRole("dialog", { name: "Bahasa" });
  await lembar.getByRole("radio", { name: "English" }).click();
  await lembar.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /^Language/ }).click();
  lembar = page.getByRole("dialog", { name: "Language" });
  await lembar.getByRole("radio", { name: "Bahasa Indonesia" }).click();
  await lembar.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Pengaturan", level: 1 })).toBeVisible();

  // Jam tidur lewat roda jam (papan ketik).
  await page.getByRole("button", { name: /^Jam tidur/ }).click();
  lembar = page.getByRole("dialog", { name: "Jam tidur" });
  const jam = lembar.getByRole("spinbutton", { name: "Jam" });
  await jam.focus();
  await page.keyboard.press("ArrowDown");
  await expect(jam).toHaveAttribute("aria-valuenow", "23");
  await lembar.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Jam tidur/ })).toContainText("23.00");

  // Tema gelap langsung berlaku, lalu kembali ikut perangkat.
  await page.getByRole("button", { name: /^Tema/ }).click();
  lembar = page.getByRole("dialog", { name: "Tema" });
  await lembar.getByRole("radio", { name: "Gelap" }).click();
  await lembar.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "gelap");
  await page.getByRole("button", { name: /^Tema/ }).click();
  await page.getByRole("dialog", { name: "Tema" }).getByRole("radio", { name: "Ikuti perangkat" }).click();
  await page.getByRole("dialog", { name: "Tema" }).getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "sistem");

  const [p] = await denganDb(
    (sql) =>
      sql<
        { zona: string; tidur: string; nama: string | null }[]
      >`select zona_waktu as zona, jam_tidur as tidur, nama_panggilan as nama from pengguna where agentbuff_sub = ${SARI}`,
  );
  expect(p).toEqual({ zona: "Asia/Makassar", tidur: "23:00", nama: null });
  expect(galat).toEqual([]);
});

test("bawaan alarm baru dipakai lembar Alarm baru; template disimpan, dipakai, diganti nama, dihapus", async ({ page }) => {
  const galat = pantauGalat(page);
  await siapkanSari(page);
  await page.goto("/app/pengaturan");

  await page.getByRole("button", { name: /^Bawaan alarm baru/ }).click();
  const lembar = page.getByRole("dialog", { name: "Bawaan alarm baru" });
  await lembar.getByRole("radio", { name: "Bos Killer" }).click();
  await lembar.getByRole("radiogroup", { name: "Tingkat soal" }).getByRole("radio", { name: "Berat" }).click();
  await lembar.getByRole("group", { name: "Jatah tunda" }).getByRole("button", { name: "Kurangi" }).click();
  await tangkap(page, "p11", "pengaturan-bawaan", { setinggiHalaman: false });
  await lembar.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Bawaan alarm baru/ })).toContainText("Bos Killer · Hitungan");

  // Lembar Alarm baru memakai bawaan tadi.
  await page.goto("/app?alarm=baru");
  let baru = page.getByRole("dialog", { name: "Alarm baru" });
  await expect(baru.getByRole("radio", { name: "Bos Killer" })).toHaveAttribute("aria-checked", "true");
  await expect(baru.getByRole("radiogroup", { name: "Tingkat soal" }).getByRole("radio", { name: "Berat" })).toHaveAttribute("aria-checked", "true");
  await expect(baru.getByRole("group", { name: "Jatah tunda" }).locator("output")).toHaveText("1");
  await page.keyboard.press("Escape");

  // Simpan alarm sebagai template dari lembar Ubah alarm.
  await buatLewatApi(page, { jam: "05:15", agendaJudul: "Gym", pengulangan: { jenis: "hari", hari: [1, 3, 5] } });
  await page.reload();
  await page.getByRole("button", { name: "Ubah alarm Gym" }).click();
  const ubah = page.getByRole("dialog", { name: "Ubah alarm" });
  await ubah.getByRole("button", { name: /Simpan sebagai template/ }).click();
  await ubah.getByRole("textbox", { name: "Nama template" }).fill("Gym pagi");
  await ubah.getByRole("button", { name: "Simpan", exact: true }).first().click();
  await expect(page.getByText("Template disimpan.")).toBeVisible();
  await page.keyboard.press("Escape");

  // Template muncul di lembar Alarm baru dan mengisi agenda + jam.
  await page.goto("/app?alarm=baru");
  baru = page.getByRole("dialog", { name: "Alarm baru" });
  await baru.getByRole("radiogroup", { name: "Mulai dari template" }).getByRole("radio", { name: "Gym pagi" }).click();
  await expect(baru.getByRole("textbox", { name: "Mau bangun buat apa?" })).toHaveValue("Gym");
  await expect(baru.getByRole("spinbutton", { name: "Jam" })).toHaveAttribute("aria-valuenow", "5");
  await tangkap(page, "p11", "alarm-baru-template", { setinggiHalaman: false });
  await page.keyboard.press("Escape");

  // Kelola di Pengaturan: ganti nama lalu hapus.
  await page.goto("/app/pengaturan");
  await page.getByRole("button", { name: /^Template/ }).click();
  const tpl = page.getByRole("dialog", { name: "Template" });
  await tpl.getByRole("button", { name: "Ganti nama: Gym pagi" }).click();
  await tpl.getByRole("textbox", { name: "Ganti nama: Gym pagi" }).fill("Gym sore");
  await tpl.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(tpl.getByText("Gym sore")).toBeVisible();
  await tangkap(page, "p11", "pengaturan-template", { setinggiHalaman: false });
  await tpl.getByRole("button", { name: "Hapus: Gym sore" }).click();
  await tpl.getByRole("button", { name: "Hapus", exact: true }).click();
  await expect(page.getByText("Gym sore dihapus.")).toBeVisible();
  await expect(tpl.getByText("Belum ada template buatanmu.", { exact: false })).toBeVisible();
  expect(galat).toEqual([]);
});

test("kode QR: buat, cetak, ganti nama, hapus (ditolak bila dipakai alarm)", async ({ page }) => {
  const galat = pantauGalat(page);
  await siapkanSari(page);
  await page.goto("/app/pengaturan");
  await page.getByRole("button", { name: /^Kode QR/ }).click();
  const qr = page.getByRole("dialog", { name: "Kode QR" });
  await expect(qr.getByText("Belum ada kode QR.", { exact: false })).toBeVisible();
  await qr.getByRole("textbox", { name: "Nama tempat, misal Kamar mandi" }).fill("Kamar mandi");
  await qr.getByRole("button", { name: "Buat" }).click();
  await expect(qr.getByText("Kamar mandi")).toBeVisible();
  const cetak = qr.getByRole("link", { name: "Cetak: Kamar mandi" });
  await expect(cetak).toHaveAttribute("href", /\/app\/kode-qr\/[0-9a-f-]+\/cetak$/);
  await tangkap(page, "p11", "pengaturan-kode-qr", { setinggiHalaman: false });

  // Dipakai alarm Misi QR: hapus ditolak dengan pesan jelas.
  const id = (await cetak.getAttribute("href"))!.split("/")[3];
  await buatLewatApi(page, { agendaJudul: "Misi kamar mandi", soal: { jenis: "qr", tingkat: "sedang", benar: 1, kodeQr: [id] } });
  await page.reload();
  await page.getByRole("button", { name: /^Kode QR/ }).click();
  await expect(qr.getByText("Dipakai 1 alarm")).toBeVisible();
  await qr.getByRole("button", { name: "Hapus: Kamar mandi" }).click();
  await qr.getByRole("button", { name: "Hapus", exact: true }).click();
  await expect(page.getByText("Kode ini masih dipakai alarm Misi kamar mandi. Ganti soal alarmnya dulu.")).toBeVisible();

  await qr.getByRole("button", { name: "Batal" }).click();
  await qr.getByRole("button", { name: "Ganti nama: Kamar mandi" }).click();
  await qr.getByRole("textbox", { name: "Ganti nama: Kamar mandi" }).fill("Dapur");
  await qr.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(qr.getByText("Dapur")).toBeVisible();
  // Satu-satunya galat jaringan = penolakan hapus yang memang diharapkan (400).
  expect(galat.filter((g) => !/status of 400 \(Bad Request\) @ \/api\/app\/kode-qr\//.test(g))).toEqual([]);
});

test("hapus semua data: konfirmasi ketik, semua data hilang, masuk lagi mulai dari perkenalan", async ({ page }) => {
  const galat = pantauGalat(page);
  await siapkanSari(page);
  await buatLewatApi(page, { agendaJudul: "Kuliah" });
  await page.goto("/app/pengaturan");
  await page.getByRole("button", { name: "Hapus semua data" }).click();
  const lembar = page.getByRole("dialog", { name: "Hapus semua data" });
  const tombol = lembar.getByRole("button", { name: "Hapus semua data" });
  await expect(tombol).toBeDisabled();
  await lembar.getByRole("textbox", { name: "Ketik HAPUS untuk memastikan" }).fill("hapus");
  await expect(tombol).toBeEnabled();
  await tangkap(page, "p11", "hapus-data", { setinggiHalaman: false });
  await tombol.click();

  await expect(page).toHaveURL(/\/masuk\?info=dihapus$/);
  await expect(page.getByRole("status")).toHaveText("Semua datamu sudah dihapus. Masuk lagi kapan saja untuk mulai dari awal.");
  const [p] = await denganDb(
    (sql) => sql<{ dihapus: Date | null; alarm: number }[]>`
      select dihapus_pada as dihapus, (select count(*)::int from alarm a where a.pengguna_id = pengguna.id) as alarm from pengguna where agentbuff_sub = ${SARI}`,
  );
  expect(p.dihapus).not.toBeNull();
  expect(p.alarm).toBe(0);
  // Sesi lama tidak berlaku lagi.
  const r = await page.request.get("/api/app/alarm");
  expect(r.status()).toBe(401);

  // Masuk lagi (sesi AgentBuff tiruan masih ada, jadi tanpa memilih akun) = akun bersih, mulai dari perkenalan.
  await page.getByRole("link", { name: "Masuk dengan AgentBuff" }).click();
  await expect(page).toHaveURL(/\/app\/orientasi$/);
  await expect(page.getByRole("heading", { name: "Halo! Aku Kebo." })).toBeVisible();
  expect(galat.filter((g) => !g.includes("401"))).toEqual([]);
});
