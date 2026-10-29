// Ticket levels: the kinds of ticket within one event, like "Normal" and "Fan pit".
// An event with just one kind has a single level, "General" ("not applicable" in the forms).

/** The levels most events use, offered as one-tap choices. */
export const LEVEL_PRESETS = ["Normal", "Fan pit", "VIP", "Early bird", "Day pass", "Night pass", "Student", "Couple", "Group of 4", "All-access", "Backstage"];

/** The single level an event with one kind of ticket gets. */
export const SINGLE_LEVEL = "General";

export const MAX_LEVELS = 12;

/**
 * Tidies what someone picked or typed into a list of level names: trimmed, inner spaces collapsed,
 * no commas (the event form stores "Name, price" lines), at most 60 characters, no duplicates
 * (ignoring case), at most 12. Typed text may hold several names separated by commas or new lines.
 */
export function parseLevels(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values.flatMap((v) => v.split(/[,\n]/))) {
    const name = raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
    if (out.length === MAX_LEVELS) break;
  }
  return out;
}
