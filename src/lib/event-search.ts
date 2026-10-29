/** Whether an event matches what someone typed: every word appears in its name or venue. */
export function matchesSearch(e: { name: string; venue?: string | null }, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${e.name} ${e.venue ?? ""}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}
