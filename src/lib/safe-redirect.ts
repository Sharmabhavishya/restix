/**
 * Returns `next` only if it is a same-site path ("/tickets?x=1"), otherwise the fallback.
 * Blocks absolute URLs, protocol-relative "//evil.com", backslash tricks and control characters.
 */
export function safeNext(next: unknown, fallback = "/tickets"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001F\u007F\\]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://restix.invalid");
    if (url.origin !== "http://restix.invalid") return fallback;
    if (url.pathname.startsWith("/auth/")) return fallback;
    const out = `${url.pathname}${url.search}${url.hash}`;
    // Normalisation can turn "/.//evil.com" into "//evil.com": check the result again.
    if (!out.startsWith("/") || out.startsWith("//") || out.startsWith("/\\")) return fallback;
    return out;
  } catch {
    return fallback;
  }
}
