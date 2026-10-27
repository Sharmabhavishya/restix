import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-redirect";
import { devAuthEnabled, env, supabaseAuthConfigured } from "@/server/env";
import { getViewer } from "@/server/auth/viewer";
import { DEV_USERS } from "@/server/dev-fixtures";
import { devSignIn, signInWithGoogle, signOut } from "../auth/actions";
import { PublicFooter, PublicHeader } from "@/components/shell/public-header";
import { GoogleG } from "@/components/google-g";
import { Notice, Panel } from "@/components/ui/bits";
import { Field, Input, Checkbox } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LoopVideo } from "@/components/loop-video";
import { CLIPS } from "@/components/landing-photos";

export const metadata: Metadata = { title: "Sign in" };

function errorCopy(code: string | undefined): { title: string; body: string } | null {
  switch (code) {
    case undefined:
      return null;
    case "domain_not_allowed":
      return {
        title: "That college isn't on ResTix yet",
        body: "ResTix only lets in college Google accounts from colleges it supports. Sign in again and pick your college account in Google's account chooser.",
      };
    case "unverified_email":
      return { title: "Email not verified", body: "Google didn't confirm this email address, so we can't let it in. Use your verified college account." };
    case "college_not_configured":
      return { title: "Your college isn't set up yet", body: "Your email domain is allowed but no college is linked to it. Ask the ResTix admins to finish setup." };
    case "cancelled":
      return { title: "Sign-in cancelled", body: "No worries. Hit the button again whenever you're ready." };
    case "expired":
      return { title: "That sign-in expired", body: "The sign-in link timed out or was already used. Start again." };
    case "provider":
      return { title: "Google sign-in isn't responding", body: "We couldn't reach the sign-in service. Wait a minute and try again." };
    case "not_configured":
      return { title: "Sign-in isn't configured", body: "This deployment has no Google sign-in configured yet. If you run ResTix, see docs/DEPLOYMENT.md." };
    case "no_profile":
      return { title: "Your sign-in didn't finish", body: "Sign out and sign in again to complete setup." };
    case "rate_limited":
      return { title: "Too many attempts", body: "Wait a few minutes before trying again." };
    case "invalid_email":
      return { title: "That email doesn't look right", body: "Enter a full address like name@college.edu.in." };
    default:
      return { title: "Something went wrong", body: "Try signing in again." };
  }
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const viewer = await getViewer();
  if (viewer && !error && (viewer.access === "ok" || viewer.access === "restricted")) redirect(next);

  const { allowedDomains } = env();
  const message = errorCopy(error);
  const google = supabaseAuthConfigured();
  const dev = devAuthEnabled();

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto grid w-full max-w-[1200px] flex-1 items-start gap-10 px-4 py-10 sm:px-6 grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_minmax(0,440px)] md:py-20">
        <div className="max-w-xl">
          <h1 className="font-display text-[clamp(2.4rem,5.5vw,4.25rem)] leading-[0.95] font-extrabold tracking-[-0.04em]">
            sign in with your college email
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">
            Only verified students get in. That&apos;s the whole point: no randoms, no reposted screenshots, just people like you.
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-[15px]">
            <li className="flex gap-3"><span className="mt-2 size-1.5 flex-none rounded-full bg-accent" />Your phone number stays private. It&apos;s shared with one person, only after a seller says yes.</li>
            <li className="flex gap-3"><span className="mt-2 size-1.5 flex-none rounded-full bg-accent" />We only see your name and college email. Your email is never shown to other students.</li>
            <li className="flex gap-3"><span className="mt-2 size-1.5 flex-none rounded-full bg-accent" />No passwords to remember, and no payment details, ever.</li>
          </ul>
          {/* A window onto a real night: the reason anyone signs in. */}
          <LoopVideo src={CLIPS.blueStage.src} poster={CLIPS.blueStage.poster} className="relative mt-10 hidden aspect-[16/7] rounded-[28px] bg-raised md:block" />
        </div>

        <div className="flex flex-col gap-4">
          {message && <Notice tone={error === "cancelled" ? "info" : "error"} title={message.title}>{message.body}</Notice>}

          {viewer && error && (
            <Notice tone="info" title={`Signed in as ${viewer.email}`}>
              <form action={signOut} className="mt-2">
                <button className="font-medium underline">Sign out and use another account</button>
              </form>
            </Notice>
          )}

          <Panel className="p-6">
            <h2 className="text-lg font-semibold">Continue with Google</h2>
            <p className="mt-1 text-sm text-muted">Use your college Google account.</p>
            {google ? (
              <form action={signInWithGoogle} className="mt-5">
                <input type="hidden" name="next" value={next} />
                <SubmitButton variant="secondary" size="lg" className="w-full" pendingLabel="Opening Google…">
                  <GoogleG />
                  Continue with Google
                </SubmitButton>
              </form>
            ) : (
              <Notice tone="warning" className="mt-5" title="Google sign-in isn't configured here">
                Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> and enable the Google provider in Supabase. Steps are in docs/DEPLOYMENT.md.
              </Notice>
            )}
            <p className="mt-4 text-[13px] text-muted">
              By continuing you agree to the <Link href="/terms" className="underline">terms</Link> and{" "}
              <Link href="/privacy" className="underline">privacy notice</Link>.
            </p>
          </Panel>

          {dev && (
            <Panel className="border-dashed p-6">
              <h2 className="text-base font-semibold">Development sign-in</h2>
              <p className="mt-1 text-[13px] text-muted">
                Local only. Disabled in production builds and on Vercel. The same domain rules apply.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {DEV_USERS.map((u) => (
                  <form key={u.id} action={devSignIn}>
                    <input type="hidden" name="email" value={u.email} />
                    <input type="hidden" name="name" value={u.name} />
                    <input type="hidden" name="next" value={next} />
                    <SubmitButton variant="secondary" className="w-full justify-between" pendingLabel="Signing in…">
                      <span>{u.name}</span>
                      <span className="text-[13px] font-normal text-muted">{u.email}</span>
                    </SubmitButton>
                  </form>
                ))}
              </div>
              <form action={devSignIn} className="mt-5 flex flex-col gap-4 border-t border-border pt-5">
                <input type="hidden" name="next" value={next} />
                <Field label="Any email" htmlFor="dev-email" hint="Try another domain to see the rejection.">
                  <Input id="dev-email" name="email" type="email" required placeholder={`you@${allowedDomains[0]}`} />
                </Field>
                <Field label="Name" htmlFor="dev-name" optional>
                  <Input id="dev-name" name="name" maxLength={40} />
                </Field>
                <Checkbox id="dev-unverified" name="unverified" label="Pretend the email is unverified" />
                <SubmitButton variant="dark" pendingLabel="Signing in…">Sign in locally</SubmitButton>
              </form>
            </Panel>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
