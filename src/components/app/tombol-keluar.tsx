"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tombol } from "@/components/ui/dasar";
import { tampilToast } from "@/components/ui/toast";
import { useKamus } from "@/lib/i18n/klien";

/** Keluar: cabut sesi di server lalu kembali ke halaman depan. */
export function TombolKeluar() {
  const { t } = useKamus();
  const router = useRouter();
  const [proses, setProses] = useState(false);
  return (
    <Tombol
      varian="bahaya"
      ukuran="besar"
      className="w-full"
      disabled={proses}
      onClick={async () => {
        setProses(true);
        try {
          // Peramban ini berhenti menerima notifikasi alarm akun ini (peramban bisa dipakai orang lain).
          try {
            const reg = await navigator.serviceWorker?.getRegistration("/");
            const sub = await reg?.pushManager.getSubscription();
            if (sub) {
              await fetch("/api/app/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
              await sub.unsubscribe();
            }
          } catch {
            // Tidak didukung: lanjut keluar.
          }
          const res = await fetch("/api/keluar", { method: "POST" });
          if (!res.ok) throw new Error(String(res.status));
          router.replace("/");
          router.refresh();
        } catch {
          setProses(false);
          tampilToast(t.pengaturan.keluarGagal, "galat");
        }
      }}
    >
      <LogOut size={18} />
      {proses ? t.umum.memuat : t.pengaturan.keluar}
    </Tombol>
  );
}
