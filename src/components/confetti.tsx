import type { CSSProperties } from "react";

// Twelve pieces, fanned out by hand so every burst looks the same (no randomness, no script).
const PIECES = [
  [-70, -46, 160, "var(--color-accent)"], [-40, -64, -120, "var(--color-sticker)"], [-8, -72, 200, "var(--color-positive)"],
  [26, -66, -90, "var(--color-accent)"], [58, -50, 140, "var(--color-sticker)"], [84, -24, -160, "var(--color-positive)"],
  [-86, -14, 90, "var(--color-sticker)"], [-56, 22, -140, "var(--color-positive)"], [-20, 34, 170, "var(--color-accent)"],
  [18, 30, -110, "var(--color-sticker)"], [52, 26, 120, "var(--color-accent)"], [90, 10, -70, "var(--color-positive)"],
] as const;

/** A one-shot confetti pop (CSS only; nothing at all with reduced motion). Put it in a relative box. */
export function Confetti() {
  return (
    <span aria-hidden className="confetti">
      {PIECES.map(([x, y, r, c], i) => (
        <i key={i} style={{ "--x": `${x}px`, "--y": `${y}px`, "--r": `${r}deg`, "--c": c } as CSSProperties} />
      ))}
    </span>
  );
}
