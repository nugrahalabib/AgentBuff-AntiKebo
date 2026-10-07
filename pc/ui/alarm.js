// Jendela alarm PC (docs/09 §6): soal dari server lewat proses utama (token tidak pernah ada di
// sini), soal hitungan luring bila internet putus (PRD D8), tunda, Masih bangun, Selamat pagi.
// Bunyi diputar proses utama dan HANYA berhenti bila server atau soal luring berkata selesai.
"use strict";

(() => {
  const { t, isi, el, panggil, dengar } = AK;
  const $ = (id) => document.getElementById(id);
  let a = null;
  let mode = "bangun";
  let soal = null;
  let luring = null;
  let sumber = null;
  let proses = false;
  let dijawabDiSini = false;
  let kunciMuat = null;
  let ulang = null;
  let detikCek = null;

  function tampil(nama) {
    for (const x of ["berbunyi", "pagi", "cek"]) $(x).hidden = x !== nama;
    if (nama !== "cek" && detikCek) {
      clearInterval(detikCek);
      detikCek = null;
    }
  }

  function jamSekarang() {
    const d = new Date();
    const j = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return a && a.bahasa === "en" ? j : j.replace(":", ".");
  }

  const api = (metode, jalur, data) => panggil("api_alarm", { metode, jalur, isi: data == null ? null : data });

  function umpan(teks, nada) {
    const u = $("umpan");
    if (!u) return;
    u.textContent = teks || "";
    u.className = "umpan" + (nada ? " " + nada : "");
  }

  function getar() {
    const k = $("kartu");
    k.classList.remove("getar");
    void k.offsetWidth;
    k.classList.add("getar");
  }

  function titik(target, benar) {
    if (!target || target <= 1) return null;
    return el("div", { kelas: "titik", role: "img", "aria-label": `${t("bunyi.beruntun")}: ${benar}/${target}` }, Array.from({ length: target }, (_, i) => el("span", { kelas: i < benar ? "isi" : "" })));
  }

  function isian(jenis, petunjuk) {
    const masuk = el("input", {
      id: "isian",
      type: "text",
      inputmode: jenis === "ketik" ? "text" : "numeric",
      autocomplete: "off",
      spellcheck: "false",
      placeholder: petunjuk,
      "aria-label": t("bunyi.jawaban"),
    });
    const kirimKe = () => {
      const v = masuk.value;
      masuk.value = "";
      kirim(v);
    };
    masuk.addEventListener("keydown", (e) => {
      if (e.key === "Enter") kirimKe();
    });
    return [masuk, el("button", { type: "button", kelas: "kirim", onclick: kirimKe }, t("bunyi.kirim"))];
  }

  function gambarKartu() {
    const k = $("kartu");
    const isiKartu = [];
    if (sumber === "luring") {
      if (!luring) return k.replaceChildren(el("p", { kelas: "label" }, t("pc.alarm.memuat")));
      isiKartu.push(el("p", { kelas: "label" }, t("pc.alarm.luringJudul")), el("p", { kelas: "soal angka" }, luring.teks), ...isian("hitungan", t("bunyi.jawaban")), titik(luring.target, luring.benarBeruntun));
    } else if (!soal) {
      isiKartu.push(el("p", { kelas: "label" }, t("pc.alarm.memuat")));
    } else {
      const label = mode === "tunda" ? t("bunyi.soalTunda") : soal.jumlahTahap > 1 ? isi(t("bunyi.tahap"), { ke: soal.tahap + 1, dari: soal.jumlahTahap }) : null;
      if (label) isiKartu.push(el("p", { kelas: "label" }, label));
      if (soal.jenis === "qr") {
        const tempat = (soal.tampil.tempat || [])[0];
        isiKartu.push(
          el("p", { kelas: "soal kalimat" }, tempat ? isi(t("bunyi.qrJudulTempat"), { tempat }) : t("bunyi.qrJudul")),
          el("p", { kelas: "label" }, t("pc.alarm.qrPc")),
          el("button", { type: "button", kelas: "kirim", onclick: gantiHitungan }, t("pc.alarm.gantiHitungan")),
        );
      } else if (soal.jenis === "ingat") {
        const lihat = el("p", { kelas: "soal angka" }, soal.tampil.teks);
        const judul = el("p", { kelas: "label" }, t("bunyi.ingatLihat"));
        const [masuk, tombol] = isian("ingat", t("bunyi.jawaban"));
        masuk.hidden = true;
        tombol.hidden = true;
        setTimeout(() => {
          lihat.textContent = "• • • • • •";
          judul.textContent = t("bunyi.ingatKetik");
          masuk.hidden = false;
          tombol.hidden = false;
          masuk.focus();
        }, soal.tampil.sembunyiSetelahMs || 3000);
        isiKartu.push(judul, lihat, masuk, tombol);
      } else if (soal.jenis === "ketik") {
        isiKartu.push(el("p", { kelas: "label" }, t("bunyi.ketikJudul")), el("p", { kelas: "soal kalimat" }, soal.tampil.teks), ...isian("ketik", t("bunyi.ketikPlaceholder")));
      } else {
        isiKartu.push(el("p", { kelas: "soal angka" }, soal.tampil.teks), ...isian("hitungan", t("bunyi.jawaban")));
      }
      isiKartu.push(titik(soal.target, soal.benarBeruntun));
    }
    const lama = $("umpan");
    isiKartu.push(lama || el("p", { id: "umpan", kelas: "umpan", role: "status" }));
    k.replaceChildren(...isiKartu.filter(Boolean));
    const m = $("isian");
    if (m && !m.hidden) m.focus();
  }

  function gambarPita() {
    $("pita").hidden = sumber !== "luring";
    $("pita").textContent = t("pc.alarm.putus");
  }

  function gambarBawah(L) {
    const b = $("bawah");
    const sisa = L.item.tunda.jatah - L.item.tunda.terpakai;
    if (sumber === "server" && mode === "tunda") {
      b.replaceChildren(el("button", { type: "button", kelas: "tombol-gelap", onclick: () => gantiMode("bangun") }, t("bunyi.kembaliSoal")));
    } else if (sumber === "server" && sisa > 0 && !L.item.uji) {
      b.replaceChildren(el("button", { type: "button", kelas: "tombol-gelap", onclick: () => gantiMode("tunda") }, isi(t("bunyi.tunda"), { menit: L.item.tunda.menit, sisa })));
    } else b.replaceChildren();
  }

  function gantiMode(m) {
    mode = m;
    soal = null;
    umpan(null);
    gambarKartu();
    gambarBawah(a.layar);
    ambilSoal();
  }

  async function ambilSoal() {
    const L = a.layar;
    sumber = "server";
    gambarPita();
    clearTimeout(ulang);
    try {
      const r = await api("GET", `/api/kejadian/${L.kejadianId}/soal${mode === "tunda" ? "?tujuan=tunda" : ""}`);
      if (r.status === 200) {
        soal = r.isi.soal;
      } else {
        // Mis. server belum membunyikan (PC lebih dulu): coba lagi sebentar lagi.
        umpan((r.isi && r.isi.pesan) || t("umum.galatUmum"), "salah");
        if (mode === "tunda") mode = "bangun";
        ulang = setTimeout(ambilSoal, 3000);
      }
      gambarKartu();
      gambarBawah(L);
    } catch (e) {
      if (e === "jaringan") ambilLuring();
    }
  }

  async function ambilLuring() {
    sumber = "luring";
    mode = "bangun";
    gambarPita();
    luring = await panggil("soal_luring_alarm");
    gambarKartu();
    if (a && a.layar) gambarBawah(a.layar);
  }

  async function gantiHitungan() {
    if (proses) return;
    proses = true;
    try {
      const r = await api("POST", `/api/kejadian/${a.layar.kejadianId}/ganti-soal`);
      if (r.status === 200) {
        soal = r.isi.soal;
        gambarKartu();
        umpan(t("bunyi.diganti"), "salah");
      } else umpan((r.isi && r.isi.pesan) || t("umum.galatUmum"), "salah");
    } catch (e) {
      if (e === "jaringan") ambilLuring();
    } finally {
      proses = false;
    }
  }

  async function kirim(jawaban) {
    if (proses || !jawaban.trim()) return;
    proses = true;
    try {
      if (sumber === "luring") {
        const h = await panggil("jawab_luring", { jawaban });
        if (!h) return;
        if (h.lolos) {
          dijawabDiSini = true;
          return;
        }
        luring = h.soal;
        gambarKartu();
        if (h.benar) umpan(t("bunyi.benar"), "benar");
        else {
          getar();
          umpan(t("bunyi.salah"), "salah");
        }
        return;
      }
      const r = await api("POST", `/api/kejadian/${a.layar.kejadianId}/jawab`, { soalId: soal.id, jawaban });
      if (r.status !== 200) {
        umpan((r.isi && r.isi.pesan) || t("umum.galatUmum"), "salah");
        return ambilSoal();
      }
      const h = r.isi;
      if (h.hasil === "selesai" || h.hasil === "ditunda") {
        dijawabDiSini = true;
        return;
      }
      soal = h.soal;
      gambarKartu();
      if (h.hasil === "salah") {
        getar();
        umpan(soal.jenis === "qr" ? t("bunyi.qrSalah") : t("bunyi.salah"), "salah");
      } else if (h.hasil === "benar") umpan(t("bunyi.benar"), "benar");
      else if (h.hasil === "tahap") umpan(t("bunyi.tahapQr"), "benar");
      else umpan(t("bunyi.diganti"), "salah");
    } catch (e) {
      if (e === "jaringan") ambilLuring();
      else umpan(t("umum.galatUmum"), "salah");
    } finally {
      proses = false;
    }
  }

  function gambarBerbunyi(L) {
    tampil("berbunyi");
    $("jam").textContent = L.item.jam;
    $("judul").textContent = L.item.judul;
    $("detail").hidden = !L.item.detail;
    $("detail").textContent = L.item.detail || "";
    $("omelan").textContent = a.omelan || "";
    const server = !!L.kejadianId && a.daring;
    const kunci = `${L.item.kunci}|${server ? L.kejadianId : "luring"}`;
    if (kunci !== kunciMuat) {
      kunciMuat = kunci;
      mode = "bangun";
      soal = null;
      luring = null;
      dijawabDiSini = false;
      sumber = server ? "server" : "luring";
      gambarKartu();
      umpan(null);
      if (server) ambilSoal();
      else ambilLuring();
    }
    gambarPita();
    gambarBawah(L);
  }

  function layarTenang(judul, baris, agenda, catatan, tombol) {
    tampil("pagi");
    $("pagi-judul").textContent = judul;
    $("pagi-jam").hidden = !baris;
    $("pagi-jam").textContent = baris || "";
    $("pagi-agenda").hidden = !agenda;
    $("pagi-agenda-judul").textContent = agenda ? agenda.judul : "";
    $("pagi-agenda-detail").textContent = agenda && agenda.detail ? agenda.detail : "";
    $("pagi-catatan").hidden = !catatan;
    $("pagi-catatan").textContent = catatan || "";
    $("tombol-oke").textContent = tombol;
    $("tombol-oke").focus();
  }

  function gambarSelesai(L) {
    kunciMuat = null;
    const nama = a.nama || t("umum.kamu");
    if (L.alasan === "ditunda") return layarTenang(t("bunyi.ditundaJudul"), isi(t("pc.alarm.ditunda"), { jam: L.lagi || "" }), null, null, t("pagi.oke"));
    if (L.alasan === "selesai" && !dijawabDiSini) {
      // Dijawab di HP/web: PC tidak perlu ditunggui, layar ini menutup sendiri sesudah 1 menit.
      setTimeout(() => panggil("tutup_alarm").catch(() => {}), 60_000);
      return layarTenang(isi(t("pagi.judul"), { nama }), null, null, t("pc.alarm.selesaiLain"), t("pc.alarm.tutup"));
    }
    let catatan = null;
    if (L.alasan === "luring") catatan = t("pc.alarm.luringTerkirim");
    if (L.alasan === "cek" && L.item.cekPada) catatan = isi(t("pagi.cekLagi"), { n: Math.max(1, Math.ceil((Date.parse(L.item.cekPada) - Date.now()) / 60000)) });
    const agenda = L.item.uji ? null : { judul: L.item.judul, detail: L.item.detail };
    layarTenang(isi(t("pagi.judul"), { nama }), isi(t("pagi.bangun"), { jam: jamSekarang() }), agenda, catatan, t("pagi.oke"));
  }

  function gambarCek(L) {
    tampil("cek");
    kunciMuat = null;
    const hitung = () => {
      const n = L.item.cekBatas ? Math.max(0, Math.ceil((Date.parse(L.item.cekBatas) - Date.now()) / 1000)) : 0;
      $("cek-sisa").textContent = isi(t("cek.sisa"), { n });
    };
    hitung();
    if (!detikCek) detikCek = setInterval(hitung, 1000);
    $("tombol-masih").focus();
  }

  $("tombol-oke").addEventListener("click", () => panggil("tutup_alarm").catch(muat));
  $("tombol-masih").addEventListener("click", async () => {
    const L = a && a.layar;
    if (!L || !L.kejadianId || proses) return;
    proses = true;
    try {
      const r = await api("POST", `/api/kejadian/${L.kejadianId}/masih-bangun`);
      $("cek-galat").textContent = r.status === 200 ? "" : (r.isi && r.isi.pesan) || t("umum.galatUmum");
    } catch {
      $("cek-galat").textContent = t("umum.terputus");
    } finally {
      proses = false;
    }
  });

  async function muat() {
    a = await panggil("layar_alarm");
    AK.aturBahasa(a.bahasa);
    AK.terjemahkan();
    const L = a.layar;
    if (!L) return;
    if (L.mode === "berbunyi") gambarBerbunyi(L);
    else if (L.mode === "cek") gambarCek(L);
    else gambarSelesai(L);
  }

  dengar("alarm", muat);
  dengar("omelan", (e) => {
    $("omelan").textContent = e.payload || "";
  });
  muat();
})();
