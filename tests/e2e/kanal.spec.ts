import { expect, test } from "@playwright/test";
import { aturTiruan, masukSebagai, NUGI, pantauGalat, tangkap, TIRUAN } from "./bantu";

// P6 ujung ke ujung: Pengaturan menampilkan kanal dari AgentBuff (tiruan), mengirim pesan uji,
// mengatur kanal bawaan dan pengingat malam; Service Worker menampilkan notifikasi alarm dari push
// sungguhan yang dikirim lewat DevTools Protocol (tanpa layanan push di luar).

test.describe.configure({ mode: "serial" });

async function kirimanTiruan(): Promise<Array<{ kanal: string; teks: string }>> {
  const r = await fetch(`${TIRUAN}/_tiruan/kiriman?sub=${NUGI}`);
  return ((await r.json()) as { kiriman: Array<{ kanal: string; teks: string }> }).kiriman;
}

test.beforeEach(async () => {
  await aturTiruan(NUGI, { hak: "ok", izin: { kabar: true, suara: true } });
});

test("pengaturan: daftar kanal, pesan uji, kanal bawaan, pengingat malam", async ({ page }) => {
  const galat = pantauGalat(page);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/pengaturan");

  const kanal = page.getByRole("region", { name: "Kanal pesan" });
  await expect(kanal.getByText("Telegram · bot Buff")).toBeVisible();
  await expect(kanal.getByText("WhatsApp · Rani")).toBeVisible();
  await expect(kanal.getByText("Belum pernah ada chat masuk dari kamu")).toBeVisible();
  await expect(kanal.getByText("Discord · Buff")).toBeVisible();
  // Kanal belum siap tidak punya tombol uji.
  await expect(kanal.getByRole("button", { name: "Kirim pesan uji" })).toHaveCount(2);

  const sebelum = (await kirimanTiruan()).length;
  await kanal.getByRole("button", { name: "Kirim pesan uji" }).first().click();
  await expect(page.getByText("Pesan uji terkirim. Cek chat-mu!")).toBeVisible();
  const k = await kirimanTiruan();
  expect(k.length).toBe(sebelum + 1);
  expect(k.at(-1)!.teks).toBe("✅ Tes dari AntiKebo, Nugi. Kanal ini siap membangunkanmu!");
  // Langsung lagi: AgentBuff menahan (Telegram minimal 5 dtk), pesan ramah.
  await kanal.getByRole("button", { name: "Kirim pesan uji" }).first().click();
  await expect(page.getByText(/Kanal ini baru saja dipakai\. Tunggu \d+ detik lalu coba lagi\./)).toBeVisible();

  // Kanal bawaan alarm baru tersimpan.
  const pakai = kanal.getByRole("switch", { name: "Pakai: Telegram · bot Buff" });
  const awal = (await pakai.getAttribute("aria-checked")) === "true";
  await pakai.click();
  await expect(pakai).toHaveAttribute("aria-checked", String(!awal));
  await page.waitForLoadState("networkidle");

  // Pengingat malam bisa dimatikan dan bertahan sesudah dimuat ulang.
  const pengingat = page.getByRole("switch", { name: "Kirim pengingat malam" });
  await expect(pengingat).toHaveAttribute("aria-checked", "true");
  await pengingat.click();
  await expect(pengingat).toHaveAttribute("aria-checked", "false");
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Kirim pengingat malam" })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("region", { name: "Kanal pesan" }).getByRole("switch", { name: "Pakai: Telegram · bot Buff" })).toHaveAttribute("aria-checked", String(!awal));
  await page.getByRole("switch", { name: "Kirim pengingat malam" }).click();
  await expect(page.getByRole("switch", { name: "Kirim pengingat malam" })).toHaveAttribute("aria-checked", "true");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: "Nyalakan di peramban ini" })).toBeVisible();
  await expect(page.getByText(/Telegram · bot Buff/)).toBeVisible();
  await tangkap(page, "p6", "pengaturan-kanal");
  // Satu-satunya galat konsol yang wajar: jawaban 429 pesan uji kedua (memang ditahan).
  expect(galat.filter((g) => !g.includes("429"))).toEqual([]);
});

