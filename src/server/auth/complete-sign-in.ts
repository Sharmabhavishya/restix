import "server-only";
import { cleanText, containsContactDetails } from "@/lib/validation";
import { emailDomain, isAllowedEmail } from "@/lib/email-domain";
import { asSystem } from "../db";
import { env } from "../env";
import { track } from "../analytics";

export interface ProviderIdentity {
  id: string;
  email: string;
  /** Taken from the auth provider's verified data, never from user input. */
  emailVerified: boolean;
  fullName?: string | null;
}

export type SignInResult =
  | { ok: true; isNew: boolean; onboarded: boolean }
  | { ok: false; reason: "unverified_email" | "domain_not_allowed" | "college_not_configured" };

function defaultDisplayName(identity: ProviderIdentity): string {
  // Strip control, bidi and zero-width characters so a name can't be disguised or reordered.
  const fromName = cleanText((identity.fullName ?? "").replace(/\p{Cf}/gu, "")).replace(/\s+/g, " ").trim();
  if (fromName.length >= 2 && !containsContactDetails(fromName)) return fromName.slice(0, 40);
  return identity.email.split("@")[0].replace(/[._-]+/g, " ").slice(0, 40) || "Student";
}

/**
 * Runs after the auth provider has authenticated someone (Google via Supabase, or the
 * local dev sign-in). This is where the institutional rules are enforced: a verified
 * email on an allowed domain that maps to a configured college. Only then is a profile
 * created or marked verified.
 */
export async function completeSignIn(identity: ProviderIdentity): Promise<SignInResult> {
  if (!identity.emailVerified) return { ok: false, reason: "unverified_email" };
  const { allowedDomains, testEmails, DEFAULT_COLLEGE_SLUG } = env();
  if (!isAllowedEmail(identity.email, allowedDomains, testEmails)) return { ok: false, reason: "domain_not_allowed" };
  const domain = emailDomain(identity.email)!;
  const email = identity.email.trim().toLowerCase();

  const result = await asSystem(async (tx) => {
    // A tester's domain belongs to no college; they join the default one.
    const [college] = allowedDomains.includes(domain)
      ? await tx<{ collegeId: string }[]>`select college_id from restix.college_email_domains where domain = ${domain}`
      : await tx<{ collegeId: string }[]>`select id as college_id from restix.colleges where slug = ${DEFAULT_COLLEGE_SLUG ?? ""}`;
    if (!college) return { ok: false as const, reason: "college_not_configured" as const };

    const [existing] = await tx<{ emailVerifiedAt: Date | null; onboardedAt: Date | null }[]>`
      select email_verified_at, onboarded_at from restix.profiles where id = ${identity.id} for update`;
    if (!existing) {
      await tx`insert into restix.profiles (id, college_id, display_name, email_verified_at)
               values (${identity.id}, ${college.collegeId}, ${defaultDisplayName(identity)}, now())
               on conflict (id) do nothing`;
      await tx`insert into restix.profile_private (user_id, email) values (${identity.id}, ${email})
               on conflict (user_id) do nothing`;
      return { ok: true as const, isNew: true, newlyVerified: true, onboarded: false };
    }
    await tx`update restix.profiles set email_verified_at = coalesce(email_verified_at, now()), last_seen_at = now(),
               display_name = ${defaultDisplayName(identity)}
             where id = ${identity.id}`;
    await tx`update restix.profile_private set email = ${email} where user_id = ${identity.id}`;
    return { ok: true as const, isNew: false, newlyVerified: existing.emailVerifiedAt === null, onboarded: existing.onboardedAt !== null };
  });

  if (!result.ok) return result;
  if (result.newlyVerified) await track("email_verified", { userId: identity.id });
  await track("signed_in", { userId: identity.id });
  return { ok: true, isNew: result.isNew, onboarded: result.onboarded };
}

/** Local dev sign-in needs an auth.users row, which Supabase would normally own. Never used with Supabase. */
export async function ensureDevAuthUser(identity: ProviderIdentity): Promise<void> {
  await asSystem((tx) => tx`
    insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
    values (${identity.id}, ${identity.email}, ${identity.emailVerified ? new Date() : null},
            ${tx.json({ full_name: identity.fullName ?? null })})
    on conflict (id) do nothing`);
}
