"use client";

import { useEffect, useState } from "react";

/**
 * Contoh kalimat karakter lewat suara bawaan peramban (pratinjau gaya, bukan klip omelan asli).
 * Mengetuk lagi = berhenti. Dipakai lembar alarm dan orientasi.
 */
export function useDengarContoh(bahasa: "id" | "en") {
  const [diputar, setDiputar] = useState<string | null>(null);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const dengar = (id: string, teks: string) => {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    if (diputar === id) return setDiputar(null);
    const u = new SpeechSynthesisUtterance(teks);
    u.lang = bahasa === "id" ? "id-ID" : "en-US";
    u.rate = 1.05;
    u.onend = () => setDiputar(null);
    setDiputar(id);
    s.speak(u);
  };
  return { diputar, dengar };
}