test("izin kirim pesan belum diberi: ajakan beri izin, bukan galat", async ({ page }) => {
  await masukSebagai(page, "Nugi Pratama", { kabar: false, suara: true });
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/pengaturan");
  const kanal = page.getByRole("region", { name: "Kanal pesan" });
  await expect(kanal.getByText("Beri izin kirim pesan di AgentBuff dulu.")).toBeVisible();
  await expect(kanal.getByRole("link", { name: "Beri izin" })).toBeVisible();
});

test("Service Worker: push alarm tampil sebagai notifikasi bertag, diulang, ditahan; selesai menggantinya", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "DevTools Protocol hanya Chromium");
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  const asal = new URL(page.url()).origin;
  await context.grantPermissions(["notifications"], { origin: asal });

  const cdp = await context.newCDPSession(page);
  const regId = new Promise<string>((ok) => {
    cdp.on("ServiceWorker.workerRegistrationUpdated", (e: { registrations: Array<{ registrationId: string; scopeURL: string; isDeleted: boolean }> }) => {
      const r = e.registrations.find((x) => x.scopeURL === `${asal}/` && !x.isDeleted);
      if (r) ok(r.registrationId);
    });
  });
  await cdp.send("ServiceWorker.enable");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const reg = await navigator.serviceWorker.ready;
    // `ready` sudah selesai saat pekerja masih "activating"; push nyata baru datang sesudah
    // langganan dibuat, jadi tunggu sampai benar-benar "activated" supaya uji tidak berpacu.
    const aktif = reg.active!;
    if (aktif.state !== "activated") await new Promise<void>((ok) => aktif.addEventListener("statechange", () => aktif.state === "activated" && ok()));
  });
  const registrationId = await regId;

  const kirimPush = (isi: Record<string, unknown>) => cdp.send("ServiceWorker.deliverPushMessage", { origin: asal, registrationId, data: JSON.stringify(isi) });
  const notifikasi = () =>
    page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return (await reg.getNotifications()).map((n) => ({
        judul: n.title,
        isi: n.body,
        tag: n.tag,
        renotify: (n as Notification & { renotify?: boolean }).renotify,
        tahan: n.requireInteraction,
        data: n.data as unknown,
      }));
    });

  await kirimPush({ jenis: "bunyi", judul: "⏰ Presentasi klien", isi: "BANGUN, Nugi!", tag: "kej-e2e", url: "/app/bunyi/kej-e2e", ulang: true, tahan: true });
  await expect
    .poll(notifikasi)
    .toEqual([{ judul: "⏰ Presentasi klien", isi: "BANGUN, Nugi!", tag: "kej-e2e", renotify: true, tahan: true, data: { url: "/app/bunyi/kej-e2e", jenis: "bunyi" } }]);
  // Ulangan 30 dtk kemudian: tag sama, tetap SATU notifikasi (diganti, bukan ditumpuk).
  await kirimPush({ jenis: "bunyi", judul: "⏰ Presentasi klien", isi: "Masih molor, Nugi?", tag: "kej-e2e", url: "/app/bunyi/kej-e2e", ulang: true, tahan: true });
  await expect.poll(async () => (await notifikasi()).map((n) => n.isi)).toEqual(["Masih molor, Nugi?"]);
  // Alarm berhenti: diganti "sudah mati", tanpa ditahan.
  await kirimPush({ jenis: "selesai", judul: "Alarm sudah mati", isi: "Selamat pagi, Nugi!", tag: "kej-e2e", url: "/app", ulang: false, tahan: false });
  await expect
    .poll(notifikasi)
    .toEqual([{ judul: "Alarm sudah mati", isi: "Selamat pagi, Nugi!", tag: "kej-e2e", renotify: false, tahan: false, data: { url: "/app", jenis: "selesai" } }]);
});
