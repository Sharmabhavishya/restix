// Every event gets a stable identity tint, like the coloured wristbands each fest prints.
// Pale, never the accent, never violet/indigo (house rule). Identity, not data.
// Six hues (pink, coral, butter, mint, aqua, sky) so a week of events reads like a stack of
// different bands rather than two colours taking turns.
const HUES = [350, 30, 85, 150, 190, 230] as const;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function eventHue(eventId: string): number {
  return HUES[hash(eventId) % HUES.length];
}

/** CSS custom properties for a band in this event's colour. */
export function bandStyle(eventId: string): Record<string, string> {
  const h = eventHue(eventId);
  return {
    "--band": `light-dark(oklch(0.96 0.038 ${h}), oklch(0.25 0.04 ${h}))`,
    "--band-strong": `light-dark(oklch(0.9 0.075 ${h}), oklch(0.33 0.07 ${h}))`,
    "--band-ink": `light-dark(oklch(0.36 0.07 ${h}), oklch(0.84 0.06 ${h}))`,
  };
}
