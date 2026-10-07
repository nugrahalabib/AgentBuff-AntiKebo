/* Service Worker AntiKebo (P6: notifikasi alarm, PRD G5; P9: simpanan Mode Jam Meja).
 * Isi push dibuat server (src/lib/pesan `IsiNotif`): { jenis, judul, isi, tag, url, ulang, tahan }.
 * Tag sama = notifikasi diganti, bukan ditumpuk; `ulang` = bunyi/getar lagi (renotify);
 * `tahan` = tidak hilang sendiri sampai diketuk. Mengetuk notifikasi membuka layar alarm.
 * Jam Meja mengirim pesan `simpan-siaga` berisi bunyi + klip alarm 24 jam ke depan (docs/10-SUARA.md
 * §6); berkas itu disajikan dari simpanan dulu supaya alarm tetap bersuara saat koneksi putus. */
"use strict";

const GETAR = [600, 200, 600, 200, 600, 200, 900];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

/** Muatan push yang aman dipakai: teks dipotong, url hanya jalur di situs sendiri. */
function bacaMuatan(data) {
  let d = {};
  try {
    d = data ? data.json() : {};
  } catch {
    d = {};
  }
  const teks = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  const url = typeof d.url === "string" && d.url.startsWith("/") && !d.url.startsWith("//") ? d.url : "/app";
  return {
    jenis: teks(d.jenis, 20) || "bunyi",
    judul: teks(d.judul, 120) || "AntiKebo",
    isi: teks(d.isi, 300),
    tag: teks(d.tag, 80) || "antikebo",
    url,
    ulang: d.ulang !== false,
    tahan: d.tahan === true,
  };
}

function opsiNotifikasi(m) {
  return {
    body: m.isi,
    tag: m.tag,
    renotify: m.ulang,
    requireInteraction: m.tahan,
    silent: !m.ulang,
    vibrate: m.ulang ? GETAR : undefined,
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: m.url, jenis: m.jenis },
  };
}

self.addEventListener("push", (e) => {
  const m = bacaMuatan(e.data);
  e.waitUntil(self.registration.showNotification(m.judul, opsiNotifikasi(m)));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const tujuan = new URL((e.notification.data && e.notification.data.url) || "/app", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((jendela) => {
      const sama = jendela.find((w) => w.url === tujuan);
      if (sama) return sama.focus();
      const ada = jendela.find((w) => new URL(w.url).origin === self.location.origin);
      if (ada && "navigate" in ada) return ada.navigate(tujuan).then((w) => (w ? w.focus() : self.clients.openWindow(tujuan)));
      return self.clients.openWindow(tujuan);
    }),
  );
});

// ------------------------------------------------------------------ simpanan Mode Jam Meja

const SIMPANAN_SIAGA = "antikebo-siaga-v1";
const MAKS_SIMPAN = 300;

/** Hanya bunyi alarm dan klip omelan milik pengguna; jalur lain tidak pernah disimpan. */
function bolehDisimpan(jalur) {
  return /^\/bunyi\/[a-z]+\.wav$/.test(jalur) || /^\/api\/perangkat\/klip\/[A-Za-z0-9_-]{8,128}$/.test(jalur);
}

/** Simpan berkas yang diminta (yang sudah ada dilewati), buang yang tidak diminta lagi. */
async function simpanSiaga(daftar) {
  const jalur = [...new Set((Array.isArray(daftar) ? daftar : []).filter((u) => typeof u === "string" && bolehDisimpan(u)))].slice(0, MAKS_SIMPAN);
  const c = await self.caches.open(SIMPANAN_SIAGA);
  let tersimpan = 0;
  for (const u of jalur) {
    if (await c.match(u)) {
      tersimpan++;
      continue;
    }
    try {
      const r = await fetch(u, { credentials: "same-origin" });
      if (r.ok) {
        await c.put(u, r);
        tersimpan++;
      }
    } catch {
      /* jaringan putus: dicoba lagi pada pesan berikutnya */
    }
  }
  for (const req of await c.keys()) {
    if (!jalur.includes(new URL(req.url).pathname)) await c.delete(req);
  }
  return { total: jalur.length, tersimpan };
}

self.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || typeof d !== "object") return;
  if (d.jenis === "simpan-siaga") {
    e.waitUntil(
      simpanSiaga(d.url).then((h) => {
        if (e.source && typeof e.source.postMessage === "function") e.source.postMessage({ jenis: "siaga-tersimpan", ...h });
      }),
    );
  } else if (d.jenis === "lupakan-siaga") {
    e.waitUntil(self.caches.delete(SIMPANAN_SIAGA));
  }
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin || !bolehDisimpan(u.pathname)) return;
  e.respondWith(
    self.caches
      .open(SIMPANAN_SIAGA)
      .then((c) => c.match(u.pathname))
      .then((m) => m || fetch(req)),
  );
});
