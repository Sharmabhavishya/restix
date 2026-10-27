import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-redirect";
import { completeSignIn } from "@/server/auth/complete-sign-in";
import { supabaseServer } from "@/server/auth/supabase";
import { env, supabaseAuthConfigured } from "@/server/env";

// Google -> Supabase -> here, with a one-time PKCE code. The code is exchanged server-side
// (the verifier lives in an httpOnly cookie), then the institutional rules are applied to
// the user record Supabase returns, never to anything in the URL.
export async function GET(request: NextRequest) {
  const base = env().APP_URL; // never the request's Host header
  const to = (path: string) => NextResponse.redirect(new URL(path, base));
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));

  if (!supabaseAuthConfigured()) return to("/sign-in?error=not_configured");
  if (params.get("error")) {
    // access_denied = the person closed or cancelled Google's consent screen.
    return to(`/sign-in?error=${params.get("error") === "access_denied" ? "cancelled" : "provider"}`);
  }
  const code = params.get("code");
  if (!code) return to("/sign-in?error=provider");

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("auth: code exchange failed", error?.message);
    return to("/sign-in?error=expired");
  }

  const user = data.user;
  const meta = user.user_metadata ?? {};
  // Only Google identities are accepted, even if another Supabase provider gets enabled.
  const providers: unknown = user.app_metadata?.providers ?? [user.app_metadata?.provider];
  if (!Array.isArray(providers) || !providers.includes("google")) {
    await supabase.auth.signOut();
    return to("/sign-in?error=provider");
  }
  const result = await completeSignIn({
    id: user.id,
    email: user.email ?? "",
    // Both Supabase's confirmation and Google's own claim must agree.
    emailVerified: Boolean(user.email_confirmed_at) && meta.email_verified !== false,
    fullName: typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : null,
  });

  if (!result.ok) {
    await supabase.auth.signOut();
    return to(`/sign-in?error=${result.reason}`);
  }
  return to(result.onboarded ? next : `/welcome?next=${encodeURIComponent(next)}`);
}
