import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { asal, buatLewatApi, denganDb, masukSebagai, pantauGalat, tangkap } from "./bantu";

// P11: tab Siaga (PRD H1, H4: daftar, siap malam ini, ganti nama, putus) dan Riwayat (PRD K1 sampai
// K3: statistik, grafik 7/30 hari, rincian kejadian, ekspor CSV). Memakai Sari (pengguna kedua).

test.describe.configure({ mode: "serial" });

const SARI = "ab_tiruan_sari";

async function masukBersih(page: Page) {
  await denganDb(async (sql) => {
    const [p] = await sql<{ id: string }[]>`select id from pengguna where agentbuff_sub = ${SARI}`;
    if (p) {
      await sql`update kejadian_alarm set status = 'dibatalkan' where pengguna_id = ${p.id} and status in ('menunggu', 'berbunyi', 'ditunda', 'cek_bangun')`;
      await sql`update perangkat_siaga set dicabut_pada = now(), token_hash = null where pengguna_id = ${p.id} and dicabut_pada is null`;
      await sql`delete from kiriman_kanal where pengguna_id = ${p.id}`;
      await sql`delete from kejadian_alarm where pengguna_id = ${p.id}`;
      await sql`update pengguna set orientasi_selesai = now(), bahasa = 'id', zona_waktu = 'Asia/Jakarta' where id = ${p.id}`;
    }
  });
  await masukSebagai(page, "Sari Pengguna Baru");
  await expect(page).toHaveURL(/\/app$/);
}

/** Tanggal lokal Jakarta `n` hari dari hari ini. */
function tanggal(n: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() + n * 86_400_000));
}

test("Siaga: siap malam ini, dicas + baterai, ganti nama, putuskan", async ({ page }) => {
  const galat = pantauGalat(page);
  await masukBersih(page);
  await buatLewatApi(page, { jam: "05:00", pengulangan: { jenis: "harian" }, agendaJudul: "Bangun" });
  const o = await asal(page);

  // HP ini jadi Jam Meja, detak melaporkan dicas + baterai + jadwal tersimpan 2 hari ke depan.
  const r = await page.request.post("/api/app/perangkat", { data: { nama: "HP Sari" }, headers: { Origin: o } });
  expect(r.status()).toBe(201);
  const hp = ((await r.json()) as { perangkat: { id: string } }).perangkat.id;
  const d = await page.request.post("/api/perangkat/detak", {
    data: { perangkatId: hp, kemampuan: { dicas: true, baterai: 80 }, siapSampai: new Date(Date.now() + 2 * 86_400_000).toISOString() },
    headers: { Origin: o },
  });
  expect(d.status()).toBe(200);
  // PC yang terakhir terlihat 3 jam lalu: belum siap.
  await denganDb(
    (sql) => sql`insert into perangkat_siaga (pengguna_id, jenis, nama, terakhir_terlihat, kemampuan)
      select id, 'pc', 'PC Kamar', now() - interval '3 hours 20 minutes', '{"dicas": false}'::jsonb from pengguna where agentbuff_sub = ${SARI}`,
  );

  await page.goto("/app/siaga");
  await expect(page.getByRole("heading", { name: "Siaga", level: 1 })).toBeVisible();
  const kartuHp = page.getByRole("listitem").filter({ hasText: "HP Sari" });
  await expect(kartuHp.getByText("Siap malam ini")).toBeVisible();
  await expect(kartuHp.getByText("Dicas")).toBeVisible();
  await expect(kartuHp.getByText("Baterai 80%")).toBeVisible();
  const kartuPc = page.getByRole("listitem").filter({ hasText: "PC Kamar" });
  await expect(kartuPc.getByText("Belum siap")).toBeVisible();
  await expect(kartuPc.getByText("Terlihat 3 jam lalu")).toBeVisible();
  await expect(kartuPc.getByText("Tidak dicas")).toBeVisible();
  await tangkap(page, "p11", "siaga");

  await page.getByRole("button", { name: "Ganti nama: HP Sari" }).click();
  const lembar = page.getByRole("dialog", { name: "Nama perangkat" });
  await lembar.getByRole("textbox").fill("HP Kamar");
  await lembar.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Nama perangkat disimpan.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "HP Kamar" })).toBeVisible();

  await page.getByRole("button", { name: "Putuskan: PC Kamar" }).click();
  await page.getByRole("dialog", { name: "Putuskan PC Kamar?" }).getByRole("button", { name: "Ya, putuskan" }).click();
  await expect(page.getByText("PC Kamar diputus.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "PC Kamar" })).toHaveCount(0);

  // Spanduk Beranda menuju tab ini.
  await page.goto("/app");
  await expect(page.getByRole("link", { name: /Siaga/ }).first()).toBeVisible();
  expect(galat).toEqual([]);
});

