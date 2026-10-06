"""
Bangun pustaka kode remote AC dari SmartIR (MIT, https://github.com/smartHomeHub/SmartIR).

    python scripts/bangun-kode-ac.py <folder codes/climate SmartIR>

Keluaran: aset/kode-ac/index.json + aset/kode-ac/<id>.json.gz.
Hanya berkas berformat Broadlink (base64) yang dipakai; kode yang tidak bisa
diurai dibuang, model tanpa kode "off" + satu mode dingin/apa pun dilewati.
Konversi ke format pemancar Tuya dilakukan saat mengirim (src/lib/ir/kode-ac.ts).
"""
import base64, gzip, json, os, sys

SMARTIR_COMMIT = "e4df2957ad915536f41ffb39daa96886d7cfe040"

# Urutan merek yang paling banyak dipakai di Indonesia lebih dulu.
URUTAN = ["Daikin", "Panasonic", "Sharp", "LG", "Samsung", "Gree", "Midea", "Polytron", "AUX", "Hisense", "TCL", "Haier",
          "Toshiba", "Mitsubishi Electric", "Mitsubishi Heavy", "Mitsubishi", "Hitachi", "Fujitsu", "Electrolux", "Akai",
          "Chigo", "Carrier", "Changhong", "Kelvinator", "Sanyo", "General Electric", "Whirlpool", "Hyundai"]

PERBAIKI_MEREK = {
    "Ggeneral Electric": "General Electric", "Dalkin": "Daikin", "Mitsubishi Heavy Industries": "Mitsubishi Heavy",
    "ROYAL": "Royal", "ELGIN": "Elgin", "FUJIKO": "Fujiko", "BAXI": "Baxi", "VS": "VS",
}


def sah_broadlink(kode):
    try:
        b = base64.b64decode(kode)
    except Exception:
        return False
    if len(b) < 8 or b[0] != 0x26:
        return False
    n = b[2] | (b[3] << 8)
    return n > 4


def bersihkan(c):
    """Buang kode rusak; kembalikan None bila tidak ada isinya."""
    if isinstance(c, str):
        return c if sah_broadlink(c) else None
    if isinstance(c, dict):
        hasil = {}
        for k, v in c.items():
            v2 = bersihkan(v)
            if v2 is not None:
                hasil[str(k)] = v2
        return hasil or None
    return None


def main():
    sumber = sys.argv[1]
    keluar = os.path.join(os.path.dirname(__file__), "..", "aset", "kode-ac")
    os.makedirs(keluar, exist_ok=True)
    for f in os.listdir(keluar):
        if f.endswith(".json.gz") or f == "index.json":
            os.remove(os.path.join(keluar, f))

    per_merek = {}
    jumlah = 0
    for nama in sorted(os.listdir(sumber), key=lambda x: (len(x), x)):
        if not nama.endswith(".json"):
            continue
        try:
            d = json.load(open(os.path.join(sumber, nama), encoding="utf-8"))
        except Exception:
            continue
        if d.get("supportedController") != "Broadlink" or d.get("commandsEncoding") != "Base64":
            continue
        perintah = bersihkan(d.get("commands") or {})
        if not perintah or "off" not in perintah:
            continue
        mode = [m for m in d.get("operationModes", []) if m in perintah]
        if not mode:
            continue
        mid = nama[:-5]
        merek = PERBAIKI_MEREK.get(d.get("manufacturer", "").strip(), d.get("manufacturer", "").strip()) or "Lainnya"
        model = [str(m).strip() for m in d.get("supportedModels", []) if str(m).strip()]
        isi = {
            "id": mid,
            "merek": merek,
            "model": model,
            "min": d.get("minTemperature", 16),
            "maks": d.get("maxTemperature", 30),
            "langkah": d.get("precision", 1),
            "mode": mode,
            "kipas": [k for k in d.get("fanModes", []) if isinstance(k, str)],
            "ayun": d.get("swingModes") or None,
            "perintah": perintah,
        }
        with gzip.open(os.path.join(keluar, f"{mid}.json.gz"), "wt", encoding="utf-8") as g:
            json.dump(isi, g, separators=(",", ":"), ensure_ascii=False)
        per_merek.setdefault(merek, []).append({"id": mid, "model": model[:6]})
        jumlah += 1

    urut = sorted(per_merek, key=lambda m: (URUTAN.index(m) if m in URUTAN else len(URUTAN), m.lower()))
    index = {
        "sumber": f"SmartIR (MIT) commit {SMARTIR_COMMIT}",
        "jumlah": jumlah,
        "merek": [{"merek": m, "kode": per_merek[m]} for m in urut],
    }
    json.dump(index, open(os.path.join(keluar, "index.json"), "w", encoding="utf-8", newline="\n"), ensure_ascii=False, separators=(",", ":"))
    print(f"{jumlah} model, {len(urut)} merek")


if __name__ == "__main__":
    main()
