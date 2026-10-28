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
import { BadgeCheck, Lock, Wallet, type LucideIcon } from "lucide-react";

export const metadata: Metadata = { title: "Sign in" };

const PERKS: [LucideIcon, string][] = [
  [Lock, "your number stays hidden till you say yes"],
  [BadgeCheck, "college emails only"],
  [Wallet, "₹0 fees. we never touch your money"],
];

const TAPE = ["no passwords", "college emails only", "your email stays hidden", "₹0 fees. no cap.", "name + email, that's it", "report anything sus"];

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
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <PublicHeader />
      <main className="mx-auto grid w-full max-w-[1200px] flex-1 grid-cols-[minmax(0,1fr)] items-start gap-x-14 gap-y-10 px-4 pt-8 pb-16 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,460px)] md:pt-16 md:pb-24">
        <div className="md:pt-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-strong">
            <span aria-hidden className="live-dot size-2 rounded-full bg-positive" />
            verified students only. no randoms.
          </p>
          <h1 className="mt-6 font-display text-[clamp(3.25rem,8vw,6.75rem)] leading-[0.88] font-extrabold tracking-[-0.045em]">
            <span className="hero-line" style={{ "--i": 0 } as React.CSSProperties}>get in.</span>
            <br />
            <span className="hero-line text-accent-strong" style={{ "--i": 1 } as React.CSSProperties}>it&apos;s one tap.</span>
          </h1>
          <p className="mt-7 max-w-[38ch] text-lg leading-relaxed text-ink-soft">
            Sign in with your college Google account. No passwords, no forms, and your email never shows to other students.
          </p>
        </div>

        {/* The sign-in itself is a ticket: a student pass on a stage, with a tear-off stub. */}
        <div className="flex flex-col gap-4 md:col-start-2 md:row-span-2 md:row-start-1">
          {message && <Notice tone={error === "cancelled" ? "info" : "error"} title={message.title}>{message.body}</Notice>}

          {viewer && error && (
            <Notice tone="info" title={`Signed in as ${viewer.email}`}>
              <form action={signOut} className="mt-2">
                <button className="font-medium underline">Sign out and use another account</button>
              </form>
            </Notice>
          )}

          <div className="relative overflow-hidden rounded-[32px] bg-accent px-4 py-10 sm:px-8 sm:py-12">
            <LoopVideo src={CLIPS.blueStage.src} poster={CLIPS.blueStage.poster} className="absolute inset-0" />
            <span aria-hidden className="absolute inset-0 bg-accent opacity-35 mix-blend-multiply" />
            <div className="pass-wrap relative">
              <span className="sticker absolute -top-4 -right-2 z-10 rounded-full bg-sticker px-3.5 py-1.5 text-sm font-bold whitespace-nowrap text-sticker-ink sm:-right-4">
                no passwords. no cap.
              </span>
              <div className="pass bg-surface">
                <div className="px-6 pt-7 pb-6">
                  <p className="text-[12px] font-bold tracking-[0.18em] text-accent-strong uppercase">admit one · student pass</p>
                  <h2 className="mt-2 font-display text-[clamp(1.75rem,4vw,2.125rem)] leading-none font-extrabold tracking-[-0.03em]">
                    pick your college account
                  </h2>
                  <p className="mt-2.5 text-[15px] text-muted">That&apos;s the whole form. We only get your name and college email.</p>
                  {google ? (
                    <form action={signInWithGoogle} className="mt-6">
                      <input type="hidden" name="next" value={next} />
                      <SubmitButton variant="dark" size="lg" className="w-full" pendingLabel="Opening Google…">
                        <span className="grid size-6 place-items-center rounded-full bg-white"><GoogleG /></span>
                        Continue with Google
                      </SubmitButton>
                    </form>
                  ) : (
                    <Notice tone="warning" className="mt-6" title="Google sign-in isn't configured here">
                      Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> and enable the Google provider in Supabase. Steps are in docs/DEPLOYMENT.md.
                    </Notice>
                  )}
                </div>
                <div className="pass-stub flex items-center justify-between gap-4 px-6">
                  <p className="text-[12.5px] leading-snug text-muted">
                    By continuing you agree to the <Link href="/terms" className="underline">terms</Link> and{" "}
                    <Link href="/privacy" className="underline">privacy policy</Link>.
                  </p>
                  <span aria-hidden className="pass-code flex-none text-ink" />
                </div>
              </div>
            </div>
          </div>

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

        <ul className="flex flex-wrap gap-3 md:col-start-1 md:row-start-2 md:max-w-[34rem] md:self-start">
          {PERKS.map(([Icon, text], i) => (
            <li
              key={text}
              className={`perk flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-[15px] font-medium ${i % 2 ? "rotate-[1.5deg]" : "-rotate-[1.5deg]"}`}
            >
              <Icon className="size-4 flex-none text-accent-strong" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </main>

      {/* The house rules as sticker tape, same as the home page. */}
      <div aria-hidden className="-mx-4 -rotate-2 bg-primary py-4 text-on-primary">
        <div className="tape-track flex w-max bg-primary">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center">
              {TAPE.map((t) => (
                <span key={t} className="flex items-center font-display text-[clamp(1.25rem,2.4vw,1.75rem)] font-bold tracking-[-0.02em] whitespace-nowrap">
                  <span className="px-6 sm:px-8">{t}</span>
                  <span className="size-3 rounded-full border-[3px] border-accent" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="h-10" />
      <PublicFooter />
    </div>
  );
}
