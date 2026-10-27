"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-redirect";
import { emailDomain } from "@/lib/email-domain";
import { asSystem } from "@/server/db";
import { devAuthEnabled, env, supabaseAuthConfigured } from "@/server/env";
import { allow } from "@/server/rate-limit";
import { completeSignIn, ensureDevAuthUser } from "@/server/auth/complete-sign-in";
import { DEV_COOKIE, devCookieOptions, encodeDevSession } from "@/server/auth/dev-session";
import { supabaseServer } from "@/server/auth/supabase";

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  if (!supabaseAuthConfigured()) redirect("/sign-in?error=not_configured");
  const { APP_URL, allowedDomains } = env();
  let url: string | null = null;
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${APP_URL}/auth/callback?next=${encodeURIComponent(next)}`,
        // A hint that steers Google's account picker to the campus domain. It is not a
        // security boundary: the callback enforces the domain from Supabase's verified data.
        queryParams: { prompt: "select_account", ...(allowedDomains.length === 1 ? { hd: allowedDomains[0] } : {}) },
      },
    });
    if (!error) url = data.url;
    else console.error("auth: signInWithOAuth failed", error.message);
  } catch (err) {
    console.error("auth: provider unavailable", err instanceof Error ? err.message : err);
  }
  if (!url) redirect("/sign-in?error=provider");
  redirect(url);
}

export async function signOut() {
  if (devAuthEnabled()) {
    (await cookies()).delete(DEV_COOKIE);
  } else if (supabaseAuthConfigured()) {
    try {
      const supabase = await supabaseServer();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("auth: sign-out failed", err instanceof Error ? err.message : err);
    }
  }
  redirect("/");
}

/** Stable id per email for dev accounts that are not seeded. */
function devUserId(email: string): string {
  const h = createHash("sha256").update(`restix-dev:${email}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Local development sign-in. Refused unless devAuthEnabled() (never in production or on Vercel). */
export async function devSignIn(formData: FormData) {
  if (!devAuthEnabled()) redirect("/sign-in?error=not_configured");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!(await allow("devSignIn", ip))) redirect("/sign-in?error=rate_limited");

  const next = safeNext(formData.get("next"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim().slice(0, 40) || null;
  const emailVerified = formData.get("unverified") !== "on";
  if (!emailDomain(email)) redirect(`/sign-in?error=invalid_email&next=${encodeURIComponent(next)}`);

  const [existing] = await asSystem((tx) => tx<{ id: string }[]>`select id from auth.users where lower(email) = ${email} limit 1`);
  const identity = { id: existing?.id ?? devUserId(email), email, emailVerified, fullName: name };
  await ensureDevAuthUser(identity);
  const result = await completeSignIn(identity);
  if (!result.ok) redirect(`/sign-in?error=${result.reason}&next=${encodeURIComponent(next)}`);

  (await cookies()).set(DEV_COOKIE, encodeDevSession({ sub: identity.id, email, name: name ?? email }), devCookieOptions);
  redirect(result.onboarded ? next : `/welcome?next=${encodeURIComponent(next)}`);
}
