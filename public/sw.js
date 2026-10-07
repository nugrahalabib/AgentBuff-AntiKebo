/* Service Worker AntiKebo (P6: notifikasi alarm, PRD G5; P9 menambah cache Mode Jam Meja).
 * Isi push dibuat server (src/lib/pesan `IsiNotif`): { jenis, judul, isi, tag, url, ulang, tahan }.
 * Tag sama = notifikasi diganti, bukan ditumpuk; `ulang` = bunyi/getar lagi (renotify);
 * `tahan` = tidak hilang sendiri sampai diketuk. Mengetuk notifikasi membuka layar alarm. */
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
