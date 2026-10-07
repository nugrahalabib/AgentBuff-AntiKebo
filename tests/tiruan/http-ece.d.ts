// Tipe minimal pustaka http_ece (dipakai uji untuk membuka isi Web Push aes128gcm, RFC 8188/8291).
declare module "http_ece" {
  import type { ECDH } from "node:crypto";
  export function decrypt(buffer: Buffer, params: { version: "aes128gcm"; privateKey: ECDH; authSecret: Buffer }): Buffer;
}
