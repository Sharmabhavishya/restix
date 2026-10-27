// The single place that decides whether an email address belongs to an allowed
// institutional domain. Exact domain match only: no substring or suffix matching, so
// "snu.edu.in.evil.com", "evilsnu.edu.in" and "x.snu.edu.in" are all rejected.

const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function parseDomainList(raw: string): string[] {
  const domains = raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  for (const d of domains) {
    if (!DOMAIN_RE.test(d)) throw new Error(`Invalid email domain in allowlist: "${d}"`);
  }
  if (domains.length === 0) throw new Error("The email domain allowlist is empty");
  return [...new Set(domains)];
}

/** Returns the lower-cased domain of a syntactically plausible address, or null. */
export function emailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at !== trimmed.indexOf("@") || at === trimmed.length - 1) return null;
  const domain = trimmed.slice(at + 1);
  return DOMAIN_RE.test(domain) ? domain : null;
}

/**
 * Exact addresses let in on top of the domains: temporary testers (TEST_EMAILS). Whole
 * addresses only, compared after trimming and lower-casing; anything malformed is refused.
 */
export function parseEmailList(raw: string | undefined): string[] {
  const emails = (raw ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  for (const e of emails) {
    if (!emailDomain(e)) throw new Error(`Invalid email in tester list: "${e}"`);
  }
  return [...new Set(emails)];
}

export function isAllowedEmail(email: string, allowedDomains: readonly string[], allowedEmails: readonly string[] = []): boolean {
  const domain = emailDomain(email);
  if (domain === null) return false;
  return allowedDomains.includes(domain) || allowedEmails.includes(email.trim().toLowerCase());
}
