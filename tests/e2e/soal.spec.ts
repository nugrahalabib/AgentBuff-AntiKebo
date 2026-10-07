import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { aturTiruan, hitung, masukSebagai, NUGI, pantauGalat, tangkap, urlWorker } from "./bantu";

// P4 ujung ke ujung: halaman cetak kode QR, dan menjawab soal alarm lewat SESI peramban (cek asal
// + batas laju) sampai alarm berhenti. Kejadian berbunyi disiapkan langsung di DB pengembangan
// (peran antikebo_worker) karena layar berbunyi baru disambung di P8.

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await aturTiruan(NUGI, { hak: "ok", izin: { kabar: true, suara: true } });
});

test("kode QR: dibuat lalu halaman cetaknya menampilkan kode besar dan petunjuk", async ({ page }) => {
  const galat = pantauGalat(page);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  const asal = new URL(page.url()).origin;
  const r = await page.request.post("/api/app/kode-qr", { data: { nama: "kamar mandi" }, headers: { Origin: asal } });
  expect(r.status()).toBe(201);
  const { cetak, kodeQr } = (await r.json()) as { cetak: string; kodeQr: { id: string } };
  await page.goto(cetak);
  await expect(page.getByRole("heading", { name: "Kode bangun: kamar mandi" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Kode bangun: kamar mandi" }).locator("svg")).toBeVisible();
  await expect(page.getByText("Tempel kode ini di kamar mandi, jauh dari kasur.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cetak" })).toBeVisible();
  await tangkap(page, "p4", "kode-qr-cetak");
  // Tampilan cetak: navigasi dan tombol hilang.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Cetak" })).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  // Hapus lagi: batas 10 kode per pengguna tidak boleh habis oleh uji yang diulang di DB lokal.
  expect((await page.request.delete(`/api/app/kode-qr/${kodeQr.id}`, { headers: { Origin: asal } })).status()).toBe(200);
  expect(galat).toEqual([]);
});

test("menjawab soal alarm lewat sesi peramban: cek asal, salah, lalu benar sampai berhenti", async ({ page }) => {
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  const asal = new URL(page.url()).origin;
  const sql = postgres(urlWorker(), { max: 1, onnotice: () => {} });
  try {
    const [p] = await sql<{ id: string }[]>`select id from pengguna where agentbuff_sub = ${NUGI}`;
    const isi = {
      jam: "05:00",
      zona: "Asia/Jakarta",
      pengulangan: { jenis: "harian" },
      agendaJudul: "Uji e2e",
      agendaDetail: null,
      karakter: "ibu_galak",
      suaraId: null,
      bunyi: "klasik",
      soal: { jenis: "hitungan", tingkat: "ringan", benar: 1, kodeQr: [] },
      tunda: { jatah: 1, menit: 5 },
      spam: { kanal: [], jedaDtk: null, batasMenit: null },
      tuya: [],
      komitmen: false,
      masihBangun: { aktif: false, menit: 5, batasDtk: 60 },
      liburNasional: false,
      batasMenit: null,
      aktif: true,
    };
    const [k] = await sql<{ id: string }[]>`
      insert into kejadian_alarm (pengguna_id, jadwal_utc, tanggal_lokal, jam_lokal, judul, status, berbunyi_pada, isi, uji)
      values (${p.id}, now(), current_date, '05:00', 'Uji e2e', 'berbunyi', now(), ${sql.json(isi)}, true) returning id`;

    const soal = await page.request.get(`/api/kejadian/${k.id}/soal`);
    expect(soal.status()).toBe(200);
    const { soal: s } = (await soal.json()) as { soal: { id: string; tampil: { teks: string }; jenis: string } };
    expect(s.jenis).toBe("hitungan");
    const benar = hitung(s.tampil.teks);
    expect(JSON.stringify(s)).not.toContain(`"${benar}"`);

    // Tanpa asal yang sama: ditolak (CSRF).
    const asing = await page.request.post(`/api/kejadian/${k.id}/jawab`, { data: { soalId: s.id, jawaban: benar }, headers: { Origin: "https://jahat.example" } });
    expect(asing.status()).toBe(403);

    const salah = await page.request.post(`/api/kejadian/${k.id}/jawab`, { data: { soalId: s.id, jawaban: "0" }, headers: { Origin: asal } });
    const hs = (await salah.json()) as { hasil: string; soal: { id: string; tampil: { teks: string } } };
    expect(hs.hasil).toBe("salah");
    const ok = await page.request.post(`/api/kejadian/${k.id}/jawab`, { data: { soalId: hs.soal.id, jawaban: hitung(hs.soal.tampil.teks) }, headers: { Origin: asal } });
    expect(await ok.json()).toMatchObject({ hasil: "selesai", status: "bangun" });
    const [akhir] = await sql<{ status: string; selesai_oleh: string }[]>`select status, selesai_oleh from kejadian_alarm where id = ${k.id}`;
    expect(akhir).toEqual({ status: "bangun", selesai_oleh: "sesi" });
  } finally {
    await sql.end({ timeout: 2 });
  }
});
