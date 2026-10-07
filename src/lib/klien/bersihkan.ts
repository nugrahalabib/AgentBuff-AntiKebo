/**
 * Bersihkan jejak akun di peramban ini (keluar, hapus data): klip omelan (berisi nama) di simpanan
 * Jam Meja, id Jam Meja, dan langganan notifikasi. `lepasDiServer` = beri tahu server dulu (keluar
 * biasa); sesudah hapus data barisnya sudah tidak ada. Tidak pernah melempar.
 */
export async function bersihkanPeramban(opsi: { lepasDiServer: boolean }): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      if (opsi.lepasDiServer) {
        await fetch("/api/app/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      }
      await sub.unsubscribe();
    }
  } catch {
    // Tidak didukung: lanjut.
  }
  try {
    await window.caches?.delete("antikebo-siaga-v1");
    localStorage.removeItem("antikebo:jam-meja");
  } catch {
    // Tidak didukung: lanjut.
  }
}
