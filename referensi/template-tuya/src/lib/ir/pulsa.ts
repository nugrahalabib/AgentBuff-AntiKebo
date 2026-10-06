/** Urai pulsa IR jarak-pulsa (pulse distance) jadi byte. MURNI, diuji di tests/unit/protokol-ac.test.ts. */

/** Urai pulsa jadi bingkai byte (LSB dulu). Bingkai dimulai tanda panjang (>2500 µs). */
export function uraiJarakPulsa(pulsa: number[], opsi: { headerMin?: number; ambangSatu?: number; jedaBingkai?: number } = {}): number[][] {
  const headerMin = opsi.headerMin ?? 2500;
  const ambang = opsi.ambangSatu ?? 800;
  const jeda = opsi.jedaBingkai ?? 5000;
  const bingkai: number[][] = [];
  let bit: number[] = [];
  const tutup = () => {
    if (bit.length >= 8) {
      const byte: number[] = [];
      for (let j = 0; j + 8 <= bit.length; j += 8) byte.push(bit.slice(j, j + 8).reduce((a, b, k) => a | (b << k), 0));
      bingkai.push(byte);
    }
    bit = [];
  };
  for (let i = 0; i + 1 < pulsa.length; i += 2) {
    const tanda = pulsa[i];
    const sela = pulsa[i + 1];
    if (tanda > headerMin) {
      tutup();
      continue;
    }
    if (sela > jeda) {
      tutup();
      continue;
    }
    bit.push(sela > ambang ? 1 : 0);
  }
  tutup();
  return bingkai;
}
