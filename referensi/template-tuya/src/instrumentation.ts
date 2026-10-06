// Dijalankan sekali saat server Next menyala: tolak menyala bila env wajib
// kosong. Pesan jelas, nilai tidak pernah dicetak.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { periksaEnv } = await import("./lib/env");
    periksaEnv("web");
  }
}
