// Bantuan bersama jendela PC: kamus (salinan kamus web), panggilan ke proses utama, pembuat elemen.
// Tanpa innerHTML: semua teks lewat textContent.
"use strict";

const AK = (() => {
  const tauri = window.__TAURI__;
  let bahasa = "id";

  function t(jalur) {
    const v = jalur.split(".").reduce((o, k) => (o == null ? undefined : o[k]), window.KAMUS[bahasa]);
    return v == null ? jalur : v;
  }

  function isi(teks, nilai) {
    return String(teks).replace(/\{(\w+)\}/g, (m, k) => (k in nilai ? String(nilai[k]) : m));
  }

  function el(tag, attr, ...anak) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr || {})) {
      if (v == null || v === false) continue;
      if (k === "kelas") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const a of anak.flat()) if (a != null && a !== false) e.append(a instanceof Node ? a : document.createTextNode(String(a)));
    return e;
  }

  function terjemahkan(akar = document) {
    for (const e of akar.querySelectorAll("[data-t]")) e.textContent = t(e.dataset.t);
    document.documentElement.lang = bahasa;
  }

  return {
    t,
    isi,
    el,
    terjemahkan,
    aturBahasa(b) {
      bahasa = b === "en" ? "en" : "id";
    },
    panggil: (perintah, arg) => tauri.core.invoke(perintah, arg),
    dengar: (nama, f) => tauri.event.listen(nama, f),
  };
})();

// Jendela aplikasi, bukan halaman web: tanpa menu klik kanan dan tanpa muat ulang.
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
  if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R"))) e.preventDefault();
});
