// Jendela pengaturan kecil (docs/09 §3 butir 4): sambung, daftar periksa, tes bunyi, versi.
"use strict";

(() => {
  const { t, isi, el, panggil, dengar } = AK;
  const $ = (id) => document.getElementById(id);
  let tesBerjalan = false;

  function baris(ok, teks, aksi) {
    return el("li", {}, el("span", { kelas: ok ? "tanda" : "tanda peringatan", "aria-hidden": "true" }, ok ? "✓" : "!"), el("span", { kelas: "teks" }, teks), aksi || null);
  }

  function gambar(k) {
    AK.aturBahasa(k.bahasa);
    AK.terjemahkan();
    $("versi").textContent = isi(t("pc.versi"), { v: k.versi });
    $("belum").hidden = k.tersambung;
    $("sudah").hidden = !k.tersambung;

    // Belum tersambung: minta kode, lalu tunggu persetujuan di browser.
    $("minta").hidden = !!k.kode;
    $("kode").hidden = !k.kode;
    $("nilai-kode").textContent = k.kode || "";
    const g = k.galatSambung;
    $("galat-sambung").hidden = g == null;
    $("galat-sambung").textContent = g === "kodeHabis" ? t("pc.kodeHabis") : g || t("pc.gagalKode");

    // Tersambung.
    $("status").textContent = "✓ " + isi(t("pc.tersambung"), { nama: k.nama || "AntiKebo" });
    $("berikut").textContent = k.alarmBerikut ? isi(t("pc.alarmBerikut"), { jam: k.alarmBerikut }) + (k.judulBerikut ? " · " + k.judulBerikut : "") : t("pc.tanpaAlarm");
    const p = k.periksa;
    const daftar = [
      baris(k.daring, k.daring ? t("pc.server") : t("pc.serverPutus")),
      baris(p.autostart, t("pc.mulaiWindows"), p.autostart ? null : el("button", { type: "button", kelas: "tombol kecil", onclick: () => panggil("nyalakan_autostart").then(muat) }, t("pc.nyalakan"))),
      baris(true, t("pc.tidakTidur")),
    ];
    if (p.tutupLaptop != null)
      daftar.push(baris(!p.tutupLaptop, t("pc.tutupLaptop"), p.tutupLaptop ? el("button", { type: "button", kelas: "tombol kecil", onclick: () => panggil("perbaiki_tutup").then(muat) }, t("pc.perbaiki")) : null));
    daftar.push(baris(p.suara, p.suara ? t("pc.suaraAda") : t("pc.suaraTidakAda")));
    if (p.dicas != null) daftar.push(baris(p.dicas, p.dicas ? t("pc.dicas") : t("pc.belumDicas")));
    $("daftar").replaceChildren(...daftar);
    $("galat-tutup").hidden = !p.tutupGagal;
    $("galat-tutup").textContent = t("pc.tutupGagal");

    $("teks-dengar").textContent = tesBerjalan ? t("pc.dengar") : t("pc.tesBunyi");
    $("tombol-tes").setAttribute("aria-label", t("pc.tesBunyi"));
    $("hasil-dengar").hidden = k.dengar == null || tesBerjalan;
    $("hasil-dengar").textContent = k.dengar ? t("pc.dengarYa") : t("pc.dengarTidak");

    const kunci = k.keluarTerkunci;
    $("terkunci").hidden = !kunci;
    $("terkunci").textContent = kunci === "komitmen" ? t("pc.terkunci") : t("pc.terkunciBerbunyi");
    $("tombol-putus").hidden = !k.tersambung;
    $("tombol-putus").disabled = !!kunci;
    $("tombol-keluar").disabled = !!kunci;
  }

  async function muat() {
    gambar(await panggil("keadaan"));
  }

  $("tombol-sambung").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      await panggil("mulai_sambung");
    } catch {
      // Pesan galat ramah datang lewat keadaan.
    }
    e.currentTarget.disabled = false;
    muat();
  });
  $("tombol-buka").addEventListener("click", () => panggil("buka_tautan_sambung"));
  $("tombol-batal").addEventListener("click", () => panggil("batal_sambung").then(muat));
  $("tombol-tes").addEventListener("click", () => {
    if (tesBerjalan) return;
    tesBerjalan = true;
    panggil("tes_bunyi");
    $("teks-dengar").textContent = t("pc.dengar");
    $("hasil-dengar").hidden = true;
    $("tombol-tes").hidden = true;
    $("tombol-ya").hidden = false;
    $("tombol-tidak").hidden = false;
  });
  const jawabDengar = (ya) => {
    tesBerjalan = false;
    $("tombol-tes").hidden = false;
    $("tombol-ya").hidden = true;
    $("tombol-tidak").hidden = true;
    panggil("jawab_dengar", { ya }).then(muat);
  };
  $("tombol-ya").addEventListener("click", () => jawabDengar(true));
  $("tombol-tidak").addEventListener("click", () => jawabDengar(false));
  $("tombol-putus").addEventListener("click", () => panggil("putuskan").then(muat, muat));
  $("tombol-keluar").addEventListener("click", () => panggil("keluar").catch(muat));

  dengar("keadaan", muat);
  setInterval(muat, 5000);
  muat();
})();
