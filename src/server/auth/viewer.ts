import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/email-domain";
import { asSystem } from "../db";
import { devAuthEnabled, env, supabaseAuthConfigured } from "../env";
import { DEV_COOKIE, decodeDevSession } from "./dev-session";
import { supabaseServer } from "./supabase";

export interface Identity {
  id: string;
  email: string;
}

/**
 * Why someone can or can't use the marketplace:
 * - ok: verified institutional email, active account
 * - restricted: may browse, may not list, contact sellers or report
 * - suspended: may only see their account and appeal
 * - unverified / domain_not_allowed / no_profile: may not use the marketplace
 */
export type Access = "ok" | "restricted" | "suspended" | "unverified" | "domain_not_allowed" | "no_profile";

export interface Viewer {
  id: string;
  email: string;
  displayName: string;
  collegeId: string;
  collegeName: string;
  collegeShortName: string;
  emailVerifiedAt: Date | null;
  status: "active" | "restricted" | "suspended";
  statusReason: string | null;
  onboarded: boolean;
  role: "moderator" | "admin" | null;
  access: Access;
}

/** The authenticated identity from a verified session, or null. Never trusts client-supplied ids. */
export const getIdentity = cache(async (): Promise<Identity | null> => {
  if (devAuthEnabled()) {
    const dev = decodeDevSession((await cookies()).get(DEV_COOKIE)?.value);
    return dev ? { id: dev.sub, email: dev.email } : null;
  }
  if (env().AUTH_MODE !== "supabase" || !supabaseAuthConfigured()) return null;
  try {
    const supabase = await supabaseServer();
    // getClaims() verifies the JWT signature; getSession() would trust the cookie blindly.
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub || typeof data.claims.email !== "string") return null;
    const appMeta = data.claims.app_metadata as { provider?: string; providers?: string[] } | undefined;
    if (!(appMeta?.providers ?? [appMeta?.provider]).includes("google")) return null;
    return { id: data.claims.sub, email: data.claims.email };
  } catch (err) {
    console.error("auth: could not read session", err instanceof Error ? err.message : err);
    return null;
  }
});

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const identity = await getIdentity();
  if (!identity) return null;
  const [row] = await asSystem((tx) => tx<{
    displayName: string; collegeId: string; collegeName: string; collegeShort: string;
    emailVerifiedAt: Date | null; status: Viewer["status"]; statusReason: string | null;
    onboardedAt: Date | null; role: Viewer["role"];
  }[]>`
    select p.display_name, p.college_id, c.name as college_name, c.short_name as college_short,
           p.email_verified_at, p.status, p.status_reason, p.onboarded_at, r.role
    from restix.profiles p
    join restix.colleges c on c.id = p.college_id
    left join restix.admin_roles r on r.user_id = p.id
    where p.id = ${identity.id}`);

  const base = { id: identity.id, email: identity.email };
  if (!row) {
    return { ...base, displayName: identity.email, collegeId: "", collegeName: "", collegeShortName: "", emailVerifiedAt: null,
      status: "active", statusReason: null, onboarded: false, role: null, access: "no_profile" };
  }
  // Re-checked on every request, so removing a domain from the allowlist revokes access immediately.
  const access: Access = !isAllowedEmail(identity.email, env().allowedDomains)
    ? "domain_not_allowed"
    : row.emailVerifiedAt === null
      ? "unverified"
      : row.status === "suspended"
        ? "suspended"
        : row.status === "restricted"
          ? "restricted"
          : "ok";
  return {
    ...base,
    displayName: row.displayName,
    collegeId: row.collegeId,
    collegeName: row.collegeName,
    collegeShortName: row.collegeShort,
    emailVerifiedAt: row.emailVerifiedAt,
    status: row.status,
    statusReason: row.statusReason,
    onboarded: row.onboardedAt !== null,
    role: row.role,
    access,
  };
});

function signInPath(next?: string | null) {
  return next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in";
}

/** Any signed-in account (used by the account page, which must work even for restricted users). */
export async function requireViewer(next?: string): Promise<Viewer> {
  const viewer = await getViewer();
  // The proxy records the requested path; safeNext() sanitises it again after sign-in.
  if (!viewer) redirect(signInPath(next ?? (await headers()).get("x-restix-path")));
  if (viewer.access === "no_profile" || viewer.access === "domain_not_allowed" || viewer.access === "unverified") {
    redirect(`/sign-in?error=${viewer.access}`);
  }
  return viewer;
}

/** May browse the marketplace: verified, allowed domain, not suspended. */
export async function requireBrowser(next?: string): Promise<Viewer> {
  const viewer = await requireViewer(next);
  if (viewer.access === "suspended") redirect("/account?notice=suspended");
  if (!viewer.onboarded) redirect(`/welcome${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return viewer;
}

export async function requireModerator(): Promise<Viewer> {
  const viewer = await requireViewer("/admin");
  if (!viewer.role || viewer.access !== "ok") redirect("/?notice=forbidden");
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireModerator();
  if (viewer.role !== "admin") redirect("/admin?notice=admins-only");
  return viewer;
}

/** For server actions: why a viewer can't take a write action, or null if they can. */
export function writeBlockReason(viewer: Viewer | null): string | null {
  if (!viewer) return "Please sign in first.";
  switch (viewer.access) {
    case "ok":
      return null;
    case "restricted":
      return "Your account is restricted, so you can browse but not list, contact sellers or report. See your account page for details.";
    case "suspended":
      return "Your account is suspended. See your account page to appeal.";
    case "unverified":
      return "Your institutional email isn't verified yet.";
    case "domain_not_allowed":
      return "This account's email domain isn't allowed on ResTix.";
    case "no_profile":
      return "Your sign-in didn't finish. Please sign out and sign in again.";
  }
}
