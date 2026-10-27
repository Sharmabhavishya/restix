import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-redirect";
import { requireViewer } from "@/server/auth/viewer";
import { privateProfile } from "@/server/profile";
import { ProfileForm } from "../(app)/account/profile-form";
import { Wordmark } from "@/components/logo";
import { VerifiedEmail } from "@/components/listing-bits";
import { Panel } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  const viewer = await requireViewer("/welcome");
  if (viewer.onboarded) redirect(next);
  const priv = await privateProfile(viewer.id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-12">
      <Wordmark className="mb-10 text-lg" />
      <h1 className="text-[clamp(2rem,6vw,2.75rem)] leading-[1.05] font-bold tracking-[-0.03em]">you&apos;re in. one sec.</h1>
      <p className="mt-3 text-[17px] text-muted">
        Pick the name people see when you sell or ask about a ticket.
      </p>
      <div className="mt-4">
        <VerifiedEmail college={viewer.collegeShortName} />
      </div>
      <Panel className="mt-8 p-6">
        <ProfileForm displayName={viewer.displayName} whatsapp={priv?.whatsappNumber ?? null} onboarding next={next} />
      </Panel>
    </main>
  );
}