test("Riwayat: statistik, grafik 7/30 hari, rincian kejadian, ekspor CSV", async ({ page }) => {
  const galat = pantauGalat(page);
  await masukBersih(page);
  await denganDb(async (sql) => {
    const [p] = await sql<{ id: string }[]>`select id from pengguna where agentbuff_sub = ${SARI}`;
    const baris = [
      { t: tanggal(0), status: "bangun", tunda: 0, menit: 2, judul: "Kuliah pagi" },
      { t: tanggal(-1), status: "bangun", tunda: 1, menit: 9, judul: "Kuliah pagi" },
      { t: tanggal(-3), status: "tidak_bangun", tunda: 2, menit: null, judul: "Gym" },
    ];
    for (const b of baris) {
      const mulai = `${b.t}T05:00:00+07:00`;
      const [k] = await sql<{ id: string }[]>`
        insert into kejadian_alarm (pengguna_id, jadwal_utc, tanggal_lokal, jam_lokal, judul, status, jumlah_tunda, berbunyi_pada, bangun_pada, selesai_oleh, perangkat_berbunyi)
        values (${p.id}, ${mulai}, ${b.t}, '05:00', ${b.judul}, ${b.status}, ${b.tunda}, ${mulai},
          ${b.menit === null ? null : new Date(Date.parse(mulai) + b.menit * 60_000)}, ${b.status === "bangun" ? "sesi" : "batas"},
          ${sql.json([{ id: crypto.randomUUID(), nama: "HP Kamar", jenis: "web" }])})
        returning id`;
      await sql`insert into soal_kejadian (pengguna_id, kejadian_id, tujuan, jenis, tingkat, target, tampil, garam, status)
        values (${p.id}, ${k.id}, 'bangun', 'hitungan', 'sedang', 2, ${sql.json({ teks: "12 + 7" })}, 'g', 'benar')`;
      await sql`insert into kiriman_kanal (pengguna_id, kejadian_id, kanal_id, platform, jenis, ke, status, kunci)
        values (${p.id}, ${k.id}, 'k_tg', 'telegram', 'spam', 1, 'terkirim', ${`uji:${k.id}`})`;
    }
  });

  await page.goto("/app/riwayat");
  await expect(page.getByRole("heading", { name: "Riwayat", level: 1 })).toBeVisible();
  await expect(page.getByRole("term").filter({ hasText: "Hari beruntun" })).toBeVisible();
  await expect(page.getByRole("definition").first()).toHaveText("2");
  await expect(page.getByText("Total tunda")).toBeVisible();
  await page.getByRole("radiogroup", { name: "Skor bangun" }).getByRole("radio", { name: "30 hari" }).click();
  await expect(page.getByRole("radiogroup", { name: "Skor bangun" }).getByRole("radio", { name: "30 hari" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "Skor bangun" }).getByRole("radio", { name: "7 hari" }).click();

  const baris = page.getByRole("button", { name: /^Gym, 05\.00\. Lihat rincian$/ });
  await baris.click();
  await expect(page.getByRole("button", { name: /^Gym, 05\.00\. Tutup rincian$/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Berbunyi 05.00")).toBeVisible();
  await expect(page.getByText("batas waktu habis")).toBeVisible();
  await expect(page.getByText("Perangkat siaga saat berbunyi:")).toBeVisible();
  await expect(page.getByText("HP Kamar")).toBeVisible();
  await expect(page.getByText(/Hitungan · Sedang · benar/)).toBeVisible();
  await expect(page.getByText(/Spam #1 · telegram · terkirim/)).toBeVisible();
  await expect(page.getByText("12 + 7")).toHaveCount(0);
  await tangkap(page, "p11", "riwayat");

  const [unduh] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Ekspor CSV" }).click()]);
  expect(unduh.suggestedFilename()).toBe("antikebo-riwayat.csv");
  const csv = readFileSync(await unduh.path(), "utf8");
  const isi = csv.replace(/^﻿/, "").trimEnd().split("\r\n");
  expect(isi[0]).toBe("Tanggal,Jam alarm,Agenda,Status,Berbunyi,Soal terjawab,Menit sampai bangun,Tunda,Skor,Pesan kanal");
  expect(isi).toHaveLength(4);
  expect(isi[3]).toMatch(/,Gym,Tidak bangun,05\.00,,,2,0,1$/);
  expect(galat).toEqual([]);
});
