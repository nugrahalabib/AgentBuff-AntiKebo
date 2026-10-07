import type { KeyboardEvent } from "react";

/**
 * Pola radio WAI-ARIA untuk kelompok `role="radiogroup"` buatan sendiri: panah memindah fokus
 * DAN pilihan (pilihan mengikuti fokus), Home/End ke ujung. Dipasang di elemen kelompoknya.
 */
export function gerakRadio(e: KeyboardEvent<HTMLElement>) {
  const maju = e.key === "ArrowRight" || e.key === "ArrowDown";
  const mundur = e.key === "ArrowLeft" || e.key === "ArrowUp";
  if (!maju && !mundur && e.key !== "Home" && e.key !== "End") return;
  const radio = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])')];
  const i = radio.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const j = e.key === "Home" ? 0 : e.key === "End" ? radio.length - 1 : (i + (maju ? 1 : -1) + radio.length) % radio.length;
  radio[j].focus();
  radio[j].click();
}
