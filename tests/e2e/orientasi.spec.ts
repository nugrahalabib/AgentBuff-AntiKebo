import { expect, test } from "@playwright/test";
import { denganDb, masukSebagai, pantauGalat, tangkap } from "./bantu";

// P11: perkenalan pertama (PRD J). Sari = pengguna aktif yang dibuat "baru" lagi lewat kolom
// pengguna (perkenalan belum selesai, belum ada nama panggilan dan bawaan).

const SARI = "ab_tiruan_sari";

async function jadikanBaru() {
  await denganDb(async (sql) => {
    await sql`update pengguna set orientasi_selesai = null, nama_panggilan = null, bawaan = '{}'::jsonb where agentbuff_sub = ${SARI}`;
    await sql`update kejadian_alarm set status = 'dibatalkan' where uji and status in ('menunggu', 'berbunyi', 'ditunda', 'cek_bangun')
      and pengguna_id = (select id from pengguna where agentbuff_sub = ${SARI})`;
  });
}

test("masuk pertama: perkenalan 6 langkah tersimpan, lalu alarm uji 1 menit lagi", async ({ page }) => {
  const galat = pantauGalat(page);
  await jadikanBaru();
  await masukSebagai(page, "Sari Pengguna Baru", undefined, "/masuk", { orientasi: true });
  await expect(page).toHaveURL(/\/app\/orientasi$/);

  // 1. Sambutan + nama panggilan (wajib).
  await expect(page.getByRole("heading", { name: "Halo! Aku Kebo." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nanti" })).toHaveCount(0);
  // Nama depan dari AgentBuff sudah terisi; kosong = belum bisa lanjut.
  await expect(page.getByLabel("Nama panggilan")).toHaveValue("Sari");
  await page.getByLabel("Nama panggilan").fill("");
  await expect(page.getByRole("button", { name: "Lanjut" })).toBeDisabled();
  await page.getByLabel("Nama panggilan").fill("Sari");
  await tangkap(page, "p11", "orientasi-1-nama", { setinggiHalaman: false });
  await page.getByRole("button", { name: "Lanjut" }).click();

  // 2. Karakter: contoh kalimat memakai nama tadi.
  await expect(page.getByRole("heading", { name: "Pilih yang paling galak buatmu" })).toBeVisible();
  await expect(page.getByText("Sari, katanya mau bangun pagi. Bangun dong!")).toBeVisible();
  await page.getByRole("radio", { name: /Pacar Bawel/ }).click();
  await expect(page.getByRole("radio", { name: /Pacar Bawel/ })).toHaveAttribute("aria-checked", "true");
  await tangkap(page, "p11", "orientasi-2-karakter");
  await page.getByRole("button", { name: "Lanjut" }).click();

  // 3. Perangkat: pasang PC / jam meja + notifikasi (opsional).
  await expect(page.getByRole("heading", { name: "Siapkan perangkat" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pasang di PC ini" })).toHaveAttribute("href", "/app/unduh-pc");
  await expect(page.getByRole("link", { name: "Jadikan perangkat ini jam meja" })).toHaveAttribute("href", "/app/jam-meja");
  await expect(page.getByRole("heading", { name: "Notifikasi alarm" })).toBeVisible();
  await tangkap(page, "p11", "orientasi-3-perangkat");
  await page.getByRole("button", { name: "Nanti" }).click();

  // 4. Kanal spam dari AgentBuff (tiruan): pilih Telegram sebagai bawaan.
  await expect(page.getByRole("heading", { name: "Spam ke mana?" })).toBeVisible();
  const pakai = page.getByRole("switch", { name: "Pakai: Telegram · bot Buff" });
  await expect(pakai).toBeVisible();
  await pakai.click();
  await expect(pakai).toHaveAttribute("aria-checked", "true");
  await tangkap(page, "p11", "orientasi-4-kanal");
  await page.getByRole("button", { name: "Lanjut" }).click();

  // 5. Rumah pintar (opsional, wizard di /app/rumah).
  await expect(page.getByRole("heading", { name: "Lampu ikut membangunkan?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sambungkan rumah" })).toHaveAttribute("href", "/app/rumah");
  await tangkap(page, "p11", "orientasi-5-rumah");
  await page.getByRole("button", { name: "Nanti" }).click();

  // 6. Uji coba: alarm uji 1 menit lagi, kembali ke Beranda.
  await expect(page.getByRole("heading", { name: "Coba sekali" })).toBeVisible();
  await tangkap(page, "p11", "orientasi-6-uji", { setinggiHalaman: false });
  await page.getByRole("button", { name: "Bunyikan 1 menit lagi" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(/Alarm uji berbunyi pukul \d\d\.\d\d/)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sari");

  const p = await denganDb(
    (sql) => sql<{ nama: string; karakter: string; kanal: string[]; selesai: Date | null; uji: number }[]>`
      select nama_panggilan as nama, bawaan->>'karakter' as karakter, coalesce(bawaan->'spam'->'kanal', '[]'::jsonb) as kanal, orientasi_selesai as selesai,
        (select count(*)::int from kejadian_alarm k where k.pengguna_id = pengguna.id and k.uji and k.status = 'menunggu') as uji
      from pengguna where agentbuff_sub = ${SARI}`,
  );
  expect(p[0]).toMatchObject({ nama: "Sari", karakter: "pacar_bawel", uji: 1 });
  expect(p[0].kanal.some((k) => k.startsWith("k_tg"))).toBe(true);
  expect(p[0].selesai).not.toBeNull();
  // Alarm uji tidak dibiarkan berbunyi di uji berikutnya.
  await jadikanBaru();
  await denganDb((sql) => sql`update pengguna set orientasi_selesai = now() where agentbuff_sub = ${SARI}`);

  // Sudah berkenalan: Beranda tidak mengarahkan lagi; bisa diulang dari Pengaturan.
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/pengaturan");
  await page.getByRole("link", { name: /Ulangi perkenalan/ }).click();
  await expect(page).toHaveURL(/\/app\/orientasi\?ulang=1$/);
  await expect(page.getByRole("heading", { name: "Halo! Aku Kebo." })).toBeVisible();
  expect(galat).toEqual([]);
});

test("Nanti di langkah terakhir: perkenalan selesai tanpa alarm uji", async ({ page }) => {
  await jadikanBaru();
  await masukSebagai(page, "Sari Pengguna Baru", undefined, "/masuk", { orientasi: true });
  await expect(page).toHaveURL(/\/app\/orientasi$/);
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Lanjut" }).click();
  // Kembali satu langkah lalu maju lagi.
  await page.getByRole("button", { name: "Kembali" }).click();
  await expect(page.getByRole("heading", { name: "Pilih yang paling galak buatmu" })).toBeVisible();
  await page.getByRole("button", { name: "Lanjut" }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Nanti" }).click();
  await expect(page).toHaveURL(/\/app$/);
  const [p] = await denganDb(
    (sql) => sql<{ selesai: Date | null; uji: number }[]>`
      select orientasi_selesai as selesai, (select count(*)::int from kejadian_alarm k where k.pengguna_id = pengguna.id and k.uji and k.status = 'menunggu') as uji
      from pengguna where agentbuff_sub = ${SARI}`,
  );
  expect(p.selesai).not.toBeNull();
  expect(p.uji).toBe(0);
});
