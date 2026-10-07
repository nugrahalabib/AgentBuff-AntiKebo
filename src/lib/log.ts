import pino from "pino";

// Log JSON. TIDAK PERNAH memuat kunci, token, cookie, isi pesan pribadi, jawaban soal,
// atau teks naskah pribadi. Redaksi di bawah = jaring pengaman, bukan izin untuk mencatat data itu.
export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "antikebo" },
  redact: {
    paths: [
      "*.token",
      "*.access_token",
      "*.id_token",
      "*.client_secret",
      "*.sandi",
      "*.kunci",
      "*.apiKey",
      "*.kunciSandi",
      "*.authorization",
      "*.jawaban",
      "*.teks",
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "[disembunyikan]",
  },
});
