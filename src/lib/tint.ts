// Every event gets a stable identity tint, like the coloured wristbands each fest prints.
// Pale, never the accent, never violet/indigo (house rule). Identity, not data.
const HUES = [350, 28, 62, 142, 188, 212] as const;

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
    "--band": `oklch(0.962 0.03 ${h})`,
    "--band-strong": `oklch(0.905 0.06 ${h})`,
    "--band-ink": `oklch(0.36 0.07 ${h})`,
  };
}
