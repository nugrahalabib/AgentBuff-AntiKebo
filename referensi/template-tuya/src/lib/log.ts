import pino from "pino";

// Log JSON. TIDAK PERNAH memuat kunci Tuya, token, atau cookie. Redaksi di
// bawah = jaring pengaman, bukan izin untuk mencatat data itu.
export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "tuya" },
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
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "[disembunyikan]",
  },
});
