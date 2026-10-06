import { describe, expect, it } from "vitest";
import { KAMUS_DP } from "@/lib/tuya/kamus-dp";
import { labelPilihan, labelProperti, punyaArtiAngka } from "@/lib/tuya/label-properti";

describe("label properti dari kamus resmi Tuya", () => {
  it("kamus memuat kode kategori yang tidak dimiliki pengguna pertama", () => {
    for (const k of ["ptz_control", "basic_private", "motion_switch", "power_go", "suction", "co2_value", "pm25_value", "alarm_lock", "unlock_fingerprint", "doorcontact_state", "smoke_sensor_state"]) {
      expect(KAMUS_DP[k], k).toBeDefined();
    }
    expect(Object.keys(KAMUS_DP).length).toBeGreaterThan(400);
  });

  it("nama Mandarin dari model diganti nama ramah; kode asing tanpa nama tetap tampil", () => {
    expect(labelProperti("fault", "故障告警").nama).toBe("Gangguan");
    expect(labelProperti("fault", "故障告警", "en").nama).toBe("Fault");
    expect(labelProperti("kode_aneh_x", "某个功能").nama).toBe("kode aneh x");
    expect(labelProperti("kode_aneh_x", "Fitur Khusus").nama).toBe("Fitur Khusus");
  });

  it("arah kamera (PTZ) sesuai dokumen: 0 atas, 2 kanan, 4 bawah, 6 kiri", () => {
    expect(["0", "2", "4", "6"].map((v) => labelPilihan("ptz_control", v))).toEqual(["Atas", "Kanan", "Bawah", "Kiri"]);
  });

  it("angka berarti (status kartu SD) diterjemahkan, angka biasa tidak", () => {
    expect(punyaArtiAngka("sd_status", 5)).toBe(true);
    expect(labelPilihan("sd_status", 5)).toBe("Tidak ada kartu");
    expect(punyaArtiAngka("co2_value", 600)).toBe(false);
  });

  it("label kurasi menang, pilihan resmi tetap terpakai; varian bernomor ikut", () => {
    expect(labelProperti("light_mode", "light_mode").nama).toBe("Lampu indikator");
    expect(labelPilihan("light_mode", "pos")).toBe("Kebalikan saklar");
    expect(labelProperti("relay_status_1", "relay_status_1").nama).toBe("Saat listrik kembali");
    expect(labelPilihan("relay_status_1", "memory")).toBe(labelPilihan("relay_status", "memory"));
    expect(labelProperti("countdown_usb7", "").nama).toBe("countdown usb7");
    expect(labelProperti("switch_usb7", "").nama).toBe("switch usb7");
  });
});
