import { expect, test } from "@playwright/test";
import { aturTiruan, masukSebagai, NUGI, pantauGalat, tangkap } from "./bantu";

// P3: "Sambungkan PC ini?" (docs/09-APLIKASI-PC.md §4). Aplikasi PC ditiru lewat API: minta kode,
// buka peramban ke /sambung-pc (belum masuk = masuk dulu lalu kembali ke kode yang sama),
// pengguna menekan Sambungkan, aplikasi mengambil token sekali pakai.

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await aturTiruan(NUGI, { hak: "ok", izin: { kabar: true, suara: true } });
});

test("sambung PC dari nol: masuk, kembali ke kode, sambungkan, token diantar sekali", async ({ page, request }) => {
  const galat = pantauGalat(page);
  const minta = await request.post("/api/perangkat/kode", { data: { nama: "PC Kamar Nugi", versi: "1.0.0" } });
  expect(minta.status()).toBe(201);
  const k = (await minta.json()) as { kode: string; rahasia: string; tautan: string };
  expect(k.tautan).toContain(`/sambung-pc?kode=${k.kode}`);
  expect((await (await request.post("/api/perangkat/kode/ambil", { data: { kode: k.kode, rahasia: k.rahasia } })).json()).status).toBe("menunggu");

  // Belum masuk: lewat layar masuk AgentBuff lalu kembali ke halaman sambung dengan kode yang sama.
  await masukSebagai(page, "Nugi Pratama", undefined, `/sambung-pc?kode=${k.kode}`);
  await expect(page).toHaveURL(new RegExp(`/sambung-pc\\?kode=${k.kode}$`));
  await expect(page.getByRole("heading", { name: "Sambungkan PC ini?" })).toBeVisible();
  await expect(page.getByText("PC Kamar Nugi")).toBeVisible();
  await expect(page.getByText(k.kode)).toBeVisible();
  await tangkap(page, "p3", "sambung-pc");

  await page.getByRole("button", { name: "Sambungkan" }).click();
  await expect(page.getByText("PC tersambung!")).toBeVisible();
  await tangkap(page, "p3", "sambung-pc-berhasil");

  const ambil = await request.post("/api/perangkat/kode/ambil", { data: { kode: k.kode, rahasia: k.rahasia } });
  const h = (await ambil.json()) as { status: string; token: string };
  expect(h.status).toBe("tersambung");
  expect(h.token).toMatch(/^antikebo_pc_/);
  expect((await request.post("/api/perangkat/kode/ambil", { data: { kode: k.kode, rahasia: k.rahasia } })).status()).toBe(410);

  // Token perangkat berlaku: detak dan jadwal 24 jam.
  const detak = await request.post("/api/perangkat/detak", { headers: { Authorization: `Bearer ${h.token}` }, data: { kemampuan: { dicas: true } } });
  expect(detak.status()).toBe(200);
  const jadwal = await request.get("/api/perangkat/jadwal", { headers: { Authorization: `Bearer ${h.token}` } });
  expect(jadwal.status()).toBe(200);
  expect(await jadwal.json()).toMatchObject({ kejadian: expect.any(Array) });
  expect((await request.get("/api/perangkat/jadwal", { headers: { Authorization: "Bearer antikebo_pc_salah" } })).status()).toBe(401);

  // Perangkat terlihat di daftar (sesi web) lalu diputus: token tidak berlaku lagi.
  const daftar = (await (await page.request.get("/api/app/perangkat")).json()) as { perangkat: Array<{ id: string; nama: string; siaga: boolean }> };
  const pc = daftar.perangkat.find((p) => p.nama === "PC Kamar Nugi");
  expect(pc?.siaga).toBe(true);
  const putus = await page.request.delete(`/api/app/perangkat/${pc!.id}`, { headers: { Origin: new URL(page.url()).origin } });
  expect(putus.status()).toBe(200);
  expect((await request.post("/api/perangkat/detak", { headers: { Authorization: `Bearer ${h.token}` }, data: {} })).status()).toBe(401);
  expect(galat).toEqual([]);
});

test("kode yang salah atau habis menampilkan penjelasan, bukan galat", async ({ page }) => {
  const galat = pantauGalat(page);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/sambung-pc?kode=ZZZZ-ZZZZ");
  await expect(page.getByRole("alert").filter({ hasText: "Kodenya sudah tidak berlaku" })).toBeVisible();
  await tangkap(page, "p3", "sambung-pc-habis");
  await page.goto("/sambung-pc");
  await expect(page.getByText("Buka halaman ini lewat tombol di aplikasi AntiKebo untuk PC.")).toBeVisible();
  expect(galat).toEqual([]);
});
