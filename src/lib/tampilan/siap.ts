/**
 * "Siap malam ini" (PRD H1, K-96): perangkat siaga (detak < 2 menit) DAN menyatakan sudah memegang
 * jadwal + suara sampai alarm berikutnya (`siapSampai` dari detak). Tanpa alarm berikutnya cukup
 * siaga. Murni, dipakai server dan peramban.
 */
export function siapMalamIni(p: { siaga: boolean; siapSampai: Date | string | null }, alarmBerikutnya: Date | string | null): boolean {
  if (!p.siaga) return false;
  if (!alarmBerikutnya) return true;
  return !!p.siapSampai && new Date(p.siapSampai).getTime() >= new Date(alarmBerikutnya).getTime();
}
